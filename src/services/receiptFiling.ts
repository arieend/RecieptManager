import { Session } from '../types';
import type { StorageSettings } from './configService';
import type { SessionStore } from './sessionStore';
import { SheetsSyncError, type SyncResult } from './syncService';

/** Uploads to Drive and appends to Sheets: `syncToCloud` in production, a fake in tests. */
export type ReceiptSync = (session: Session, settings: StorageSettings, driveToken: string) => Promise<SyncResult>;

export interface ReceiptFilingDeps {
  sync: ReceiptSync;
  store: SessionStore;
}

export interface FilingContext {
  settings: StorageSettings;
  driveToken: string | null;
}

export type SyncFailureKind = 'drive-auth-expired' | 'sheets-disabled' | 'sync-failed';

export type FilingOutcome = {
  saved: Session;
  sync: 'done' | 'skipped' | { failed: SyncFailureKind };
  /** Set when sync found or created the spreadsheet; the caller keeps it in the settings. */
  spreadsheetId?: string;
};

const classifySyncFailure = (error: unknown): SyncFailureKind => {
  const fields = typeof error === 'object' && error !== null ? (error as { status?: unknown; message?: unknown }) : {};
  const status = fields.status;
  const message = String(fields.message ?? '').toLowerCase();
  if (status === 401 || message.includes('invalid_grant') || message.includes('401')) return 'drive-auth-expired';
  if (message.includes('sheets.googleapis.com') || message.includes('sheets api')) return 'sheets-disabled';
  return 'sync-failed';
};

/** Missing image and links are saved as "", the shape stored Sessions have always had. */
const withLinks = (session: Session, result: SyncResult = {}): Session => ({
  ...session,
  imageUrl: session.imageUrl || '',
  driveFileId: result.driveFileId || session.driveFileId || '',
  driveLink: result.driveLink || session.driveLink || '',
  driveFileName: result.driveFileName || session.driveFileName || '',
  spreadsheetLink: result.spreadsheetLink || session.spreadsheetLink || '',
  items: session.items.map((item) => ({
    ...item,
    sheetsLink: result.itemSheetsLinks?.[item.id] || item.sheetsLink,
  })),
});

/** The spreadsheet ID is reported only when sync found or created one. */
const withSpreadsheetId = (outcome: FilingOutcome, spreadsheetId?: string): FilingOutcome =>
  spreadsheetId ? { ...outcome, spreadsheetId } : outcome;

export const createReceiptFiling = ({ sync, store }: ReceiptFilingDeps) => {
  const file = async (userId: string, session: Session, { settings, driveToken }: FilingContext): Promise<FilingOutcome> => {
    const imageNeedsUpload = !!session.imageUrl && !session.driveFileId;
    if (!driveToken || !(imageNeedsUpload || settings.syncToSheets)) {
      return { saved: await store.save(userId, withLinks(session)), sync: 'skipped' };
    }

    let result: SyncResult;
    try {
      result = await sync(session, settings, driveToken);
    } catch (error) {
      console.error('Cloud sync error:', error);
      // A Drive upload that finished before Sheets failed is kept, so the next save doesn't upload again.
      if (error instanceof SheetsSyncError) {
        const saved = await store.save(userId, withLinks(session, error.synced));
        return withSpreadsheetId({ saved, sync: { failed: classifySyncFailure(error.cause) } }, error.synced.spreadsheetId);
      }
      return { saved: await store.save(userId, withLinks(session)), sync: { failed: classifySyncFailure(error) } };
    }

    const saved = await store.save(userId, withLinks(session, result));
    return withSpreadsheetId({ saved, sync: 'done' }, result.spreadsheetId);
  };

  return { file };
};

export type ReceiptFiling = ReturnType<typeof createReceiptFiling>;
