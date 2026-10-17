import { findSpreadsheetByName } from './driveService';
import { GoogleApiError } from './googleApiError';
import type { SheetCell, SpreadsheetAdapter } from './purchasesSheet';

const SHEETS_API_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

// Only the fields this adapter asks the Sheets API for.
interface NumberFormat {
  type?: string;
  pattern?: string;
}

interface ApiCell {
  formattedValue?: string;
  userEnteredValue?: { stringValue?: string };
  userEnteredFormat?: { numberFormat?: NumberFormat };
  effectiveFormat?: { numberFormat?: NumberFormat };
}

interface ApiRow {
  values?: ApiCell[];
}

interface ApiTab {
  properties?: { sheetId?: number; title?: string };
}

/** Quotes a tab title for an A1 range, so titles with spaces or quotes work. */
const a1 = (tabTitle: string, cells: string) => `'${tabTitle.replace(/'/g, "''")}'!${cells}`;

/** Fails with the API's message and the HTTP status, so 401s can be told apart. */
const failed = async (response: Response, fallback: string) => {
  const body = await response.json().catch(() => ({}));
  return new GoogleApiError(body.error?.message || fallback, response.status);
};

/** The rows an append wrote, from an updated range like `'Purchases'!A10:J12`. */
const spanOf = (updatedRange: string) => {
  const match = updatedRange.match(/![A-Z]+(\d+)(?::[A-Z]+(\d+))?$/);
  if (!match) return null;
  const firstRow = parseInt(match[1], 10);
  return { firstRow, lastRow: match[2] ? parseInt(match[2], 10) : firstRow };
};

const toCell = (cell: ApiCell | undefined): SheetCell => ({
  value: String(cell?.formattedValue ?? cell?.userEnteredValue?.stringValue ?? ''),
  numberFormat: cell?.effectiveFormat?.numberFormat ?? cell?.userEnteredFormat?.numberFormat,
});

export const createGoogleSheetsAdapter = (token: string): SpreadsheetAdapter => {
  const call = (url: string, init: RequestInit = {}) =>
    fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    });

  return {
    findByName: (name) => findSpreadsheetByName(token, name),

    create: async (name, { title, headers, locale }) => {
      const response = await call(SHEETS_API_URL, {
        method: 'POST',
        body: JSON.stringify({
          properties: { title: name, locale },
          sheets: [
            {
              properties: { title, gridProperties: { frozenRowCount: 1 } },
              data: [{ startRow: 0, startColumn: 0, rowData: [{ values: headers.map((h) => ({ userEnteredValue: { stringValue: h } })) }] }],
            },
          ],
        }),
      });
      if (!response.ok) throw await failed(response, 'Failed to create spreadsheet');

      const data = await response.json();
      return { spreadsheetId: data.spreadsheetId, sheetId: data.sheets?.[0]?.properties?.sheetId ?? 0 };
    },

    describe: async (spreadsheetId) => {
      const response = await call(`${SHEETS_API_URL}/${spreadsheetId}?fields=properties.locale,sheets.properties(sheetId,title)`);
      if (!response.ok) throw await failed(response, 'Failed to read spreadsheet');

      const meta = await response.json();
      const tabs = ((meta.sheets || []) as ApiTab[])
        .filter((t) => t.properties?.title !== undefined)
        .map((t) => ({ sheetId: t.properties?.sheetId ?? 0, title: t.properties?.title ?? '' }));
      return { locale: meta.properties?.locale || '', tabs };
    },

    readTop: async (spreadsheetId, tabTitle, rowCount) => {
      const range = encodeURIComponent(a1(tabTitle, `A1:Z${rowCount}`));
      const fields = 'sheets(data(rowData(values(userEnteredFormat.numberFormat,effectiveFormat.numberFormat,formattedValue,userEnteredValue))))';
      const response = await call(`${SHEETS_API_URL}/${spreadsheetId}?ranges=${range}&fields=${fields}`);
      if (!response.ok) throw await failed(response, 'Failed to read spreadsheet rows');

      const data = await response.json();
      const rows: ApiRow[] = data.sheets?.[0]?.data?.[0]?.rowData || [];
      return rows.map((row) => (row.values || []).map(toCell));
    },

    append: async (spreadsheetId, tabTitle, rows) => {
      const range = encodeURIComponent(a1(tabTitle, 'A1'));
      const response = await call(`${SHEETS_API_URL}/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, {
        method: 'POST',
        body: JSON.stringify({ values: rows }),
      });
      if (!response.ok) throw await failed(response, 'Failed to append to spreadsheet');

      const data = await response.json();
      return spanOf(data.updates?.updatedRange || '');
    },

    formatDates: async (spreadsheetId, { sheetId, column, rows }, sheetsPattern) => {
      // The API's row indexes are 0-based and end-exclusive; without rows, start below the header.
      const range = {
        sheetId,
        startColumnIndex: column,
        endColumnIndex: column + 1,
        ...(rows ? { startRowIndex: rows.firstRow - 1, endRowIndex: rows.lastRow } : { startRowIndex: 1 }),
      };
      const response = await call(`${SHEETS_API_URL}/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({
          requests: [
            {
              repeatCell: {
                range,
                cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: sheetsPattern } } },
                fields: 'userEnteredFormat.numberFormat',
              },
            },
          ],
        }),
      });
      if (!response.ok) throw await failed(response, 'Failed to apply date format');
    },
  };
};
