import { describe, it, expect } from 'vitest';
import { Session } from '../types';
import {
  createSessionStore, createInMemorySessionAdapter, SessionAdapter, SessionStoreDeps, SessionStoreError
} from './sessionStore';

const NOW = new Date('2026-03-15T09:30:00.000Z').getTime();

const session = (overrides: Partial<Session> = {}): Session => ({
  id: 'draft-1',
  userId: 'anonymous',
  storeName: 'Shop',
  createdAt: '2026-03-01T12:00:00.000Z',
  items: [],
  people: [],
  tax: 0,
  tip: 0,
  total: 10,
  currency: 'ILS',
  exchangeRate: 1,
  imageUrl: 'data:image/jpeg;base64,abc',
  ...overrides,
});

const makeStore = (deps: Partial<SessionStoreDeps> = {}) =>
  createSessionStore({
    adapter: createInMemorySessionAdapter(),
    shrinkImage: async (dataUrl) => dataUrl,
    now: () => NOW,
    ...deps,
  });

/** The latest list a subscription delivered. */
const watch = (store: ReturnType<typeof makeStore>, userId: string) => {
  const seen: { sessions: Session[] } = { sessions: [] };
  const unsubscribe = store.subscribe(userId, (sessions) => { seen.sessions = sessions; }, () => {});
  return Object.assign(seen, { unsubscribe });
};

describe('Session store', () => {
  it('saves a Draft Session under its own ID, stamped with the user and save time', async () => {
    const store = makeStore();
    const history = watch(store, 'user-1');

    const saved = await store.save('user-1', session());

    expect(saved).toMatchObject({
      id: 'draft-1',
      userId: 'user-1',
      updatedAt: '2026-03-15T09:30:00.000Z',
    });
    expect(history.sessions).toEqual([saved]);
  });

  it('saving the same Session again updates it instead of adding a second one', async () => {
    const store = makeStore();
    const history = watch(store, 'user-1');

    await store.save('user-1', session());
    await store.save('user-1', session({ storeName: 'Corrected' }));

    expect(history.sessions.map((s) => [s.id, s.storeName])).toEqual([['draft-1', 'Corrected']]);
  });

  it("delivers only the user's own Sessions, newest receipt first", async () => {
    const store = makeStore();
    const history = watch(store, 'user-1');

    await store.save('user-1', session({ id: 'march', createdAt: '2026-03-01T12:00:00.000Z' }));
    await store.save('user-2', session({ id: 'someone-else' }));
    await store.save('user-1', session({ id: 'april', createdAt: '2026-04-01T12:00:00.000Z' }));

    expect(history.sessions.map((s) => s.id)).toEqual(['april', 'march']);
  });

  it('stops delivering after unsubscribe', async () => {
    const store = makeStore();
    const history = watch(store, 'user-1');

    history.unsubscribe();
    await store.save('user-1', session());

    expect(history.sessions).toEqual([]);
  });

  describe('image size', () => {
    const big = 'data:image/jpeg;base64,' + 'a'.repeat(900_000);
    const small = 'data:image/jpeg;base64,small';

    it('keeps an image that already fits the document limit', async () => {
      const store = makeStore({ shrinkImage: async () => { throw new Error('should not shrink'); } });

      const saved = await store.save('user-1', session({ imageUrl: small }));

      expect(saved.imageUrl).toBe(small);
    });

    it('shrinks an image over 800 KB', async () => {
      const calls: number[] = [];
      const store = makeStore({ shrinkImage: async (_url, target) => { calls.push(target); return small; } });

      const saved = await store.save('user-1', session({ imageUrl: big }));

      expect(calls).toEqual([800_000]);
      expect(saved.imageUrl).toBe(small);
    });

    it('drops an image that stays over 950 KB when Drive has a copy', async () => {
      const huge = 'data:image/jpeg;base64,' + 'a'.repeat(1_000_000);
      const store = makeStore({ shrinkImage: async () => huge });

      const saved = await store.save('user-1', session({ imageUrl: huge, driveLink: 'https://drive/x' }));

      expect(saved.imageUrl).toBe('');
      expect(saved.driveLink).toBe('https://drive/x');
    });

    it('keeps an oversized image when it is the only copy', async () => {
      const huge = 'data:image/jpeg;base64,' + 'a'.repeat(1_000_000);
      const store = makeStore({ shrinkImage: async () => huge });

      const saved = await store.save('user-1', session({ imageUrl: huge }));

      expect(saved.imageUrl).toBe(huge);
    });
  });

  describe('removal', () => {
    it('removes a saved Session', async () => {
      const store = makeStore();
      const history = watch(store, 'user-1');
      await store.save('user-1', session({ id: 'keep' }));
      await store.save('user-1', session({ id: 'gone' }));

      await store.remove('gone');

      expect(history.sessions.map((s) => s.id)).toEqual(['keep']);
    });

    it('treats removing a Session that was never saved as done', async () => {
      const store = makeStore();

      await expect(store.remove('never-saved')).resolves.toBeUndefined();
    });

    it("removes all of one user's Sessions and leaves other users' alone", async () => {
      const store = makeStore();
      const mine = watch(store, 'user-1');
      const theirs = watch(store, 'user-2');
      await store.save('user-1', session({ id: 'a' }));
      await store.save('user-1', session({ id: 'b' }));
      await store.save('user-2', session({ id: 'c' }));

      await store.removeAll('user-1');

      expect(mine.sessions).toEqual([]);
      expect(theirs.sessions.map((s) => s.id)).toEqual(['c']);
    });
  });

  describe('failures', () => {
    const boom = new Error('network down');
    const failing = (overrides: Partial<SessionAdapter>): SessionAdapter => ({
      ...createInMemorySessionAdapter(),
      ...overrides,
    });

    it.each([
      ['save', (store: ReturnType<typeof makeStore>) => store.save('user-1', session())],
      ['remove', (store: ReturnType<typeof makeStore>) => store.remove('draft-1')],
      ['removeAll', (store: ReturnType<typeof makeStore>) => store.removeAll('user-1')],
    ])('reports write-failed when %s cannot reach storage', async (_name, act) => {
      const store = makeStore({
        adapter: failing({
          put: async () => { throw boom; },
          delete: async () => { throw boom; },
          deleteAllFor: async () => { throw boom; },
        }),
      });

      const error = await act(store).catch((e) => e);

      expect(error).toBeInstanceOf(SessionStoreError);
      expect(error).toMatchObject({ kind: 'write-failed', cause: boom });
    });

    it('reports subscribe-failed when the subscription breaks', () => {
      const store = makeStore({ adapter: failing({ watch: (_uid, _onChange, onError) => { onError(boom); return () => {}; } }) });
      const errors: SessionStoreError[] = [];

      store.subscribe('user-1', () => {}, (e) => errors.push(e));

      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(SessionStoreError);
      expect(errors[0]).toMatchObject({ kind: 'subscribe-failed', cause: boom });
    });

    it('passes on quota-exceeded as reported by the adapter', () => {
      const quota = new SessionStoreError('quota-exceeded', boom);
      const store = makeStore({ adapter: failing({ watch: (_uid, _onChange, onError) => { onError(quota); return () => {}; } }) });
      const errors: SessionStoreError[] = [];

      store.subscribe('user-1', () => {}, (e) => errors.push(e));

      expect(errors).toEqual([quota]);
    });
  });
});
