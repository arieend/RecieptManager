import { Session, Person, ReceiptItem } from '../types';
import { StorageSettings, buildDirectoryPath, formatDateTimeForFilename, sanitizeFilename, formatDateForSheets } from './configService';
import { getOrCreateFolderPath, uploadFileToDrive, findSpreadsheetByName } from './driveService';
import { createReceiptsSpreadsheet, appendToSpreadsheet } from './sheetsService';

export interface SyncResult {
  driveFileId?: string;
  driveLink?: string;
  driveFileName?: string;
  spreadsheetId?: string;
}

export const syncToCloud = async (
  session: Session,
  settings: StorageSettings,
  driveToken: string,
  forceExtension?: string
): Promise<SyncResult> => {
  const result: SyncResult = {};
  
  // 1. Upload to Google Drive
  if (session.imageUrl && !session.driveFileId) {
    try {
      const date = new Date(session.createdAt);
      const folderPath = buildDirectoryPath(settings, date);
      const folderId = await getOrCreateFolderPath(driveToken, folderPath);
      
      const mimeType = session.imageUrl.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg';
      const extension = forceExtension || (mimeType === 'application/pdf' ? 'pdf' : 'jpg');
      
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

  // 2. Sync to Google Sheets
  if (settings.syncToSheets) {
    try {
      let currentSpreadsheetId = settings.spreadsheetId;
      if (!currentSpreadsheetId) {
        // Try to find by name first to avoid duplicates
        currentSpreadsheetId = await findSpreadsheetByName(driveToken, settings.spreadsheetName) || '';
        
        if (!currentSpreadsheetId) {
          // Create it if not found
          currentSpreadsheetId = await createReceiptsSpreadsheet(driveToken, settings.spreadsheetName);
        }
        
        result.spreadsheetId = currentSpreadsheetId;
      }

      const rows = session.items.map(item => {
        const assignedNames = item.assignedTo
          .map(pid => session.people.find(p => p.id === pid)?.name)
          .filter(Boolean)
          .join(', ');
        
        const driveLink = result.driveLink || session.driveLink || '';
        const driveFileName = result.driveFileName || session.driveFileName || (session.storeName ? `${session.storeName}_Receipt` : 'Receipt');
        const receiptLink = driveLink ? `=HYPERLINK("${driveLink}", "${driveFileName}")` : '';
        
        return [
          formatDateForSheets(new Date(session.createdAt)),
          session.storeName,
          item.name,
          item.price,
          item.category || '',
          (item.labels || []).join(', '),
          assignedNames || 'משפחה',
          receiptLink
        ];
      });

      await appendToSpreadsheet(driveToken, currentSpreadsheetId, rows);
    } catch (error) {
      console.error("Sheets sync error:", error);
      throw error;
    }
  }

  return result;
};
