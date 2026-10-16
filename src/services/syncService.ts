import { Session, Person, ReceiptItem } from '../types';
import { StorageSettings, buildDirectoryPath, formatDateTimeForFilename, sanitizeFilename, formatDateForSheets } from './configService';
import { getOrCreateFolderPath, uploadFileToDrive, findSpreadsheetByName } from './driveService';
import { mimeTypeOf, extensionOf } from '../utils/imageUtils';
import { createReceiptsSpreadsheet, appendToSpreadsheet, detectSpreadsheetDateFormat, ensureDateColumnFormat, SheetDateFormatInfo } from './sheetsService';

export interface SyncResult {
  driveFileId?: string;
  driveLink?: string;
  driveFileName?: string;
  spreadsheetId?: string;
  spreadsheetLink?: string;
  itemSheetsLinks?: Record<string, string>;
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

      // Check existing 'Date' column format in the recipient Google sheet to match it
      let formatInfo: SheetDateFormatInfo | null = null;
      try {
        formatInfo = await detectSpreadsheetDateFormat(driveToken, currentSpreadsheetId, 'Purchases');
      } catch (err) {
        console.warn("Could not detect spreadsheet date format, using default:", err);
      }

      const detectedPattern = formatInfo?.pattern || 'DD/MM/YYYY';
      const detectedSheetsPattern = formatInfo?.sheetsPattern || 'dd/mm/yyyy';

      const rows = session.items.map(item => {
        const assignedNames = item.assignedTo
          .map(pid => session.people.find(p => p.id === pid)?.name)
          .filter(Boolean)
          .join(', ');
        
        const driveLink = result.driveLink || session.driveLink || '';
        const driveFileName = result.driveFileName || session.driveFileName || (session.storeName ? `${session.storeName}_Receipt` : 'Receipt');
        const receiptLink = driveLink ? `=HYPERLINK("${driveLink}", "${driveFileName}")` : '';
        
        const rate = session.exchangeRate || 1;
        const priceInNIS = item.price * rate;
        const originalInfo = session.currency !== 'ILS' ? `${item.price.toFixed(2)} ${session.currency}` : '';

        return [
          formatDateForSheets(new Date(session.createdAt), detectedPattern),
          session.storeName,
          item.name,
          priceInNIS,
          item.category || '',
          (item.labels || []).join(', '),
          assignedNames || 'משפחה',
          receiptLink,
          originalInfo,
          session.currency !== 'ILS' ? rate : ''
        ];
      });

      const updatedRange = await appendToSpreadsheet(driveToken, currentSpreadsheetId, rows);

      // Ensure the newly inserted date cells are explicitly formatted as DATE in the sheet
      if (updatedRange && formatInfo?.sheetId !== undefined) {
        const rowMatch = updatedRange.match(/!A(\d+):[A-Z](\d+)/);
        if (rowMatch) {
          const startRow1Based = parseInt(rowMatch[1], 10);
          const endRow1Based = parseInt(rowMatch[2], 10);
          await ensureDateColumnFormat(
            driveToken,
            currentSpreadsheetId,
            formatInfo.sheetId,
            formatInfo.columnIndex ?? 0,
            detectedSheetsPattern,
            startRow1Based - 1,
            endRow1Based
          );
        }
      }
      
      // Construct spreadsheet link
      result.spreadsheetLink = `https://docs.google.com/spreadsheets/d/${currentSpreadsheetId}/edit`;
      
      // Parse updatedRange to get row links for items
      // Example updatedRange: "Purchases!A10:J12"
      if (updatedRange) {
        const rowMatch = updatedRange.match(/!A(\d+):/);
        if (rowMatch) {
          const startRow = parseInt(rowMatch[1]);
          const itemLinks: Record<string, string> = {};
          session.items.forEach((item, index) => {
            const rowNum = startRow + index;
            // Assuming gid=0 for the first sheet 'Purchases'
            itemLinks[item.id] = `${result.spreadsheetLink}#gid=0&range=A${rowNum}`;
          });
          result.itemSheetsLinks = itemLinks;
        }
      }
    } catch (error) {
      console.error("Sheets sync error:", error);
      throw error;
    }
  }

  return result;
};
