import type { Session } from '../types';
import { isUsableRate } from '../utils/money';

/** A currency that has a rate to ILS to look up. ILS itself is never looked up. */
export type ForeignCurrency = Exclude<Session['currency'], 'ILS'>;

/**
 * Rate lookup: the published rate to ILS for a currency on a date (`YYYY-MM-DD`),
 * or null when it can't be had. Never throws. See GLOSSARY.md and ADR-0002.
 */
export type RateLookup = (currency: ForeignCurrency, date: string) => Promise<number | null>;

const pad = (n: number) => String(n).padStart(2, '0');

/** The local calendar date of a Session's `createdAt`, as `YYYY-MM-DD`, for a Rate lookup. */
export const rateDateOf = (createdAt: string): string => {
  const date = new Date(createdAt);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const FRANKFURTER = 'https://api.frankfurter.dev/v1';

/**
 * ECB reference rates through Frankfurter. A date with no rate (a weekend or holiday)
 * gets the last business day on or before it.
 */
export const createFrankfurterRateLookup =
  (fetchImpl: typeof fetch = (input, init) => fetch(input, init)): RateLookup =>
  async (currency, date) => {
    try {
      const response = await fetchImpl(`${FRANKFURTER}/${date}?from=${currency}&to=ILS`);
      if (!response.ok) return null;
      const body = await response.json();
      const rate = Number(body?.rates?.ILS);
      return isUsableRate(rate) ? rate : null;
    } catch {
      return null;
    }
  };

/**
 * The Session in a new currency. USD or EUR gets the looked-up rate for the receipt's date,
 * Unconfirmed (null when the lookup fails); ILS gets rate 1, confirmed.
 */
export const withCurrency = async (
  session: Omit<Session, 'currency' | 'exchangeRate' | 'rateConfirmed'>,
  currency: Session['currency'],
  lookup: RateLookup,
): Promise<Session> => {
  if (currency === 'ILS') return { ...session, currency, exchangeRate: 1, rateConfirmed: true };
  const rate = await lookup(currency, rateDateOf(session.createdAt));
  return { ...session, currency, exchangeRate: rate, rateConfirmed: false };
};
