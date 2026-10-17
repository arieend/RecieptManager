import { describe, it, expect } from 'vitest';
import { Session } from '../types';
import { StorageSettings } from './configService';
import { createSessionStore, createInMemorySessionAdapter } from './sessionStore';
import { SyncResult, SheetsSyncError } from './syncService';
import { createReceiptFiling, ReceiptSync } from './receiptFiling';

const session = (overrides: Partial<Session> = {}): Session => ({
  id: 'draft-1',
  userId: 'anonymous',
  storeName: 'Shop',
  createdAt: '2026-03-01T12:00:00.000Z',
  items: [
    { id: 'item-1', name: 'Milk', price: 6, quantity: 1, assignedTo: [] },
    { id: 'item-2', name: 'Bread', price: 4, quantity: 1, assignedTo: [] },
  ],
  people: [],
  tax: 0,
  tip: 0,
  total: 10,
  currency: 'ILS',
  exchangeRate: 1,
  imageUrl: 'data:image/jpeg;base64,abc',
  ...overrides,
});

const settings = (overrides: Partial<StorageSettings> = {}): StorageSettings => ({
  storagePath: 'Google Drive:\\Receipts',
  directories: { year: true, month: true, day: false },
  autoSave: true,
  syncToSheets: true,
  spreadsheetId: 'sheet-1',
  spreadsheetName: 'Receipts Database',
  currency: 'ILS',
  theme: 'light',
  ...overrides,
});

const synced: SyncResult = {
  driveFileId: 'file-1',
  driveLink: 'https://drive.google.com/file/d/file-1/view',
  driveFileName: 'shop_2026-03-01_10.00.jpg',
  spreadsheetLink: 'https://docs.google.com/spreadsheets/d/sheet-1/edit',
  itemSheetsLinks: {
    'item-1': 'https://docs.google.com/spreadsheets/d/sheet-1/edit#gid=0&range=A10',
    'item-2': 'https://docs.google.com/spreadsheets/d/sheet-1/edit#gid=0&range=A11',
  },
};

const uploaded: SyncResult = {
  driveFileId: synced.driveFileId,
  driveLink: synced.driveLink,
  driveFileName: synced.driveFileName,
};

/** A fake sync that records its calls and answers with `respond`. */
const fakeSync = (respond: () => Promise<SyncResult> = async () => synced) => {
  const calls: Parameters<ReceiptSync>[] = [];
  const sync: ReceiptSync = (...args) => { calls.push(args); return respond(); };
  return Object.assign(sync, { calls });
};

const setup = (sync: ReceiptSync = fakeSync()) => {
  const store = createSessionStore({
    adapter: createInMemorySessionAdapter(),
    shrinkImage: async (dataUrl) => dataUrl,
    now: () => new Date('2026-03-15T09:30:00.000Z').getTime(),
  });
  const history: { sessions: Session[] } = { sessions: [] };
  store.subscribe('user-1', (sessions) => { history.sessions = sessions; }, () => {});
  return { filing: createReceiptFiling({ sync, store }), history };
};

