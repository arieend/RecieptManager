import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncToCloud, SheetsSyncError } from './syncService';
import { Session } from '../types';
import { StorageSettings } from './configService';
import * as driveService from './driveService';
import { createGoogleSheetsAdapter } from './googleSheetsAdapter';
import { createInMemorySpreadsheetAdapter } from './purchasesSheet';

vi.mock('./driveService');
vi.mock('./googleSheetsAdapter');

describe('syncService', () => {
  const mockToken = 'mock-token';
  const mockSettings: StorageSettings = {
    storagePath: 'Receipts',
    directories: { year: true, month: true, day: false },
    autoSave: true,
    syncToSheets: true,
    spreadsheetId: 'sheet-123',
    spreadsheetName: 'Receipts Database',
    currency: 'ILS',
    theme: 'light'
  };

  const mockSession: Session = {
    id: '1',
    userId: 'user1',
    storeName: 'Test Store',
    items: [
      { id: 'i1', name: 'Item 1', price: 10, quantity: 1, assignedTo: ['p1'], category: 'Food', labels: ['Tag1'] },
    ],
    people: [{ id: 'p1', name: 'Person 1', color: '#ff0000' }],
    tax: 0,
    tip: 0,
    total: 10,
    currency: 'ILS' as const,
    exchangeRate: 1,
    createdAt: new Date().toISOString(),
    imageUrl: 'data:image/jpeg;base64,mock',
    driveFileId: '',
    driveLink: '',
    driveFileName: '',
  };

  let sheets: ReturnType<typeof createInMemorySpreadsheetAdapter>;

  beforeEach(() => {
    sheets = createInMemorySpreadsheetAdapter();
    sheets.seed('sheet-123', { name: 'Receipts Database', tabs: [{ sheetId: 0, title: 'Purchases', rows: [] }] });
    vi.mocked(createGoogleSheetsAdapter).mockReturnValue(sheets);
    // Sessions with an image upload to Drive unless a test says otherwise.
    vi.mocked(driveService.getOrCreateFolderPath).mockResolvedValue('folder-123');
    vi.mocked(driveService.uploadFileToDrive).mockResolvedValue({
      id: 'file-123',
      name: 'Test_Store_20240101_10.00.jpg',
      webViewLink: 'http://link'
    });
  });

  it('uploads to Drive and appends to the Purchases sheet with the new link', async () => {
    const result = await syncToCloud(mockSession, mockSettings, mockToken);

    const link = 'https://docs.google.com/spreadsheets/d/sheet-123/edit';
    expect(result).toEqual({
      driveFileId: 'file-123',
      driveLink: 'http://link',
      driveFileName: 'Test_Store_20240101_10.00.jpg',
      spreadsheetLink: link,
      itemSheetsLinks: { i1: `${link}#gid=0&range=A1` },
    });
    expect(createGoogleSheetsAdapter).toHaveBeenCalledWith(mockToken);
    // Column order is the Purchases sheet's to test; here, only that this upload's link reached the row.
    const rows = sheets.tab('sheet-123', 'Purchases');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('=HYPERLINK("http://link", "Test_Store_20240101_10.00.jpg")');
  });

  it('keeps the finished Drive upload when Sheets then fails', async () => {
    const error = await syncToCloud(mockSession, { ...mockSettings, spreadsheetId: 'missing' }, mockToken).catch((e) => e);

    expect(error).toBeInstanceOf(SheetsSyncError);
    expect(error.cause).toMatchObject({ status: 404 });
    expect(error.synced).toEqual({
      driveFileId: 'file-123',
      driveLink: 'http://link',
      driveFileName: 'Test_Store_20240101_10.00.jpg',
    });
  });

  it('lets a Drive failure through as is', async () => {
    const driveFailure = new Error('Drive upload failed');
    vi.mocked(driveService.uploadFileToDrive).mockRejectedValueOnce(driveFailure);

    await expect(syncToCloud(mockSession, mockSettings, mockToken)).rejects.toBe(driveFailure);
    expect(sheets.tab('sheet-123', 'Purchases')).toEqual([]);
  });

  it('creates the spreadsheet when there is no ID and none has the name', async () => {
    const result = await syncToCloud(mockSession, { ...mockSettings, spreadsheetId: '', spreadsheetName: 'New Receipts' }, mockToken);

    expect(result.spreadsheetId).toMatch(/^memory-sheet-/);
    expect(sheets.tab(result.spreadsheetId!, 'Purchases')).toHaveLength(2);
  });

  it('uses the spreadsheet with that name when there is no ID', async () => {
    const result = await syncToCloud(mockSession, { ...mockSettings, spreadsheetId: '' }, mockToken);

    expect(result.spreadsheetId).toBe('sheet-123');
    expect(sheets.tab('sheet-123', 'Purchases')).toHaveLength(1);
  });

  it('reports a spreadsheet it created even when the append then fails', async () => {
    vi.mocked(createGoogleSheetsAdapter).mockReturnValue({
      ...sheets,
      append: async () => { throw new Error('Failed to append to spreadsheet'); },
    });

    const error = await syncToCloud(mockSession, { ...mockSettings, spreadsheetId: '', spreadsheetName: 'New Receipts' }, mockToken).catch((e) => e);

    expect(error.synced.spreadsheetId).toMatch(/^memory-sheet-/);
  });

  it.each([
    ['data:image/jpeg;base64,abc', 'jpg', 'image/jpeg'],
    ['data:application/pdf;base64,abc', 'pdf', 'application/pdf'],
    ['data:image/heic;base64,abc', 'heic', 'image/heic'],
    ['data:image/png;base64,abc', 'png', 'image/png'],
  ])('uploads %s to Drive as .%s with type %s', async (imageUrl, extension, mimeType) => {
    vi.mocked(driveService.getOrCreateFolderPath).mockResolvedValue('folder-123');
    vi.mocked(driveService.uploadFileToDrive).mockResolvedValue({ id: 'file-123', name: 'x' });

    await syncToCloud({ ...mockSession, imageUrl }, { ...mockSettings, syncToSheets: false }, mockToken);

    expect(driveService.uploadFileToDrive).toHaveBeenCalledWith(
      mockToken,
      'folder-123',
      expect.stringMatching(new RegExp(`\\.${extension}$`)),
      imageUrl,
      mimeType
    );
  });

  it('skips Drive upload if already uploaded', async () => {
    await syncToCloud({ ...mockSession, driveFileId: 'existing-id' }, mockSettings, mockToken);

    expect(driveService.uploadFileToDrive).not.toHaveBeenCalled();
    expect(sheets.tab('sheet-123', 'Purchases')).toHaveLength(1);
  });
});
