import { Session } from '../types';
import { StorageSettings, buildDirectoryPath, formatDateTimeForFilename, sanitizeFilename } from './configService';
import { getOrCreateFolderPath, uploadFileToDrive } from './driveService';
import { mimeTypeOf, extensionOf } from '../utils/imageUtils';
import { createGoogleSheetsAdapter } from './googleSheetsAdapter';
import { createPurchasesSheet } from './purchasesSheet';

export interface SyncResult {
  driveFileId?: string;
  driveLink?: string;
  driveFileName?: string;
  spreadsheetId?: string;
  spreadsheetLink?: string;
  itemSheetsLinks?: Record<string, string>;
}

/** Sheets failed after any Drive upload finished; `synced` holds what did finish so it isn't lost. */
export class SheetsSyncError extends Error {
  name = 'SheetsSyncError';
  constructor(readonly synced: SyncResult, readonly cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}

export const syncToCloud = async (
  session: Session,
  settings: StorageSettings,
  driveToken: string
): Promise<SyncResult> => {
  const result: SyncResult = {};
  
  // 1. Upload to Google Drive
  if (session.imageUrl && !session.driveFileId) {
    try {
      const date = new Date(session.createdAt);
      const folderPath = buildDirectoryPath(settings, date);
      const folderId = await getOrCreateFolderPath(driveToken, folderPath);
      
      const mimeType = mimeTypeOf(session.imageUrl);
      const extension = extensionOf(session.imageUrl);
      
      const formattedDate = formatDateTimeForFilename(date);
      const storeNameForFilename = session.englishStoreName || session.storeName || 'unknown';
      const sanitizedStoreName = sanitizeFilename(storeNameForFilename);
      const fileName = `${sanitizedStoreName}_${formattedDate}_${session.total.toFixed(2)}.${extension}`;
      
      const driveFile = await uploadFileToDrive(driveToken, folderId, fileName, session.imageUrl, mimeType);
      result.driveFileId = driveFile.id;
      result.driveLink = driveFile.webViewLink;
      result.driveFileName = driveFile.name;
    } catch (error) {
      console.error("Drive sync error:", error);
      throw error;
    }
  }

  // 2. Append to the Purchases sheet
  if (settings.syncToSheets) {
    try {
      const sheet = createPurchasesSheet(createGoogleSheetsAdapter(driveToken));
      let spreadsheetId = settings.spreadsheetId;
      if (!spreadsheetId) {
        spreadsheetId = (await sheet.connect(settings.spreadsheetName)).spreadsheetId;
        result.spreadsheetId = spreadsheetId;
      }

      const appended = await sheet.append(spreadsheetId, session, { driveLink: result.driveLink, driveFileName: result.driveFileName });
      result.spreadsheetLink = appended.spreadsheetLink;
      if (appended.itemLinks) result.itemSheetsLinks = appended.itemLinks;
    } catch (error) {
      console.error("Sheets sync error:", error);
      throw new SheetsSyncError(result, error);
    }
  }

  return result;
};
