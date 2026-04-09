
const SHEETS_API_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

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
  return data.spreadsheetId;
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
