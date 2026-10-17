import { collection, deleteField, doc, setDoc, deleteDoc, getDocs, query, where, orderBy, onSnapshot, writeBatch } from 'firebase/firestore';
import { db, describeFirestoreError, OperationType } from '../firebase';
import { Session } from '../types';
import { SessionAdapter, SessionStoreError } from './sessionStore';

const SESSIONS = 'sessions';
const MAX_BATCH_WRITES = 500;

/**
 * The document carries its ID outside the data. Firestore rejects `undefined`: a top-level field set to
 * `undefined` is deleted, so the merge write clears a stored value; inside arrays, which Firestore
 * replaces whole, it is dropped.
 */
const toDocument = ({ id: _id, ...data }: Session) =>
  Object.fromEntries(Object.entries(data).map(([key, value]) =>
    [key, value === undefined ? deleteField() : JSON.parse(JSON.stringify(value))]));

const isQuotaExceeded = (error: unknown) =>
  error instanceof Error && error.message.includes('Quota limit exceeded');

const failure = (error: unknown, operation: OperationType, path: string) =>
  isQuotaExceeded(error)
    ? new SessionStoreError('quota-exceeded', error)
    : describeFirestoreError(error, operation, path);

const guarded = async (operation: OperationType, path: string, write: () => Promise<unknown>) => {
  try {
    await write();
  } catch (error) {
    throw failure(error, operation, path);
  }
};

export const createFirestoreSessionAdapter = (): SessionAdapter => ({
  put: (session) =>
    guarded(OperationType.WRITE, `${SESSIONS}/${session.id}`, () =>
      setDoc(doc(db, SESSIONS, session.id), toDocument(session), { merge: true })),

  delete: (id) =>
    guarded(OperationType.DELETE, `${SESSIONS}/${id}`, () => deleteDoc(doc(db, SESSIONS, id))),

  deleteAllFor: (userId) =>
    guarded(OperationType.DELETE, SESSIONS, async () => {
      const snapshot = await getDocs(query(collection(db, SESSIONS), where('userId', '==', userId)));
      for (let i = 0; i < snapshot.docs.length; i += MAX_BATCH_WRITES) {
        const batch = writeBatch(db);
        snapshot.docs.slice(i, i + MAX_BATCH_WRITES).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }),

  watch: (userId, onChange, onError) =>
    onSnapshot(
      query(collection(db, SESSIONS), where('userId', '==', userId), orderBy('createdAt', 'desc')),
      (snapshot) => onChange(snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Session))),
      (error) => onError(failure(error, OperationType.LIST, SESSIONS))
    ),
});
