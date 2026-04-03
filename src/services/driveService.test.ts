import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOrCreateFolder, getOrCreateFolderPath, uploadFileToDrive, DRIVE_API_URL } from './driveService';

describe('driveService', () => {
  const mockToken = 'mock-token';

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('getOrCreateFolder returns existing folder ID', async () => {
    (global.fetch as any).mockResolvedValueOnce({
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
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ files: [] }),
    });
    // Second call: create folder
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'new-folder-456' }),
    });

    const folderId = await getOrCreateFolder(mockToken, 'New Folder');
    expect(folderId).toBe('new-folder-456');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('getOrCreateFolderPath builds path correctly', async () => {
    // Mock getOrCreateFolder behavior for each step
    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ files: [{ id: 'id-A' }] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ files: [{ id: 'id-B' }] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ files: [{ id: 'id-C' }] }) });

    const folderId = await getOrCreateFolderPath(mockToken, ['A', 'B', 'C']);
    expect(folderId).toBe('id-C');
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('uploadFileToDrive uploads file correctly', async () => {
    (global.fetch as any).mockResolvedValueOnce({
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
