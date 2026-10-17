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

const classifySyncFailure = (error: any): SyncFailureKind => {
  const message = String(error?.message ?? '').toLowerCase();
  if (error?.status === 401 || message.includes('invalid_grant') || message.includes('401')) return 'drive-auth-expired';
  if (message.includes('sheets.googleapis.com') || message.includes('sheets api')) return 'sheets-disabled';
  return 'sync-failed';
};

const withLinks = (session: Session, result: SyncResult): Session => ({
  ...session,
  driveFileId: result.driveFileId || session.driveFileId,
  driveLink: result.driveLink || session.driveLink,
  driveFileName: result.driveFileName || session.driveFileName,
  spreadsheetLink: result.spreadsheetLink || session.spreadsheetLink,
  items: session.items.map((item) => ({
    ...item,
    sheetsLink: result.itemSheetsLinks?.[item.id] || item.sheetsLink,
  })),
});

export const createReceiptFiling = ({ sync, store }: ReceiptFilingDeps) => {
  const file = async (userId: string, session: Session, { settings, driveToken }: FilingContext): Promise<FilingOutcome> => {
    const imageNeedsUpload = !!session.imageUrl && !session.driveFileId;
    if (!driveToken || !(imageNeedsUpload || settings.syncToSheets)) {
      return { saved: await store.save(userId, session), sync: 'skipped' };
    }

    let result: SyncResult;
    try {
      result = await sync(session, settings, driveToken);
    } catch (error) {
      console.error('Cloud sync error:', error);
      // A Drive upload that finished before Sheets failed is kept, so the next save doesn't upload again.
      if (error instanceof SheetsSyncError) {
        const saved = await store.save(userId, withLinks(session, error.synced));
        return { saved, sync: { failed: classifySyncFailure(error.cause) }, spreadsheetId: error.synced.spreadsheetId };
      }
      return { saved: await store.save(userId, session), sync: { failed: classifySyncFailure(error) } };
    }

    const saved = await store.save(userId, withLinks(session, result));
    return { saved, sync: 'done', spreadsheetId: result.spreadsheetId };
  };

  return { file };
};

export type ReceiptFiling = ReturnType<typeof createReceiptFiling>;
