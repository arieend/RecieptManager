import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createReceiptsSpreadsheet, appendToSpreadsheet } from './sheetsService';

describe('sheetsService', () => {
  const mockToken = 'mock-token';

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('createReceiptsSpreadsheet returns spreadsheet ID', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ spreadsheetId: 'sheet-123' }),
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

  it('appendToSpreadsheet appends rows correctly', async () => {
    (global.fetch as any).mockResolvedValueOnce({
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
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'Quota exceeded' } }),
    });

    await expect(createReceiptsSpreadsheet(mockToken)).rejects.toThrow('Quota exceeded');
  });
});
