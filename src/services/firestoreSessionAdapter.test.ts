import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Session } from '../types';
import { SessionStoreError } from './sessionStore';

const firestore = vi.hoisted(() => ({
  writes: [] as { path: string; data: unknown; options: unknown }[],
  deletes: [] as string[],
  commits: [] as number[],
  storedIds: [] as string[],
  fail: null as Error | null,
  snapshotIds: [] as string[],
  snapshotError: null as Error | null,
  queries: [] as unknown[][],
}));

const failIfAsked = () => {
  if (firestore.fail) throw firestore.fail;
};

vi.mock('firebase/firestore', () => ({
  deleteField: () => 'DELETE_FIELD',
  collection: (_db: unknown, name: string) => name,
  doc: (_db: unknown, name: string, id: string) => `${name}/${id}`,
  where: (...args: unknown[]) => ['where', ...args],
  orderBy: (...args: unknown[]) => ['orderBy', ...args],
  query: (...args: unknown[]) => { firestore.queries.push(args); return args; },
  setDoc: async (path: string, data: unknown, options: unknown) => {
    failIfAsked();
    firestore.writes.push({ path, data, options });
  },
  deleteDoc: async (path: string) => {
    failIfAsked();
    firestore.deletes.push(path);
  },
  getDocs: async () => {
    failIfAsked();
    return { docs: firestore.storedIds.map((id) => ({ ref: `sessions/${id}` })) };
  },
  writeBatch: () => {
    const pending: string[] = [];
    return {
      delete: (ref: string) => pending.push(ref),
      commit: async () => {
        firestore.deletes.push(...pending);
        firestore.commits.push(pending.length);
      },
    };
  },
  onSnapshot: (
    _query: unknown,
    onNext: (snapshot: unknown) => void,
    onError: (error: Error) => void
  ) => {
    if (firestore.snapshotError) onError(firestore.snapshotError);
    else onNext({ docs: firestore.snapshotIds.map((id) => ({ id, data: () => ({ storeName: id, id: 'stale' }) })) });
    return () => {};
  },
}));

vi.mock('../firebase', () => ({
  db: {},
  OperationType: { WRITE: 'write', DELETE: 'delete', LIST: 'list' },
  describeFirestoreError: (error: unknown, operation: string, path: string) =>
    new Error(`${operation} ${path}: ${(error as Error).message}`),
}));

import { createFirestoreSessionAdapter } from './firestoreSessionAdapter';

const session = (overrides: Partial<Session> = {}): Session => ({
  id: 'draft-1',
  userId: 'user-1',
  storeName: 'Shop',
  createdAt: '2026-03-01T12:00:00.000Z',
  items: [{ id: 'item-0', name: 'Milk', price: 6, quantity: 1, assignedTo: [], category: undefined }],
  people: [],
  tax: 0,
  tip: 0,
  total: 6,
  currency: 'ILS',
  exchangeRate: 1,
  ...overrides,
});

const quota = new Error('Quota limit exceeded.');

beforeEach(() => {
  firestore.writes = [];
  firestore.deletes = [];
  firestore.commits = [];
  firestore.storedIds = [];
  firestore.fail = null;
  firestore.snapshotIds = [];
  firestore.snapshotError = null;
  firestore.queries = [];
});

describe('Firestore Session adapter', () => {
  const adapter = createFirestoreSessionAdapter();

  it('merges the Session into the document named by its ID, without the ID', async () => {
    await adapter.put(session());

    expect(firestore.writes).toEqual([{
      path: 'sessions/draft-1',
      data: {
        userId: 'user-1',
        storeName: 'Shop',
        createdAt: '2026-03-01T12:00:00.000Z',
        items: [{ id: 'item-0', name: 'Milk', price: 6, quantity: 1, assignedTo: [] }],
        people: [],
        tax: 0,
        tip: 0,
        total: 6,
        currency: 'ILS',
        exchangeRate: 1,
      },
      options: { merge: true },
    }]);
  });

  it('deletes a field the Session sets to undefined, so the merge write clears a stored value', async () => {
    await adapter.put(session({ driveLink: undefined, spreadsheetLink: undefined }));

    expect(firestore.writes[0].data).toMatchObject({ driveLink: 'DELETE_FIELD', spreadsheetLink: 'DELETE_FIELD' });
  });

  it('drops undefined fields inside arrays, which Firestore replaces whole', async () => {
    await adapter.put(session());

    expect((firestore.writes[0].data as Session).items[0]).not.toHaveProperty('category');
  });

  it('deletes the document named by the ID', async () => {
    await adapter.delete('abc');

    expect(firestore.deletes).toEqual(['sessions/abc']);
  });

  it("deletes all of a user's Sessions in batches of at most 500", async () => {
    firestore.storedIds = Array.from({ length: 501 }, (_, i) => `s${i}`);

    await adapter.deleteAllFor('user-1');

    expect(firestore.commits).toEqual([500, 1]);
    expect(firestore.deletes).toHaveLength(501);
    expect(firestore.queries[0]).toContainEqual(['where', 'userId', '==', 'user-1']);
  });

  it('delivers Sessions with their document IDs, newest first by createdAt', () => {
    firestore.snapshotIds = ['b', 'a'];
    const delivered: Session[][] = [];

    adapter.watch('user-1', (sessions) => delivered.push(sessions), () => {});

    expect(delivered).toEqual([[
      { storeName: 'b', id: 'b' },
      { storeName: 'a', id: 'a' },
    ]]);
    expect(firestore.queries[0]).toEqual([
      'sessions',
      ['where', 'userId', '==', 'user-1'],
      ['orderBy', 'createdAt', 'desc'],
    ]);
  });

  describe('failures', () => {
    it.each([
      ['put', () => adapter.put(session())],
      ['delete', () => adapter.delete('abc')],
      ['deleteAllFor', () => adapter.deleteAllFor('user-1')],
    ])('reports quota-exceeded when %s hits the quota', async (_name, act) => {
      firestore.fail = quota;

      const error = await act().catch((e) => e);

      expect(error).toBeInstanceOf(SessionStoreError);
      expect(error).toMatchObject({ kind: 'quota-exceeded', cause: quota });
    });

    it('describes other write failures with the operation and path', async () => {
      firestore.fail = new Error('permission-denied');

      await expect(adapter.put(session())).rejects.toThrow('write sessions/draft-1: permission-denied');
    });

    it('reports quota-exceeded when the subscription hits the quota', () => {
      firestore.snapshotError = quota;
      const errors: unknown[] = [];

      adapter.watch('user-1', () => {}, (e) => errors.push(e));

      expect(errors[0]).toBeInstanceOf(SessionStoreError);
      expect(errors[0]).toMatchObject({ kind: 'quota-exceeded' });
    });

    it('describes other subscription failures', () => {
      firestore.snapshotError = new Error('offline');
      const errors: Error[] = [];

      adapter.watch('user-1', () => {}, (e) => errors.push(e as Error));

      expect(errors[0].message).toBe('list sessions: offline');
    });
  });
});
