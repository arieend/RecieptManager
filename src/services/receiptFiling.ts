import { Session } from '../types';
import { isRateUnconfirmed } from '../utils/money';
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
  // Drive and Sheets throw a GoogleApiError with the HTTP status; a 401 means Google rejected the access token.
  if (status === 401) return 'drive-auth-expired';
  if (message.includes('sheets.googleapis.com') || message.includes('sheets api')) return 'sheets-disabled';
  return 'sync-failed';
};

/** A Session is on the Purchases sheet once an append set its `spreadsheetLink`; it is never appended again (ADR-0004). */
export const isOnPurchasesSheet = (session: Session): boolean => !!session.spreadsheetLink;

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

/**
 * The links a filing saved, put on the Session the user still has open, which may have been edited meanwhile.
 * Saving that Session again then knows it is already on Drive and on the Purchases sheet.
 */
export const withSavedLinks = (open: Session, saved: Session): Session => {
  const savedSheetsLinks = new Map(saved.items.map((item) => [item.id, item.sheetsLink]));
  return {
    ...open,
    userId: saved.userId,
    driveFileId: saved.driveFileId,
    driveLink: saved.driveLink,
    driveFileName: saved.driveFileName,
    spreadsheetLink: saved.spreadsheetLink,
    items: open.items.map((item) => ({ ...item, sheetsLink: savedSheetsLinks.get(item.id) || item.sheetsLink })),
  };
};

/** The spreadsheet ID is reported only when sync found or created one. */
const withSpreadsheetId = (outcome: FilingOutcome, spreadsheetId?: string): FilingOutcome =>
  spreadsheetId ? { ...outcome, spreadsheetId } : outcome;

export const createReceiptFiling = ({ sync, store }: ReceiptFilingDeps) => {
  const file = async (userId: string, session: Session, context: FilingContext): Promise<FilingOutcome> => {
    const { driveToken } = context;
    // An Unconfirmed rate never reaches the Purchases sheet (ADR-0003), and a Session already on it
    // never reaches it again (ADR-0004); Drive still gets the image.
    const keepOffSheet = isRateUnconfirmed(session) || isOnPurchasesSheet(session);
    const settings = keepOffSheet ? { ...context.settings, syncToSheets: false } : context.settings;
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
