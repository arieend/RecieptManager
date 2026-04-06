import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getSettings, 
  saveSettings, 
  transliterate, 
  sanitizeFilename, 
  formatDateTimeForFilename, 
  formatDateForSheets,
  buildDirectoryPath, 
  getCurrencySymbol,
  StorageSettings
} from './configService';

describe('configService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('returns default settings when localStorage is empty', () => {
    const settings = getSettings();
    expect(settings.storagePath).toBe('Google Drive:\\Receipts');
    expect(settings.currency).toBe('ILS');
  });

  it('saves and retrieves settings correctly', () => {
    const newSettings: StorageSettings = {
      storagePath: 'My/Custom/Path',
      directories: { year: true, month: false, day: true },
      autoSave: false,
      syncToSheets: false,
      spreadsheetId: '123',
      spreadsheetName: 'Receipts Database',
      currency: 'USD'
    };
    saveSettings(newSettings);
    const retrieved = getSettings();
    expect(retrieved).toEqual(newSettings);
  });

  it('transliterates Hebrew characters correctly', () => {
    expect(transliterate('שלום')).toBe('shlvm');
    expect(transliterate('אריה')).toBe('aryh');
  });

  it('sanitizes filenames correctly', () => {
    expect(sanitizeFilename('My Receipt: 2024?')).toBe('My_Receipt__2024_');
    expect(sanitizeFilename('חשבונית אוכל')).toBe('chshbvnyt_avkl');
  });

  it('formats date time for filename correctly', () => {
    const date = new Date(2024, 0, 1, 12, 30, 45); // Jan 1, 2024, 12:30:45
    expect(formatDateTimeForFilename(date)).toBe('20240101_123045');
  });

  it('formats date for sheets correctly', () => {
    const date = new Date(2024, 0, 1); // Jan 1, 2024
    expect(formatDateForSheets(date)).toBe('01/01/2024');
    
    const date2 = new Date(2024, 11, 31); // Dec 31, 2024
    expect(formatDateForSheets(date2)).toBe('31/12/2024');
  });

  it('builds directory path correctly', () => {
    const settings: StorageSettings = {
      storagePath: 'Google Drive:\\Receipts',
      directories: { year: true, month: true, day: true },
      autoSave: true,
      syncToSheets: true,
      spreadsheetId: '',
      spreadsheetName: 'Receipts Database',
      currency: 'ILS'
    };
    const date = new Date(2024, 5, 15); // June 15, 2024
    const path = buildDirectoryPath(settings, date);
    expect(path).toEqual(['Receipts', '2024', '06', '15']);
  });

  it('returns correct currency symbols', () => {
    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencySymbol('ILS')).toBe('₪');
    expect(getCurrencySymbol('UNKNOWN')).toBe('₪');
  });
});
