import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPurchasesSheet, createInMemorySpreadsheetAdapter, SheetCell } from './purchasesSheet';
import { HOUSEHOLD_PERSON } from './receiptIntake';
import { Session } from '../types';

const OLD_HEADERS = ['Date', 'Store', 'Item Name', 'Price (NIS)', 'Category', 'AI Tags', 'Labels', 'Receipt Link', 'Original Amount', 'Exchange Rate'];

const session = (overrides: Partial<Session> = {}): Session => ({
  id: 's1',
  userId: 'user1',
  storeName: 'Test Store',
  items: [
    { id: 'i1', name: 'Milk', price: 10, quantity: 1, assignedTo: ['p1'], category: 'Food', labels: ['dairy', 'fridge'] },
    { id: 'i2', name: 'Bread', price: 5, quantity: 2, assignedTo: [], category: 'Food', labels: [] },
  ],
  people: [{ id: 'p1', name: 'Dana', color: '#f00' }],
  tax: 0,
  tip: 0,
  total: 20,
  currency: 'ILS',
  exchangeRate: 1,
  createdAt: new Date(2024, 4, 20, 12).toISOString(),
  imageUrl: '',
  driveLink: 'http://drive/old',
  driveFileName: 'old.jpg',
  ...overrides,
});

const text = (value: string): SheetCell => ({ value });
const headerRow = (headers: string[]) => headers.map(text);

/** Reads data rows back as header → value, so tests don't depend on column order. */
const rowsByHeader = (rows: string[][]) => rows.slice(1).map((row) => Object.fromEntries(rows[0].map((h, i) => [h, row[i]])));

