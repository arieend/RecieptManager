import type { RateLookup } from '../rateLookup';

/** A fake Rate lookup for tests: answers from a table and records what it was asked. */
export const fakeRateLookup = (rates: Record<string, number | null> = { USD: 3.1268, EUR: 3.62 }) => {
  const calls: [string, string][] = [];
  const lookup: RateLookup = async (currency, date) => {
    calls.push([currency, date]);
    return rates[currency] ?? null;
  };
  return { lookup, calls };
};
