import { ReceiptItem, Session } from '../types';

export type Currency = Session['currency'];

/** The part of a Session its rate to ILS depends on. */
export type RatedSession = Pick<Session, 'currency' | 'exchangeRate'>;

/** An amount in the Session's own currency and in ILS, unrounded. */
export interface Amount {
  original: number;
  ils: number;
}

/** ILS per unit, used when a Session has no rate of its own and for the display currency. */
const FIXED_RATES: Record<Currency, number> = { ILS: 1, USD: 3.7, EUR: 4.0 };

const isCurrency = (value: unknown): value is Currency => typeof value === 'string' && value in FIXED_RATES;

/** The Session's rate to ILS. A missing, 0 or exactly-1 rate on a USD or EUR Session counts as no rate. */
export const rateToIls = (session: RatedSession): number => {
  const currency = session.currency || 'ILS';
  if (!isCurrency(currency) || currency === 'ILS') return 1;

  const rate = Number(session.exchangeRate);
  return rate > 0 && rate !== 1 ? rate : FIXED_RATES[currency];
};

/** Converts an amount in the Session's own currency to ILS at its rate. */
export const toIls = (amount: number, session: RatedSession): number => amount * rateToIls(session);

const unitTotal = (item: ReceiptItem) => (Number(item.price) || 0) * (Number(item.quantity) || 1);

/** Unit price × quantity, summed over the Session's items, before tax, tip and discounts. */
export const subtotal = (session: Session): number => (session.items || []).reduce((sum, item) => sum + unitTotal(item), 0);

const totalOriginal = (session: Session) =>
  Number(session.total) || subtotal(session) + (Number(session.tax) || 0) + (Number(session.tip) || 0);

/** What the Session cost: its total, or the subtotal plus tax and tip when it has none. */
export const sessionTotal = (session: Session): Amount => {
  const original = totalOriginal(session);
  return { original, ils: toIls(original, session) };
};

/** The Line amount: unit price × quantity plus the item's share of tax, tip and discounts. */
export const itemAmount = (session: Session, item: ReceiptItem): Amount => {
  const sub = subtotal(session);
  const ratio = sub > 0 ? totalOriginal(session) / sub : 1;
  const original = unitTotal(item) * ratio;
  return { original, ils: toIls(original, session) };
};

/** Converts an ILS amount to the display currency at the fixed rates. */
export const toDisplay = (amountIls: number, currency: Currency): number => amountIls / FIXED_RATES[currency];