describe('Purchases sheet', () => {
  let memory: ReturnType<typeof createInMemorySpreadsheetAdapter>;
  let sheet: ReturnType<typeof createPurchasesSheet>;

  beforeEach(() => {
    memory = createInMemorySpreadsheetAdapter();
    sheet = createPurchasesSheet(memory);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('connect', () => {
    it('creates a spreadsheet with the current headers and a date-formatted Date column', async () => {
      const { spreadsheetId, created } = await sheet.connect('Receipts Database');

      expect(created).toBe(true);
      expect(memory.tab(spreadsheetId, 'Purchases')).toEqual([
        ['Date', 'Store', 'Item Name', 'Price (NIS)', 'Category', 'AI Tags', 'Assigned To', 'Receipt Link', 'Original Amount', 'Exchange Rate'],
      ]);
      expect(memory.dateFormats).toEqual([{ spreadsheetId, sheetId: 0, column: 0, rows: undefined, sheetsPattern: 'dd/mm/yyyy' }]);
    });

    it('uses a spreadsheet that already has the name', async () => {
      memory.seed('existing', { name: 'Receipts Database', tabs: [{ sheetId: 0, title: 'Purchases', rows: [] }] });

      expect(await sheet.connect('Receipts Database')).toEqual({ spreadsheetId: 'existing', created: false });
    });

    it('creates nothing when the search by name fails', async () => {
      const searchFailure = Object.assign(new Error('Backend Error'), { status: 503 });
      sheet = createPurchasesSheet({ ...memory, findByName: async () => { throw searchFailure; } });

      await expect(sheet.connect('Receipts Database')).rejects.toBe(searchFailure);
      expect(await memory.findByName('Receipts Database')).toBeNull();
    });

    it('still connects when the date format cannot be applied', async () => {
      sheet = createPurchasesSheet({ ...memory, formatDates: async () => { throw new Error('quota'); } });

      await expect(sheet.connect('Receipts Database')).resolves.toMatchObject({ created: true });
    });
  });

  describe('append', () => {
    it('writes one row per ReceiptItem under the matching headers', async () => {
      const { spreadsheetId } = await sheet.connect('Receipts');

      await sheet.append(spreadsheetId, session(), { driveLink: 'http://drive/new', driveFileName: 'new.jpg' });

      expect(rowsByHeader(memory.tab(spreadsheetId, 'Purchases'))).toEqual([
        {
          'Date': '20/05/2024', 'Store': 'Test Store', 'Item Name': 'Milk', 'Price (NIS)': '10', 'Category': 'Food',
          'AI Tags': 'dairy, fridge', 'Assigned To': 'Dana', 'Receipt Link': '=HYPERLINK("http://drive/new", "new.jpg")',
          'Original Amount': '', 'Exchange Rate': '',
        },
        {
          'Date': '20/05/2024', 'Store': 'Test Store', 'Item Name': 'Bread', 'Price (NIS)': '5', 'Category': 'Food',
          'AI Tags': '', 'Assigned To': HOUSEHOLD_PERSON.name, 'Receipt Link': '=HYPERLINK("http://drive/new", "new.jpg")',
          'Original Amount': '', 'Exchange Rate': '',
        },
      ]);
    });

    it("links to the Session's own Drive file when this sync uploaded none", async () => {
      const { spreadsheetId } = await sheet.connect('Receipts');

      await sheet.append(spreadsheetId, session());

      expect(rowsByHeader(memory.tab(spreadsheetId, 'Purchases'))[0]['Receipt Link']).toBe('=HYPERLINK("http://drive/old", "old.jpg")');
    });

    it('leaves the link empty when the receipt is not on Drive', async () => {
      const { spreadsheetId } = await sheet.connect('Receipts');

      await sheet.append(spreadsheetId, session({ driveLink: '', driveFileName: '' }));

      expect(rowsByHeader(memory.tab(spreadsheetId, 'Purchases'))[0]['Receipt Link']).toBe('');
    });

    it('records the original amount and rate of a foreign-currency receipt', async () => {
      const { spreadsheetId } = await sheet.connect('Receipts');

      await sheet.append(spreadsheetId, session({ currency: 'USD', exchangeRate: 3.5 }));

      expect(rowsByHeader(memory.tab(spreadsheetId, 'Purchases'))[0]).toMatchObject({
        'Price (NIS)': '35', 'Original Amount': '10.00 USD', 'Exchange Rate': '3.5',
      });
    });

    it('links each ReceiptItem to its row and date-formats the new rows', async () => {
      const { spreadsheetId } = await sheet.connect('Receipts');
      await sheet.append(spreadsheetId, session());

      const appended = await sheet.append(spreadsheetId, session());

      const link = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
      expect(appended).toEqual({
        spreadsheetLink: link,
        itemLinks: { i1: `${link}#gid=0&range=A4`, i2: `${link}#gid=0&range=A5` },
      });
      expect(memory.dateFormats.at(-1)).toEqual({
        spreadsheetId, sheetId: 0, column: 0, rows: { firstRow: 4, lastRow: 5 }, sheetsPattern: 'dd/mm/yyyy',
      });
    });

    it('leaves the header row of an existing sheet as it is', async () => {
      memory.seed('old', { name: 'Receipts', tabs: [{ sheetId: 0, title: 'Purchases', rows: [headerRow(OLD_HEADERS)] }] });

      await sheet.append('old', session());

      expect(memory.tab('old', 'Purchases')[0]).toEqual(OLD_HEADERS);
    });

    it('writes to the Purchases tab and links to it, wherever it sits', async () => {
      memory.seed('multi', {
        name: 'Receipts',
        tabs: [
          { sheetId: 0, title: 'Summary', rows: [] },
          { sheetId: 77, title: 'Purchases', rows: [headerRow(OLD_HEADERS)] },
        ],
      });

      const { itemLinks } = await sheet.append('multi', session());

      expect(memory.tab('multi', 'Purchases')).toHaveLength(3);
      expect(memory.tab('multi', 'Summary')).toHaveLength(0);
      expect(itemLinks?.i1).toMatch(/#gid=77&range=A2$/);
    });

    it('writes to the first tab when none is called Purchases', async () => {
      memory.seed('renamed', { name: 'Receipts', tabs: [{ sheetId: 5, title: 'קניות', rows: [headerRow(OLD_HEADERS)] }] });

      const { itemLinks } = await sheet.append('renamed', session());

      expect(memory.tab('renamed', 'קניות')).toHaveLength(3);
      expect(itemLinks?.i1).toMatch(/#gid=5&range=A2$/);
    });

    it.each([
      ['an explicit DATE format', { value: '12/05/2024', numberFormat: { type: 'DATE', pattern: 'yyyy-mm-dd' } }, 'iw_IL', '2024-05-20', 'yyyy-mm-dd'],
      ['a day-first date', text('15/04/2024'), 'en_US', '20/05/2024', 'dd/mm/yyyy'],
      ['a month-first date', text('04/15/2024'), 'iw_IL', '05/20/2024', 'mm/dd/yyyy'],
      ['an ambiguous date in a US sheet', text('03/04/2024'), 'en_US', '05/20/2024', 'mm/dd/yyyy'],
      ['an ambiguous date elsewhere', text('03/04/2024'), 'iw_IL', '20/05/2024', 'dd/mm/yyyy'],
      ['an ISO date', text('2024-01-02'), 'iw_IL', '2024-05-20', 'yyyy-mm-dd'],
      ['a slashed year-first date', text('2024/01/02'), 'iw_IL', '2024/05/20', 'yyyy/mm/dd'],
      ['a dotted date', text('02.01.2024'), 'iw_IL', '20.05.2024', 'dd.mm.yyyy'],
      ['a dashed date', text('02-01-2024'), 'iw_IL', '20-05-2024', 'dd-mm-yyyy'],
      ['a dotted DATE format', { value: 'x', numberFormat: { type: 'DATE_TIME', pattern: 'dd.mm.yyyy hh:mm' } }, 'iw_IL', '20.05.2024', 'dd.mm.yyyy hh:mm'],
      ['a month-first DATE format', { value: 'x', numberFormat: { type: 'DATE', pattern: 'm/d/yy' } }, 'iw_IL', '05/20/2024', 'm/d/yy'],
    ])('matches %s already in the sheet', async (_name, existing, locale, written, sheetsPattern) => {
      memory.seed('dated', { name: 'Receipts', locale, tabs: [{ sheetId: 3, title: 'Purchases', rows: [headerRow(OLD_HEADERS), [existing]] }] });

      await sheet.append('dated', session());

      expect(memory.tab('dated', 'Purchases')[2][0]).toBe(written);
      expect(memory.dateFormats.at(-1)?.sheetsPattern).toBe(sheetsPattern);
    });

    it('finds the date column by its header, in Hebrew too', async () => {
      memory.seed('hebrew', {
        name: 'Receipts',
        tabs: [{ sheetId: 0, title: 'Purchases', rows: [[text('חנות'), text('תאריך')], [text('x'), text('2024-01-02')]] }],
      });

      await sheet.append('hebrew', session());

      expect(memory.dateFormats.at(-1)).toMatchObject({ column: 1, sheetsPattern: 'yyyy-mm-dd' });
    });

    it.each([
      ['en_US', '05/20/2024'],
      ['iw_IL', '20/05/2024'],
    ])('follows the %s locale when no date is in the sheet yet', async (locale, written) => {
      memory.seed('empty', { name: 'Receipts', locale, tabs: [{ sheetId: 0, title: 'Purchases', rows: [] }] });

      await sheet.append('empty', session());

      expect(memory.tab('empty', 'Purchases')[0][0]).toBe(written);
    });

    it('follows the locale when the rows cannot be read', async () => {
      memory.seed('unreadable', { name: 'Receipts', locale: 'en_US', tabs: [{ sheetId: 0, title: 'Purchases', rows: [] }] });
      sheet = createPurchasesSheet({ ...memory, readTop: async () => { throw new Error('forbidden'); } });

      await sheet.append('unreadable', session());

      expect(memory.tab('unreadable', 'Purchases')[0][0]).toBe('05/20/2024');
    });

    it('falls back to the Purchases tab and the default format, without row links, when the sheet cannot be described', async () => {
      memory.seed('opaque', { name: 'Receipts', tabs: [{ sheetId: 9, title: 'Purchases', rows: [] }] });
      sheet = createPurchasesSheet({ ...memory, describe: async () => { throw new Error('forbidden'); } });

      const appended = await sheet.append('opaque', session());

      expect(memory.tab('opaque', 'Purchases')[0][0]).toBe('20/05/2024');
      expect(appended).toEqual({ spreadsheetLink: 'https://docs.google.com/spreadsheets/d/opaque/edit' });
      expect(memory.dateFormats).toEqual([]);
    });

    it('returns no row links when the adapter cannot say where the rows landed', async () => {
      const { spreadsheetId } = await sheet.connect('Receipts');
      sheet = createPurchasesSheet({ ...memory, append: async () => null });

      expect(await sheet.append(spreadsheetId, session())).toEqual({
        spreadsheetLink: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      });
    });

    it('still appends when the date format cannot be applied', async () => {
      const { spreadsheetId } = await sheet.connect('Receipts');
      sheet = createPurchasesSheet({ ...memory, formatDates: async () => { throw new Error('quota'); } });

      await expect(sheet.append(spreadsheetId, session())).resolves.toHaveProperty('itemLinks');
    });

    it('lets an append failure through with its status', async () => {
      await expect(sheet.append('missing', session())).rejects.toMatchObject({ status: 404 });
    });
  });
});
