import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncToCloud } from './syncService';
import { Session } from '../types';
import { StorageSettings } from './configService';
import * as driveService from './driveService';
import * as sheetsService from './sheetsService';

vi.mock('./driveService');
vi.mock('./sheetsService');

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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('syncs to Drive and Sheets correctly', async () => {
    vi.mocked(driveService.getOrCreateFolderPath).mockResolvedValue('folder-123');
    vi.mocked(driveService.uploadFileToDrive).mockResolvedValue({
      id: 'file-123',
      name: 'Test_Store_20240101_10.00.jpg',
      webViewLink: 'http://link'
    });
    vi.mocked(sheetsService.appendToSpreadsheet).mockResolvedValue('Purchases!A10:J10');

    const result = await syncToCloud(mockSession, mockSettings, mockToken);

    expect(result.driveFileId).toBe('file-123');
    expect(result.driveLink).toBe('http://link');
    expect(driveService.uploadFileToDrive).toHaveBeenCalled();
    expect(sheetsService.appendToSpreadsheet).toHaveBeenCalledWith(
      mockToken,
      'sheet-123',
      expect.arrayContaining([
        expect.arrayContaining([
          expect.stringMatching(/^\d{2}\/\d{2}\/\d{4}$/),
          'Test Store',
          'Item 1',
          10,
          'Food',
          'Tag1',
          'Person 1',
          expect.stringContaining('HYPERLINK')
        ])
      ])
    );
  });

  it('creates a new spreadsheet if ID is missing and not found by name', async () => {
    const settingsWithoutSheet = { ...mockSettings, spreadsheetId: '' };
    vi.mocked(driveService.findSpreadsheetByName).mockResolvedValue(null);
    vi.mocked(sheetsService.createReceiptsSpreadsheet).mockResolvedValue('new-sheet-456');
    vi.mocked(sheetsService.appendToSpreadsheet).mockResolvedValue('Purchases!A10:J10');

    const result = await syncToCloud(mockSession, settingsWithoutSheet, mockToken);

    expect(result.spreadsheetId).toBe('new-sheet-456');
    expect(driveService.findSpreadsheetByName).toHaveBeenCalledWith(mockToken, mockSettings.spreadsheetName);
    expect(sheetsService.createReceiptsSpreadsheet).toHaveBeenCalledWith(mockToken, mockSettings.spreadsheetName);
  });

  it('uses existing spreadsheet if found by name', async () => {
    const settingsWithoutSheet = { ...mockSettings, spreadsheetId: '' };
    vi.mocked(driveService.findSpreadsheetByName).mockResolvedValue('existing-sheet-789');
    vi.mocked(sheetsService.appendToSpreadsheet).mockResolvedValue('Purchases!A10:J10');

    const result = await syncToCloud(mockSession, settingsWithoutSheet, mockToken);

    expect(result.spreadsheetId).toBe('existing-sheet-789');
    expect(driveService.findSpreadsheetByName).toHaveBeenCalledWith(mockToken, mockSettings.spreadsheetName);
    expect(sheetsService.createReceiptsSpreadsheet).not.toHaveBeenCalled();
  });

  it('skips Drive upload if already uploaded', async () => {
    const sessionWithDrive = { ...mockSession, driveFileId: 'existing-id' };
    vi.mocked(sheetsService.appendToSpreadsheet).mockResolvedValue('Purchases!A10:J10');

    await syncToCloud(sessionWithDrive, mockSettings, mockToken);

    expect(driveService.uploadFileToDrive).not.toHaveBeenCalled();
    expect(sheetsService.appendToSpreadsheet).toHaveBeenCalled();
  });
});
