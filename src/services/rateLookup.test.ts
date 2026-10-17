import { describe, it, expect } from 'vitest';
import { createFrankfurterRateLookup } from './rateLookup';

const respond = (body: unknown, init: ResponseInit = { status: 200 }) =>
  new Response(JSON.stringify(body), { ...init, headers: { 'content-type': 'application/json' } });

describe('Frankfurter Rate lookup', () => {
  it('asks for the currency to ILS on the given date and returns the ILS rate', async () => {
    const requested: string[] = [];
    const lookup = createFrankfurterRateLookup(async (url) => {
      requested.push(String(url));
      return respond({ amount: 1, base: 'USD', date: '2026-03-13', rates: { ILS: 3.1268 } });
    });

    expect(await lookup('USD', '2026-03-15')).toBe(3.1268);
    expect(requested).toEqual(['https://api.frankfurter.dev/v1/2026-03-15?from=USD&to=ILS']);
  });

  it('asks for EUR when the Session is in EUR', async () => {
    const requested: string[] = [];
    const lookup = createFrankfurterRateLookup(async (url) => {
      requested.push(String(url));
      return respond({ amount: 1, base: 'EUR', date: '2026-03-13', rates: { ILS: 3.62 } });
    });

    expect(await lookup('EUR', '2026-03-13')).toBe(3.62);
    expect(requested).toEqual(['https://api.frankfurter.dev/v1/2026-03-13?from=EUR&to=ILS']);
  });

  it('returns null on a network error', async () => {
    const lookup = createFrankfurterRateLookup(async () => { throw new TypeError('Failed to fetch'); });

    expect(await lookup('USD', '2026-03-15')).toBeNull();
  });

  it('returns null on a non-OK response', async () => {
    const lookup = createFrankfurterRateLookup(async () => respond({ message: 'not found' }, { status: 404 }));

    expect(await lookup('USD', '2026-03-15')).toBeNull();
  });

  it.each([
    { amount: 1, base: 'USD', date: '2026-03-13', rates: {} },
    { amount: 1, base: 'USD', date: '2026-03-13', rates: { ILS: 'n/a' } },
    { amount: 1, base: 'USD', date: '2026-03-13', rates: { ILS: 0 } },
    { amount: 1, base: 'USD', date: '2026-03-13' },
    null,
  ])('returns null when the response has no usable ILS rate: %j', async (body) => {
    const lookup = createFrankfurterRateLookup(async () => respond(body));

    expect(await lookup('USD', '2026-03-15')).toBeNull();
  });

  it('returns null when the body is not JSON', async () => {
    const lookup = createFrankfurterRateLookup(async () => new Response('<html>oops</html>', { status: 200 }));

    expect(await lookup('USD', '2026-03-15')).toBeNull();
  });
});
