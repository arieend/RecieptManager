import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOrCreateFolder, getOrCreateFolderPath, uploadFileToDrive, findSpreadsheetByName, DRIVE_API_URL } from './driveService';

describe('driveService', () => {
  const mockToken = 'mock-token';

  let fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  it('findSpreadsheetByName returns the first match, or null when none has the name', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ files: [{ id: 'sheet-1' }] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ files: [] }) });

    expect(await findSpreadsheetByName(mockToken, 'Receipts')).toBe('sheet-1');
    expect(await findSpreadsheetByName(mockToken, 'Receipts')).toBeNull();
  });

  it('findSpreadsheetByName fails with the status instead of reporting no match', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: () => Promise.resolve({ error: { message: 'Backend Error' } }) });

    await expect(findSpreadsheetByName(mockToken, 'Receipts')).rejects.toMatchObject({ message: 'Backend Error', status: 503 });
  });

  it('getOrCreateFolder returns existing folder ID', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ files: [{ id: 'folder-123' }] }),
    });

    const folderId = await getOrCreateFolder(mockToken, 'Test Folder');
    expect(folderId).toBe('folder-123');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(DRIVE_API_URL + '/files?q='),
      expect.any(Object)
    );
  });

  it('getOrCreateFolder creates folder if not found', async () => {
    // First call: search returns empty
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ files: [] }),
    });
    // Second call: create folder
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'new-folder-456' }),
    });

    const folderId = await getOrCreateFolder(mockToken, 'New Folder');
    expect(folderId).toBe('new-folder-456');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('getOrCreateFolderPath builds path correctly', async () => {
    // Mock getOrCreateFolder behavior for each step
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ files: [{ id: 'id-A' }] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ files: [{ id: 'id-B' }] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ files: [{ id: 'id-C' }] }) });

    const folderId = await getOrCreateFolderPath(mockToken, ['A', 'B', 'C']);
    expect(folderId).toBe('id-C');
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('uploadFileToDrive uploads file correctly', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'file-789', name: 'test.jpg', webViewLink: 'http://link' }),
    });

    const result = await uploadFileToDrive(
      mockToken,
      'folder-123',
      'test.jpg',
      'data:image/jpeg;base64,YmFzZTY0LWRhdGE=', // Valid base64 for "base64-data"
      'image/jpeg'
    );

    expect(result.id).toBe('file-789');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('uploadType=multipart'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${mockToken}`
        })
      })
    );
  });
});
