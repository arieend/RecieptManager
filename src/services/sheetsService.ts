
const SHEETS_API_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

export interface SheetDateFormatInfo {
  pattern: string; // e.g., 'DD/MM/YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY', 'DD.MM.YYYY'
  sheetsPattern: string; // e.g., 'dd/mm/yyyy', 'yyyy-mm-dd'
  columnIndex: number;
  sheetId?: number;
  sheetTitle: string;
}

export const createReceiptsSpreadsheet = async (token: string, title: string = 'Receipts Database'): Promise<string> => {
  const response = await fetch(SHEETS_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
        locale: 'iw_IL',
      },
      sheets: [
        {
          properties: {
            title: 'Purchases',
            gridProperties: {
              frozenRowCount: 1,
            },
          },
          data: [
            {
              startRow: 0,
              startColumn: 0,
              rowData: [
                {
                  values: [
                    { userEnteredValue: { stringValue: 'Date' } },
                    { userEnteredValue: { stringValue: 'Store' } },
                    { userEnteredValue: { stringValue: 'Item Name' } },
                    { userEnteredValue: { stringValue: 'Price (NIS)' } },
                    { userEnteredValue: { stringValue: 'Category' } },
                    { userEnteredValue: { stringValue: 'AI Tags' } },
                    { userEnteredValue: { stringValue: 'Labels' } },
                    { userEnteredValue: { stringValue: 'Receipt Link' } },
                    { userEnteredValue: { stringValue: 'Original Amount' } },
                    { userEnteredValue: { stringValue: 'Exchange Rate' } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to create spreadsheet');
  }

  const data = await response.json();
  const spreadsheetId = data.spreadsheetId;

  // Apply default Date numberFormat to Column A
  try {
    const sheetId = data.sheets?.[0]?.properties?.sheetId || 0;
    await ensureDateColumnFormat(token, spreadsheetId, sheetId, 0, 'dd/mm/yyyy');
  } catch (formatErr) {
    console.warn("Could not set initial date format on new spreadsheet:", formatErr);
  }

  return spreadsheetId;
};

/**
 * Normalizes Google Sheets number format pattern strings to standard application patterns.
 */
const normalizeSheetsPattern = (sheetsPattern: string): string => {
  const p = sheetsPattern.toLowerCase();
  if (p.includes('yyyy') && p.includes('mm') && p.includes('dd')) {
    if (p.indexOf('yyyy') < p.indexOf('mm')) {
      return p.includes('/') ? 'YYYY/MM/DD' : 'YYYY-MM-DD';
    }
    if (p.indexOf('dd') < p.indexOf('mm')) {
      if (p.includes('.')) return 'DD.MM.YYYY';
      if (p.includes('-')) return 'DD-MM-YYYY';
      return 'DD/MM/YYYY';
    }
    return 'MM/DD/YYYY';
  }
  if (p.includes('d') && p.includes('m') && (p.includes('yy') || p.includes('yyyy'))) {
    if (p.indexOf('d') < p.indexOf('m')) {
      if (p.includes('.')) return 'DD.MM.YYYY';
      if (p.includes('-')) return 'DD-MM-YYYY';
      return 'DD/MM/YYYY';
    }
    return 'MM/DD/YYYY';
  }
  return 'DD/MM/YYYY';
};

/**
 * Detects date pattern from existing formatted cell string values.
 */
const detectPatternFromString = (str: string, locale?: string): { pattern: string; sheetsPattern: string } | null => {
  const trimmed = str.trim();

  // ISO date: YYYY-MM-DD or YYYY/MM/DD
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(trimmed)) {
    const sep = trimmed.includes('/') ? '/' : '-';
    return {
      pattern: sep === '/' ? 'YYYY/MM/DD' : 'YYYY-MM-DD',
      sheetsPattern: sep === '/' ? 'yyyy/mm/dd' : 'yyyy-mm-dd',
    };
  }

  // Dots: DD.MM.YYYY
  if (/^\d{1,2}\.\d{1,2}\.\d{4}/.test(trimmed)) {
    return { pattern: 'DD.MM.YYYY', sheetsPattern: 'dd.mm.yyyy' };
  }

  // Hyphens: DD-MM-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{4}/.test(trimmed)) {
    return { pattern: 'DD-MM-YYYY', sheetsPattern: 'dd-mm-yyyy' };
  }

  // Slashes: DD/MM/YYYY or MM/DD/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const p1 = parseInt(slashMatch[1], 10);
    const p2 = parseInt(slashMatch[2], 10);
    if (p1 > 12) {
      // First number is > 12, must be day: DD/MM/YYYY
      return { pattern: 'DD/MM/YYYY', sheetsPattern: 'dd/mm/yyyy' };
    }
    if (p2 > 12) {
      // Second number is > 12, must be day: MM/DD/YYYY
      return { pattern: 'MM/DD/YYYY', sheetsPattern: 'mm/dd/yyyy' };
    }
    // Ambiguous (both <= 12): rely on locale
    if (locale && (locale.toLowerCase().startsWith('en_us') || locale.toLowerCase() === 'en-us')) {
      return { pattern: 'MM/DD/YYYY', sheetsPattern: 'mm/dd/yyyy' };
    }
    return { pattern: 'DD/MM/YYYY', sheetsPattern: 'dd/mm/yyyy' };
  }

  return null;
};

/**
 * Derives default date format from spreadsheet locale.
 */
const deriveFormatFromLocale = (locale: string, defaultInfo: SheetDateFormatInfo): SheetDateFormatInfo => {
  const l = (locale || '').toLowerCase();
  if (l.startsWith('en_us') || l === 'en-us') {
    return {
      ...defaultInfo,
      pattern: 'MM/DD/YYYY',
      sheetsPattern: 'mm/dd/yyyy',
    };
  }
  return defaultInfo;
};

/**
 * Inspects the recipient Google Spreadsheet to determine the format of the 'Date' column.
 * Inspects existing rows, column formatting, and spreadsheet locale.
 */
export const detectSpreadsheetDateFormat = async (
  token: string,
  spreadsheetId: string,
  preferredSheetTitle: string = 'Purchases'
): Promise<SheetDateFormatInfo> => {
  const defaultInfo: SheetDateFormatInfo = {
    pattern: 'DD/MM/YYYY',
    sheetsPattern: 'dd/mm/yyyy',
    columnIndex: 0,
    sheetTitle: preferredSheetTitle,
  };

  try {
    // 1. Fetch spreadsheet metadata (sheets and locale)
    const metaUrl = `${SHEETS_API_URL}/${spreadsheetId}?fields=properties.locale,sheets.properties(sheetId,title)`;
    const metaRes = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!metaRes.ok) {
      return defaultInfo;
    }

    const meta = await metaRes.json();
    const sheetsList = meta.sheets || [];
    const locale: string = meta.properties?.locale || '';

    // Determine target sheet
    let targetSheet = sheetsList.find((s: any) => s.properties?.title?.toLowerCase() === preferredSheetTitle.toLowerCase());
    if (!targetSheet && sheetsList.length > 0) {
      targetSheet = sheetsList[0];
    }

    const sheetTitle = targetSheet?.properties?.title || preferredSheetTitle;
    const sheetId = targetSheet?.properties?.sheetId;
    defaultInfo.sheetTitle = sheetTitle;
    defaultInfo.sheetId = sheetId;

    // 2. Fetch sample grid data from the sheet (up to 25 rows)
    const dataUrl = `${SHEETS_API_URL}/${spreadsheetId}?ranges=${encodeURIComponent(sheetTitle)}!A1:Z25&fields=sheets(properties(sheetId,title),data(rowData(values(userEnteredFormat.numberFormat,effectiveFormat.numberFormat,formattedValue,userEnteredValue))))`;
    const dataRes = await fetch(dataUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!dataRes.ok) {
      return deriveFormatFromLocale(locale, defaultInfo);
    }

    const dataJson = await dataRes.json();
    const sheetData = dataJson.sheets?.[0]?.data?.[0];
    const rowData: any[] = sheetData?.rowData || [];

    if (rowData.length === 0) {
      return deriveFormatFromLocale(locale, defaultInfo);
    }

    // 3. Find Date column index from header row
    let dateColumnIndex = 0;
    const headerRow = rowData[0]?.values || [];
    for (let c = 0; c < headerRow.length; c++) {
      const headerVal = String(headerRow[c]?.formattedValue || headerRow[c]?.userEnteredValue?.stringValue || '').trim().toLowerCase();
      if (headerVal === 'date' || headerVal === 'תאריך' || headerVal.includes('date') || headerVal.includes('תאריך')) {
        dateColumnIndex = c;
        break;
      }
    }
    defaultInfo.columnIndex = dateColumnIndex;

    // 4. Inspect rows 1..N at dateColumnIndex for existing Date format or value
    for (let r = 1; r < rowData.length; r++) {
      const cell = rowData[r]?.values?.[dateColumnIndex];
      if (!cell) continue;

      // Check explicit numberFormat
      const numFormat = cell.effectiveFormat?.numberFormat || cell.userEnteredFormat?.numberFormat;
      if (numFormat && (numFormat.type === 'DATE' || numFormat.type === 'DATE_TIME') && numFormat.pattern) {
        const pattern = normalizeSheetsPattern(numFormat.pattern);
        if (pattern) {
          return {
            pattern,
            sheetsPattern: numFormat.pattern,
            columnIndex: dateColumnIndex,
            sheetId,
            sheetTitle,
          };
        }
      }

      // Check formattedValue for pattern
      const formatted = String(cell.formattedValue || '').trim();
      if (formatted && formatted.toLowerCase() !== 'date' && formatted !== 'תאריך') {
        const detected = detectPatternFromString(formatted, locale);
        if (detected) {
          return {
            pattern: detected.pattern,
            sheetsPattern: detected.sheetsPattern,
            columnIndex: dateColumnIndex,
            sheetId,
            sheetTitle,
          };
        }
      }
    }

    // 5. If no data rows found, derive from spreadsheet locale
    return deriveFormatFromLocale(locale, defaultInfo);
  } catch (err) {
    console.warn("Error detecting spreadsheet date format:", err);
    return defaultInfo;
  }
};

/**
 * Ensures the target cell range or Date column in Google Sheets has an explicit DATE numberFormat.
 */
export const ensureDateColumnFormat = async (
  token: string,
  spreadsheetId: string,
  sheetId: number,
  columnIndex: number = 0,
  sheetsPattern: string = 'dd/mm/yyyy',
  startRowIndex?: number,
  endRowIndex?: number
): Promise<void> => {
  try {
    const range: any = {
      sheetId,
      startColumnIndex: columnIndex,
      endColumnIndex: columnIndex + 1,
    };
    if (typeof startRowIndex === 'number' && typeof endRowIndex === 'number') {
      range.startRowIndex = startRowIndex;
      range.endRowIndex = endRowIndex;
    } else {
      range.startRowIndex = 1; // Start below header
    }

    await fetch(`${SHEETS_API_URL}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range,
              cell: {
                userEnteredFormat: {
                  numberFormat: {
                    type: 'DATE',
                    pattern: sheetsPattern,
                  },
                },
              },
              fields: 'userEnteredFormat.numberFormat',
            },
          },
        ],
      }),
    });
  } catch (err) {
    console.warn("Failed to apply date numberFormat:", err);
  }
};

export const appendToSpreadsheet = async (
  token: string,
  spreadsheetId: string,
  rows: any[][]
): Promise<string> => {
  const range = 'Purchases!A1';
  const response = await fetch(
    `${SHEETS_API_URL}/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: rows,
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to append to spreadsheet');
  }

  const data = await response.json();
  return data.updates?.updatedRange || '';
};
