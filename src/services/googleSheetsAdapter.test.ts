import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGoogleSheetsAdapter } from './googleSheetsAdapter';
import { GoogleApiError } from './googleApiError';

const ok = (body: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });
const failing = (status: number, message?: string) => ({
  ok: false,
  status,
  json: () => Promise.resolve(message ? { error: { message } } : {}),
});

describe('Google Sheets adapter', () => {
  let fetchMock = vi.fn();
  const adapter = createGoogleSheetsAdapter('mock-token');

  const sentBody = (call = 0) => JSON.parse(fetchMock.mock.calls[call][1].body);
  const sentUrl = (call = 0) => decodeURIComponent(fetchMock.mock.calls[call][0]);

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  it('finds a spreadsheet by name through Drive', async () => {
    fetchMock.mockResolvedValueOnce(ok({ files: [{ id: 'sheet-1' }] }));

    expect(await adapter.findByName('Receipts')).toBe('sheet-1');
    expect(sentUrl()).toContain("name = 'Receipts'");
  });

  it('creates a spreadsheet with a frozen header row in the given locale', async () => {
    fetchMock.mockResolvedValueOnce(ok({ spreadsheetId: 'sheet-1', sheets: [{ properties: { sheetId: 42 } }] }));

    const created = await adapter.create('Receipts', { title: 'Purchases', headers: ['Date', 'Store'], locale: 'iw_IL' });

    expect(created).toEqual({ spreadsheetId: 'sheet-1', sheetId: 42 });
    const body = sentBody();
    expect(body.properties).toEqual({ title: 'Receipts', locale: 'iw_IL' });
    expect(body.sheets[0].properties).toEqual({ title: 'Purchases', gridProperties: { frozenRowCount: 1 } });
    expect(body.sheets[0].data[0].rowData[0].values.map((v: { userEnteredValue: { stringValue: string } }) => v.userEnteredValue.stringValue))
      .toEqual(['Date', 'Store']);
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' });
  });

  it('fails a create with the API message and status', async () => {
    fetchMock.mockResolvedValueOnce(failing(429, 'Quota exceeded'));

    const failure = adapter.create('Receipts', { title: 'Purchases', headers: [], locale: 'iw_IL' });
    await expect(failure).rejects.toBeInstanceOf(GoogleApiError);
    await expect(failure).rejects.toMatchObject({ message: 'Quota exceeded', status: 429 });
  });

  it('describes the locale and tabs', async () => {
    fetchMock.mockResolvedValueOnce(ok({
      properties: { locale: 'en_US' },
      sheets: [{ properties: { sheetId: 0, title: 'Summary' } }, { properties: { sheetId: 7, title: 'Purchases' } }, {}],
    }));

    expect(await adapter.describe('sheet-1')).toEqual({
      locale: 'en_US',
      tabs: [{ sheetId: 0, title: 'Summary' }, { sheetId: 7, title: 'Purchases' }],
    });
  });

  it('fails a describe it was refused', async () => {
    fetchMock.mockResolvedValueOnce(failing(403));

    await expect(adapter.describe('sheet-1')).rejects.toMatchObject({ message: 'Failed to read spreadsheet', status: 403 });
  });

  it('reads the top rows of a tab as shown, with their number formats', async () => {
    fetchMock.mockResolvedValueOnce(ok({
      sheets: [{ data: [{ rowData: [
        { values: [{ userEnteredValue: { stringValue: 'Date' } }] },
        { values: [{ formattedValue: '2024-05-12', userEnteredFormat: { numberFormat: { type: 'TEXT' } }, effectiveFormat: { numberFormat: { type: 'DATE', pattern: 'yyyy-mm-dd' } } }] },
        { values: [{ formattedValue: '1/2/2024', userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'd/m/yyyy' } } }] },
        {},
      ] }] }],
    }));

    const rows = await adapter.readTop('sheet-1', "Bob's tab", 25);

    expect(rows).toEqual([
      [{ value: 'Date', numberFormat: undefined }],
      [{ value: '2024-05-12', numberFormat: { type: 'DATE', pattern: 'yyyy-mm-dd' } }],
      [{ value: '1/2/2024', numberFormat: { type: 'DATE', pattern: 'd/m/yyyy' } }],
      [],
    ]);
    expect(sentUrl()).toContain("ranges='Bob''s tab'!A1:Z25");
  });

  it('reads no rows from an empty tab', async () => {
    fetchMock.mockResolvedValueOnce(ok({ sheets: [{ data: [{}] }] }));

    expect(await adapter.readTop('sheet-1', 'Purchases', 25)).toEqual([]);
  });

  it('fails a read it was refused', async () => {
    fetchMock.mockResolvedValueOnce(failing(500));

    await expect(adapter.readTop('sheet-1', 'Purchases', 25)).rejects.toMatchObject({ status: 500 });
  });

  it.each([
    ["'Purchases'!A10:J12", { firstRow: 10, lastRow: 12 }],
    ['Purchases!A5:J5', { firstRow: 5, lastRow: 5 }],
    ['Purchases!A7', { firstRow: 7, lastRow: 7 }],
    ['', null],
  ])('appends rows to the tab and reads where they landed from %j', async (updatedRange, span) => {
    fetchMock.mockResolvedValueOnce(ok({ updates: { updatedRange } }));

    const rows = [['2024-01-01', 'Store', 'Item', 10]];
    expect(await adapter.append('sheet-1', 'Purchases', rows)).toEqual(span);
    expect(sentUrl()).toContain("sheet-1/values/'Purchases'!A1:append?valueInputOption=USER_ENTERED");
    expect(sentBody()).toEqual({ values: rows });
  });

  it('fails an append with its status, so an expired token is recognisable', async () => {
    fetchMock.mockResolvedValueOnce(failing(401, 'Request had invalid authentication credentials.'));

    const failure = adapter.append('sheet-1', 'Purchases', []);
    await expect(failure).rejects.toBeInstanceOf(GoogleApiError);
    await expect(failure).rejects.toMatchObject({ status: 401 });
  });

  it('date-formats the given rows, converting to the API row indexes', async () => {
    fetchMock.mockResolvedValueOnce(ok({}));

    await adapter.formatDates('sheet-1', { sheetId: 3, column: 2, rows: { firstRow: 5, lastRow: 8 } }, 'dd/mm/yyyy');

    expect(sentUrl()).toContain('sheet-1:batchUpdate');
    expect(sentBody().requests[0].repeatCell).toEqual({
      range: { sheetId: 3, startColumnIndex: 2, endColumnIndex: 3, startRowIndex: 4, endRowIndex: 8 },
      cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'dd/mm/yyyy' } } },
      fields: 'userEnteredFormat.numberFormat',
    });
  });

  it('date-formats the whole column below the header when no rows are given', async () => {
    fetchMock.mockResolvedValueOnce(ok({}));

    await adapter.formatDates('sheet-1', { sheetId: 0, column: 0 }, 'dd/mm/yyyy');

    expect(sentBody().requests[0].repeatCell.range).toEqual({ sheetId: 0, startColumnIndex: 0, endColumnIndex: 1, startRowIndex: 1 });
  });

  it('fails a date format it was refused', async () => {
    fetchMock.mockResolvedValueOnce(failing(400, 'Invalid pattern'));

    await expect(adapter.formatDates('sheet-1', { sheetId: 0, column: 0 }, 'zz')).rejects.toThrow('Invalid pattern');
  });
});
