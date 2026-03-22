export const getOrCreateFolder = async (token: string, folderName: string, parentId?: string): Promise<string> => {
  const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false${parentId ? ` and '${parentId}' in parents` : ''}`;
  
  const searchResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!searchResponse.ok) {
    const errorText = await searchResponse.text();
    throw new Error(`Failed to search Drive folder: ${searchResponse.status} ${searchResponse.statusText} - ${errorText}`);
  }

  const searchData = await searchResponse.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined
    })
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Failed to create Drive folder: ${createResponse.status} ${createResponse.statusText} - ${errorText}`);
  }

  const createData = await createResponse.json();
  return createData.id;
};

export const checkFileExists = async (token: string, fileName: string, parentId: string): Promise<string | null> => {
  const query = `name='${fileName}' and trashed=false and '${parentId}' in parents`;
  
  const searchResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,webViewLink)`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!searchResponse.ok) {
    const errorText = await searchResponse.text();
    throw new Error(`Failed to search Drive file: ${searchResponse.status} ${searchResponse.statusText} - ${errorText}`);
  }

  const searchData = await searchResponse.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].webViewLink;
  }
  return null;
};

export const uploadPdfToDrive = async (token: string, pdfBlob: Blob, fileName: string, parentId: string): Promise<string> => {
  const metadata = {
    name: fileName,
    parents: [parentId],
    mimeType: 'application/pdf'
  };

  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/pdf\r\n\r\n';

  const blob = new Blob([
    multipartRequestBody,
    pdfBlob,
    close_delim
  ], { type: `multipart/related; boundary=${boundary}` });

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: blob
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload to Drive: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data.webViewLink;
};
