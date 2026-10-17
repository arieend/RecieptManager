import { describe, it, expect } from 'vitest';
import { createGoogleAccess } from './googleAccess';

const MINUTE = 60 * 1000;

const setup = (initial: Record<string, string> = {}) => {
  const entries = new Map(Object.entries(initial));
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
    removeItem: (key: string) => { entries.delete(key); },
  };
  let time = 1_000_000;
  const clock = { advance: (ms: number) => { time += ms; } };
  const access = createGoogleAccess({ storage, now: () => time });
  return { access, entries, clock };
};

describe('Google access', () => {
  it('returns a stored token before 55 minutes have passed', () => {
    const { access, clock } = setup();

    access.store('token-1');
    clock.advance(55 * MINUTE - 1);

    expect(access.current()).toBe('token-1');
  });

  it('treats a token as expired at 55 minutes and clears both storage keys', () => {
    const { access, entries, clock } = setup();

    access.store('token-1');
    clock.advance(55 * MINUTE);

    expect(access.current()).toBeNull();
    expect([...entries.keys()]).toEqual([]);
  });

  it('keeps a token stored before this module existed under the same keys', () => {
    const { access } = setup({ drive_token: 'old-token', drive_token_timestamp: String(1_000_000 - 10 * MINUTE) });

    expect(access.current()).toBe('old-token');
  });

  it('treats a token with no timestamp as missing', () => {
    const { access } = setup({ drive_token: 'orphan' });

    expect(access.current()).toBeNull();
  });

  it.each(['invalidate', 'clear'] as const)('%s removes both storage keys', (method) => {
    const { access, entries } = setup();
    access.store('token-1');

    access[method]();

    expect(access.current()).toBeNull();
    expect([...entries.keys()]).toEqual([]);
  });
});
