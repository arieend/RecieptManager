import { describe, it, expect } from 'vitest';
import { Session } from '../types';
import { StorageSettings } from './configService';
import { createSessionStore, createInMemorySessionAdapter } from './sessionStore';
import { SyncResult } from './syncService';
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

  it('reports the spreadsheet ID when sync had to find or create the spreadsheet', async () => {
    const { filing } = setup(fakeSync(async () => ({ ...synced, spreadsheetId: 'sheet-new' })));

    const outcome = await filing.file('user-1', session(), { settings: settings({ spreadsheetId: '' }), driveToken: 'token' });

    expect(outcome.spreadsheetId).toBe('sheet-new');
  });

  it('reports no spreadsheet ID when the settings already had one', async () => {
    const { filing } = setup();

    const outcome = await filing.file('user-1', session(), { settings: settings(), driveToken: 'token' });

    expect(outcome.spreadsheetId).toBeUndefined();
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

  it('saves without links when Sheets fails after the Drive upload, so the next save uploads again', async () => {
    const { filing } = setup(fakeSync(async () => { throw new Error('Failed to append to spreadsheet'); }));

    const outcome = await filing.file('user-1', session(), { settings: settings(), driveToken: 'token' });

    expect(outcome.saved.driveFileId).toBeUndefined();
    expect(outcome.saved.items.map((i) => i.sheetsLink)).toEqual([undefined, undefined]);
  });
});
