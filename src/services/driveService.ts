
const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API_URL = 'https://www.googleapis.com/upload/drive/v3';

export interface DriveFile {
  id: string;
  name: string;
  webViewLink?: string;
}

export const getOrCreateFolder = async (token: string, folderName: string): Promise<string> => {
  // Search for the folder
  const query = encodeURIComponent(`name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const response = await fetch(`${DRIVE_API_URL}/files?q=${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // Create the folder if not found
  const createResponse = await fetch(`${DRIVE_API_URL}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  const folder = await createResponse.json();
  return folder.id;
};

export const uploadFileToDrive = async (
  token: string, 
  folderId: string, 
  fileName: string, 
  base64Data: string, 
  mimeType: string
): Promise<DriveFile> => {
  // Convert base64 to Uint8Array
  const base64Content = base64Data.split(',')[1] || base64Data;
  const byteCharacters = atob(base64Content);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);

  // Metadata for the file
  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  const boundary = 'foo_bar_baz';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart = `Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
  
  // We need to combine the metadata part and the binary part
  // Using a Blob to combine them correctly
  const multipartBody = new Blob([
    delimiter,
    metadataPart,
    delimiter,
    `Content-Type: ${mimeType}\r\n\r\n`,
    byteArray,
    closeDelimiter
  ], { type: `multipart/related; boundary=${boundary}` });

  const response = await fetch(`${UPLOAD_API_URL}/files?uploadType=multipart&fields=id,name,webViewLink`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: multipartBody,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to upload to Drive');
  }

  return await response.json();
};
