import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createReceiptsSpreadsheet, appendToSpreadsheet, detectSpreadsheetDateFormat, ensureDateColumnFormat } from './sheetsService';

describe('sheetsService', () => {
  const mockToken = 'mock-token';

  let fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  it('createReceiptsSpreadsheet returns spreadsheet ID', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ spreadsheetId: 'sheet-123', sheets: [{ properties: { sheetId: 0 } }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

    const spreadsheetId = await createReceiptsSpreadsheet(mockToken);
    expect(spreadsheetId).toBe('sheet-123');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Receipts Database')
      })
    );
  });

  it('detectSpreadsheetDateFormat detects existing date format from numberFormat', async () => {
    // 1. Metadata response
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        properties: { locale: 'iw_IL' },
        sheets: [{ properties: { sheetId: 10, title: 'Purchases' } }]
      }),
    });

    // 2. Grid data response with explicit numberFormat
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        sheets: [
          {
            properties: { sheetId: 10, title: 'Purchases' },
            data: [
              {
                rowData: [
                  { values: [{ formattedValue: 'Date' }, { formattedValue: 'Store' }] },
                  {
                    values: [
                      {
                        formattedValue: '2024-05-12',
                        effectiveFormat: {
                          numberFormat: { type: 'DATE', pattern: 'yyyy-mm-dd' }
                        }
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }),
    });

    const info = await detectSpreadsheetDateFormat(mockToken, 'sheet-123', 'Purchases');
    expect(info.pattern).toBe('YYYY-MM-DD');
    expect(info.sheetsPattern).toBe('yyyy-mm-dd');
    expect(info.columnIndex).toBe(0);
    expect(info.sheetId).toBe(10);
  });

  it('detectSpreadsheetDateFormat detects existing date format from formattedValue string', async () => {
    // 1. Metadata response
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        properties: { locale: 'iw_IL' },
        sheets: [{ properties: { sheetId: 0, title: 'Purchases' } }]
      }),
    });

    // 2. Grid data response with formattedValue
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        sheets: [
          {
            properties: { sheetId: 0, title: 'Purchases' },
            data: [
              {
                rowData: [
                  { values: [{ formattedValue: 'Date' }] },
                  { values: [{ formattedValue: '15/04/2024' }] }
                ]
              }
            ]
          }
        ]
      }),
    });

    const info = await detectSpreadsheetDateFormat(mockToken, 'sheet-123', 'Purchases');
    expect(info.pattern).toBe('DD/MM/YYYY');
    expect(info.sheetsPattern).toBe('dd/mm/yyyy');
  });

  it('detectSpreadsheetDateFormat falls back to US locale format when sheet is empty', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        properties: { locale: 'en_US' },
        sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }]
      }),
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        sheets: [{ data: [{ rowData: [] }] }]
      }),
    });

    const info = await detectSpreadsheetDateFormat(mockToken, 'sheet-123');
    expect(info.pattern).toBe('MM/DD/YYYY');
    expect(info.sheetsPattern).toBe('mm/dd/yyyy');
  });

  it('ensureDateColumnFormat sends batchUpdate request with DATE numberFormat', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await ensureDateColumnFormat(mockToken, 'sheet-123', 0, 0, 'dd/mm/yyyy', 5, 8);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('sheet-123:batchUpdate'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"type":"DATE"')
      })
    );
  });

  it('appendToSpreadsheet appends rows correctly', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const rows = [['2024-01-01', 'Store', 'Item', 10]];
    await appendToSpreadsheet(mockToken, 'sheet-123', rows);
    
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('sheet-123/values/Purchases!A1:append'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ values: rows })
      })
    );
  });

  it('throws error if spreadsheet creation fails', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'Quota exceeded' } }),
    });

    await expect(createReceiptsSpreadsheet(mockToken)).rejects.toThrow('Quota exceeded');
  });
});