describe('Receipt filing', () => {
  it('syncs a Draft Session to Drive and Sheets, then saves it with the links', async () => {
    const { filing, history } = setup();

    const outcome = await filing.file('user-1', session(), { settings: settings(), driveToken: 'token' });

    expect(outcome.sync).toBe('done');
    expect(outcome.saved).toMatchObject({
      id: 'draft-1',
      userId: 'user-1',
      driveFileId: 'file-1',
      driveLink: 'https://drive.google.com/file/d/file-1/view',
      driveFileName: 'shop_2026-03-01_10.00.jpg',
      spreadsheetLink: 'https://docs.google.com/spreadsheets/d/sheet-1/edit',
    });
    expect(outcome.saved.items.map((i) => i.sheetsLink)).toEqual([
      'https://docs.google.com/spreadsheets/d/sheet-1/edit#gid=0&range=A10',
      'https://docs.google.com/spreadsheets/d/sheet-1/edit#gid=0&range=A11',
    ]);
    expect(history.sessions).toEqual([outcome.saved]);
  });

  it.each([
    ['there is no Drive token', session(), settings(), null],
    ['the image is already on Drive and Sheets sync is off', session({ driveFileId: 'file-0' }), settings({ syncToSheets: false }), 'token'],
    ['there is no image and Sheets sync is off', session({ imageUrl: '' }), settings({ syncToSheets: false }), 'token'],
  ])('skips sync but still saves when %s', async (_, draft, storage, driveToken) => {
    const sync = fakeSync();
    const { filing, history } = setup(sync);

    const outcome = await filing.file('user-1', draft, { settings: storage, driveToken });

    expect(sync.calls).toEqual([]);
    expect(outcome.sync).toBe('skipped');
    expect(history.sessions).toEqual([outcome.saved]);
  });

  const unconfirmed = (overrides: Partial<Session> = {}) =>
    session({ currency: 'USD', exchangeRate: 3.1268, rateConfirmed: false, ...overrides });

  it('files a Session with an Unconfirmed rate with Sheets off, still uploading its image, and not as a failure', async () => {
    const sync = fakeSync(async () => ({ driveFileId: 'file-1', driveLink: synced.driveLink, driveFileName: synced.driveFileName }));
    const { filing, history } = setup(sync);

    const outcome = await filing.file('user-1', unconfirmed(), { settings: settings(), driveToken: 'token' });

    expect(sync.calls).toHaveLength(1);
    expect(sync.calls[0][0].imageUrl).toBe('data:image/jpeg;base64,abc');
    expect(sync.calls[0][1]).toMatchObject({ syncToSheets: false, spreadsheetId: 'sheet-1' });
    expect(outcome.sync).toBe('done');
    expect(outcome.saved).toMatchObject({ driveFileId: 'file-1', rateConfirmed: false });
    expect(history.sessions).toEqual([outcome.saved]);
  });

  it('skips sync for a Session with an Unconfirmed rate whose image is already on Drive', async () => {
    const sync = fakeSync();
    const { filing, history } = setup(sync);

    const outcome = await filing.file('user-1', unconfirmed({ driveFileId: 'file-0' }), { settings: settings(), driveToken: 'token' });

    expect(sync.calls).toEqual([]);
    expect(outcome.sync).toBe('skipped');
    expect(history.sessions).toEqual([outcome.saved]);
  });

  it('syncs to Sheets once the rate is confirmed', async () => {
    const sync = fakeSync(async () => ({ driveFileId: 'file-1' }));
    const { filing } = setup(sync);
    const first = await filing.file('user-1', unconfirmed(), { settings: settings(), driveToken: 'token' });

    await filing.file('user-1', { ...first.saved, rateConfirmed: true }, { settings: settings(), driveToken: 'token' });

    expect(sync.calls).toHaveLength(2);
    expect(sync.calls[1][1].syncToSheets).toBe(true);
  });

  it('syncs to Sheets once after the rate is confirmed, however often it is saved again', async () => {
    const sync = fakeSync(async () => (sync.calls.length === 1 ? { driveFileId: 'file-1' } : synced));
    const { filing } = setup(sync);
    const first = await filing.file('user-1', unconfirmed(), { settings: settings(), driveToken: 'token' });
    const confirmed = await filing.file('user-1', { ...first.saved, rateConfirmed: true }, { settings: settings(), driveToken: 'token' });

    await filing.file('user-1', confirmed.saved, { settings: settings(), driveToken: 'token' });
    await filing.file('user-1', confirmed.saved, { settings: settings(), driveToken: 'token' });

    expect(sync.calls.map((call) => call[1].syncToSheets)).toEqual([false, true]);
  });

  const onSheet = (overrides: Partial<Session> = {}) => session({
    driveFileId: synced.driveFileId,
    driveLink: synced.driveLink,
    driveFileName: synced.driveFileName,
    spreadsheetLink: synced.spreadsheetLink,
    ...overrides,
  });

  it('never asks sync to write to Sheets for a Session already on the Purchases sheet', async () => {
    const sync = fakeSync();
    const { filing, history } = setup(sync);

    const outcome = await filing.file('user-1', onSheet(), { settings: settings(), driveToken: 'token' });

    expect(sync.calls).toEqual([]);
    expect(outcome.sync).toBe('skipped');
    expect(outcome.saved.spreadsheetLink).toBe(synced.spreadsheetLink);
    expect(history.sessions).toEqual([outcome.saved]);
  });

  it('still uploads the image of a Session already on the Purchases sheet, with Sheets off', async () => {
    const sync = fakeSync(async () => uploaded);
    const { filing } = setup(sync);

    const outcome = await filing.file('user-1', onSheet({ driveFileId: '', driveLink: '', driveFileName: '' }), { settings: settings(), driveToken: 'token' });

    expect(sync.calls).toHaveLength(1);
    expect(sync.calls[0][1]).toMatchObject({ syncToSheets: false, spreadsheetId: 'sheet-1' });
    expect(outcome.sync).toBe('done');
    expect(outcome.saved).toMatchObject({ ...uploaded, spreadsheetLink: synced.spreadsheetLink });
  });

  it('saves a filed Session again without changes as skipped, with the same links', async () => {
    const sync = fakeSync();
    const { filing } = setup(sync);
    const first = await filing.file('user-1', session(), { settings: settings(), driveToken: 'token' });

    const again = await filing.file('user-1', first.saved, { settings: settings(), driveToken: 'token' });

    expect(sync.calls).toHaveLength(1);
    expect(again.sync).toBe('skipped');
    expect(again.saved).toMatchObject({
      driveFileId: first.saved.driveFileId,
      driveLink: first.saved.driveLink,
      driveFileName: first.saved.driveFileName,
      spreadsheetLink: first.saved.spreadsheetLink,
    });
    expect(again.saved.items.map((i) => i.sheetsLink)).toEqual(first.saved.items.map((i) => i.sheetsLink));
  });

  it('keeps a Session on its old spreadsheet off a newly chosen one', async () => {
    const sync = fakeSync();
    const { filing } = setup(sync);

    const outcome = await filing.file('user-1', onSheet(), { settings: settings({ spreadsheetId: 'sheet-2' }), driveToken: 'token' });

    expect(sync.calls).toEqual([]);
    expect(outcome.saved.spreadsheetLink).toBe(synced.spreadsheetLink);
  });

  it('syncs to Sheets a Session filed while Sheets sync was off, once sync is on', async () => {
    const sync = fakeSync(async () => (sync.calls.length === 1 ? uploaded : synced));
    const { filing } = setup(sync);
    const first = await filing.file('user-1', session(), { settings: settings({ syncToSheets: false }), driveToken: 'token' });

    const second = await filing.file('user-1', first.saved, { settings: settings(), driveToken: 'token' });

    expect(sync.calls[1][1].syncToSheets).toBe(true);
    expect(second.saved.spreadsheetLink).toBe(synced.spreadsheetLink);
  });

  it.each([
    ['a confirmed rate', session({ currency: 'USD', exchangeRate: 3.1268, rateConfirmed: true })],
    ['an old Session with no rate flag', session({ currency: 'USD', exchangeRate: 1 })],
  ])('syncs a Session with %s to Sheets as before', async (_, draft) => {
    const sync = fakeSync();
    const { filing } = setup(sync);

    const outcome = await filing.file('user-1', draft, { settings: settings(), driveToken: 'token' });

    expect(sync.calls[0][1]).toEqual(settings());
    expect(outcome.sync).toBe('done');
  });

  it('reports the spreadsheet ID when sync had to find or create the spreadsheet', async () => {
    const { filing } = setup(fakeSync(async () => ({ ...synced, spreadsheetId: 'sheet-new' })));

    const outcome = await filing.file('user-1', session(), { settings: settings({ spreadsheetId: '' }), driveToken: 'token' });

    expect(outcome.spreadsheetId).toBe('sheet-new');
  });

  it.each([
    ['sync returned none', fakeSync(), settings(), 'token'],
    ['sync failed', fakeSync(async () => { throw new Error('Network request failed'); }), settings({ spreadsheetId: '' }), 'token'],
    ['sync was skipped', fakeSync(async () => ({ ...synced, spreadsheetId: 'sheet-new' })), settings({ spreadsheetId: '' }), null],
  ])('reports no spreadsheet ID when %s', async (_, sync, storage, driveToken) => {
    const { filing } = setup(sync);

    const outcome = await filing.file('user-1', session(), { settings: storage, driveToken });

    expect(outcome).not.toHaveProperty('spreadsheetId');
  });

  const noLinks = { imageUrl: '', driveFileId: '', driveLink: '', driveFileName: '', spreadsheetLink: '' };

  it.each([
    ['sync is done without links', fakeSync(async () => ({})), 'token'],
    ['sync is skipped', fakeSync(), null],
    ['sync fails', fakeSync(async () => { throw new Error('Network request failed'); }), 'token'],
  ])('saves missing links as empty strings when %s, so a merge write clears stored ones', async (_, sync, driveToken) => {
    const { filing } = setup(sync);
    const draft = session({ imageUrl: undefined, driveFileId: undefined, driveLink: undefined, driveFileName: undefined, spreadsheetLink: undefined });

    const outcome = await filing.file('user-1', draft, { settings: settings(), driveToken });

    expect(outcome.saved).toMatchObject(noLinks);
  });

  it('lets a Session store failure through after syncing', async () => {
    const store = createSessionStore({
      adapter: { ...createInMemorySessionAdapter(), put: async () => { throw new Error('disk full'); } },
      shrinkImage: async (dataUrl) => dataUrl,
      now: Date.now,
    });
    const filing = createReceiptFiling({ sync: fakeSync(), store });

    await expect(filing.file('user-1', session(), { settings: settings(), driveToken: 'token' }))
      .rejects.toMatchObject({ name: 'SessionStoreError', kind: 'write-failed' });
  });

  const withStatus = (message: string, status: number) => Object.assign(new Error(message), { status });

  it.each([
    ['a 401 from Drive', 'drive-auth-expired', withStatus('Unauthorized', 401)],
    ['an invalid_grant error', 'drive-auth-expired', new Error('invalid_grant')],
    ['a message mentioning 401', 'drive-auth-expired', new Error('Request failed with status 401')],
    ['Sheets API not enabled', 'sheets-disabled', new Error('Google Sheets API has not been used; enable sheets.googleapis.com')],
    ['Sheets API disabled', 'sheets-disabled', new Error('Sheets API is disabled for this project')],
    ['anything else', 'sync-failed', new Error('Network request failed')],
  ])('reports %s as %s and still saves the Session', async (_, kind, error) => {
    const { filing, history } = setup(fakeSync(async () => { throw error; }));

    const outcome = await filing.file('user-1', session(), { settings: settings(), driveToken: 'token' });

    expect(outcome.sync).toEqual({ failed: kind });
    expect(history.sessions).toEqual([outcome.saved]);
  });

  it('saves the Drive links when Sheets fails after the Drive upload, so the next save does not upload again', async () => {
    const sync = fakeSync(async () => { throw new SheetsSyncError(uploaded, new Error('Failed to append to spreadsheet')); });
    const { filing, history } = setup(sync);

    const outcome = await filing.file('user-1', session(), { settings: settings(), driveToken: 'token' });

    expect(outcome.sync).toEqual({ failed: 'sync-failed' });
    expect(outcome.saved).toMatchObject(uploaded);
    expect(outcome.saved.items.map((i) => i.sheetsLink)).toEqual([undefined, undefined]);
    expect(history.sessions).toEqual([outcome.saved]);

    await filing.file('user-1', outcome.saved, { settings: settings(), driveToken: 'token' });
    expect(sync.calls[1][0].driveFileId).toBe('file-1');
  });

  it('reports the Sheets failure kind when Sheets fails after the Drive upload', async () => {
    const sheetsDisabled = new Error('Google Sheets API has not been used; enable sheets.googleapis.com');
    const { filing } = setup(fakeSync(async () => { throw new SheetsSyncError(uploaded, sheetsDisabled); }));

    const outcome = await filing.file('user-1', session(), { settings: settings(), driveToken: 'token' });

    expect(outcome.sync).toEqual({ failed: 'sheets-disabled' });
    expect(outcome.saved.driveFileId).toBe('file-1');
  });

  it('reports a spreadsheet that sync created before Sheets failed', async () => {
    const { filing } = setup(fakeSync(async () => {
      throw new SheetsSyncError({ ...uploaded, spreadsheetId: 'sheet-new' }, new Error('Failed to append to spreadsheet'));
    }));

    const outcome = await filing.file('user-1', session(), { settings: settings({ spreadsheetId: '' }), driveToken: 'token' });

    expect(outcome.spreadsheetId).toBe('sheet-new');
  });
});
