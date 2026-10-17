import { Session } from '../types';

/** Where Sessions live: Firestore in production, memory in tests. */
export interface SessionAdapter {
  /** Creates or merges the Session under its own ID. */
  put(session: Session): Promise<void>;
  /** Succeeds whether or not the Session exists. */
  delete(id: string): Promise<void>;
  deleteAllFor(userId: string): Promise<void>;
  /** Delivers the user's Sessions, newest first, on every change. */
  watch(userId: string, onChange: (sessions: Session[]) => void, onError: (error: unknown) => void): () => void;
}

export interface SessionStoreDeps {
  adapter: SessionAdapter;
  shrinkImage: (dataUrl: string, targetSize: number) => Promise<string>;
  now: () => number;
}

export type SessionStoreErrorKind = 'quota-exceeded' | 'write-failed' | 'subscribe-failed';

export class SessionStoreError extends Error {
  name = 'SessionStoreError';
  constructor(public kind: SessionStoreErrorKind, public cause?: unknown) {
    super(`Session store failed: ${kind}`);
  }
}

/** Keeps an adapter's own SessionStoreError; anything else becomes `kind`. */
const asStoreError = (error: unknown, kind: SessionStoreErrorKind) =>
  error instanceof SessionStoreError ? error : new SessionStoreError(kind, error);

const writing = async <T>(write: () => Promise<T>): Promise<T> => {
  try {
    return await write();
  } catch (error) {
    throw asStoreError(error, 'write-failed');
  }
};

/** Firestore documents cap at 1 MiB; the image is most of a Session. */
const IMAGE_TARGET_SIZE = 800_000;
const IMAGE_HARD_LIMIT = 950_000;

export const createSessionStore = ({ adapter, shrinkImage, now }: SessionStoreDeps) => {
  /** Fits the image into the document, dropping it only when Drive keeps a copy. */
  const fitImage = async ({ imageUrl, driveLink }: Session): Promise<string | undefined> => {
    if (!imageUrl || imageUrl.length <= IMAGE_TARGET_SIZE) return imageUrl;
    const shrunk = await shrinkImage(imageUrl, IMAGE_TARGET_SIZE);
    return shrunk.length > IMAGE_HARD_LIMIT && driveLink ? '' : shrunk;
  };

  const save = async (userId: string, session: Session): Promise<Session> => {
    const saved: Session = {
      ...session,
      userId,
      imageUrl: await fitImage(session),
      updatedAt: new Date(now()).toISOString(),
    };
    await writing(() => adapter.put(saved));
    return saved;
  };

  const subscribe = (
    userId: string,
    onChange: (sessions: Session[]) => void,
    onError: (error: SessionStoreError) => void
  ) => adapter.watch(userId, onChange, (error) => onError(asStoreError(error, 'subscribe-failed')));

  const remove = (id: string) => writing(() => adapter.delete(id));

  const removeAll = (userId: string) => writing(() => adapter.deleteAllFor(userId));

  return { save, remove, removeAll, subscribe };
};

export type SessionStore = ReturnType<typeof createSessionStore>;

const newestFirst = (a: Session, b: Session) => b.createdAt.localeCompare(a.createdAt);

export const createInMemorySessionAdapter = (): SessionAdapter => {
  const sessions = new Map<string, Session>();
  const watchers = new Set<{ userId: string; onChange: (sessions: Session[]) => void }>();

  const listFor = (userId: string) =>
    [...sessions.values()].filter((s) => s.userId === userId).sort(newestFirst);

  const notify = () => watchers.forEach((w) => w.onChange(listFor(w.userId)));

  return {
    async put(session) {
      sessions.set(session.id, { ...sessions.get(session.id), ...session });
      notify();
    },
    async delete(id) {
      sessions.delete(id);
      notify();
    },
    async deleteAllFor(userId) {
      listFor(userId).forEach((s) => sessions.delete(s.id));
      notify();
    },
    watch(userId, onChange) {
      const watcher = { userId, onChange };
      watchers.add(watcher);
      onChange(listFor(userId));
      return () => { watchers.delete(watcher); };
    },
  };
};
