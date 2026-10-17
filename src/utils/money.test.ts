import { describe, it, expect } from 'vitest';
import { rateToIls, isRateUnconfirmed, itemAmount, sessionTotal, subtotal, toDisplay, toIls } from './money';
import { ReceiptItem, Session } from '../types';

const item = (overrides: Partial<ReceiptItem> = {}): ReceiptItem => ({
  id: 'i', name: 'Item', price: 10, quantity: 1, assignedTo: [], ...overrides,
});

const session = (overrides: Partial<Session> = {}): Session => ({
  id: 's1',
  userId: 'user1',
  storeName: 'Store',
  items: [item({ id: 'a', price: 10 }), item({ id: 'b', price: 30 })],
  people: [],
  tax: 0,
  tip: 0,
  total: 40,
  currency: 'ILS',
  exchangeRate: 1,
  createdAt: new Date(2026, 0, 1).toISOString(),
  imageUrl: '',
  ...overrides,
});

describe('rateToIls', () => {
  it('is 1 for ILS whatever the stored rate', () => {
    expect(rateToIls({ currency: 'ILS', exchangeRate: 3.5 })).toBe(1);
  });

  it("uses a foreign Session's own rate", () => {
    expect(rateToIls({ currency: 'USD', exchangeRate: 3.6 })).toBe(3.6);
    expect(rateToIls({ currency: 'EUR', exchangeRate: 3.9 })).toBe(3.9);
  });

  it.each([undefined, 0, 1, -2, NaN])('falls back to the fixed rate when the rate is %s', (exchangeRate) => {
    expect(rateToIls({ currency: 'USD', exchangeRate: exchangeRate as number })).toBe(3.7);
    expect(rateToIls({ currency: 'EUR', exchangeRate: exchangeRate as number })).toBe(4.0);
  });

  it('treats a missing or unknown currency as ILS', () => {
    expect(rateToIls({ currency: undefined as unknown as Session['currency'], exchangeRate: 3 })).toBe(1);
    expect(rateToIls({ currency: 'GBP' as Session['currency'], exchangeRate: 5 })).toBe(1);
  });
});

describe('rateToIls for Sessions with rateConfirmed', () => {
  it.each([true, false])('uses its own positive rate, exactly 1 included (rateConfirmed: %s)', (rateConfirmed) => {
    expect(rateToIls({ currency: 'USD', exchangeRate: 3.1268, rateConfirmed })).toBe(3.1268);
    expect(rateToIls({ currency: 'USD', exchangeRate: 1, rateConfirmed })).toBe(1);
    expect(rateToIls({ currency: 'EUR', exchangeRate: 1, rateConfirmed })).toBe(1);
  });

  it.each([null, 0, -2, NaN])('falls back to the fixed rate when the rate is %s', (exchangeRate) => {
    expect(rateToIls({ currency: 'USD', exchangeRate, rateConfirmed: false })).toBe(3.7);
    expect(rateToIls({ currency: 'EUR', exchangeRate, rateConfirmed: true })).toBe(4.0);
  });

  it('is 1 for ILS', () => {
    expect(rateToIls({ currency: 'ILS', exchangeRate: null, rateConfirmed: false })).toBe(1);
  });
});

describe('isRateUnconfirmed', () => {
  it('is false for an old Session, which counts as confirmed', () => {
    expect(isRateUnconfirmed({ currency: 'USD', exchangeRate: 1 })).toBe(false);
  });

  it('is false for a confirmed Session', () => {
    expect(isRateUnconfirmed({ currency: 'USD', exchangeRate: 3.6, rateConfirmed: true })).toBe(false);
  });

  it('is true for an unconfirmed Session, with or without a rate', () => {
    expect(isRateUnconfirmed({ currency: 'USD', exchangeRate: 3.6, rateConfirmed: false })).toBe(true);
    expect(isRateUnconfirmed({ currency: 'EUR', exchangeRate: null, rateConfirmed: false })).toBe(true);
  });
});

describe('toIls', () => {
  it("converts an amount in the Session's currency at its rate", () => {
    expect(toIls(10, { currency: 'USD', exchangeRate: 3.6 })).toBeCloseTo(36);
  });

  it('uses the fixed rate when a foreign Session has a rate of 1', () => {
    expect(toIls(100, { currency: 'USD', exchangeRate: 1 })).toBeCloseTo(370);
  });

  it('leaves an ILS amount as is', () => {
    expect(toIls(42, { currency: 'ILS', exchangeRate: 3.5 })).toBe(42);
  });
});

describe('itemAmount', () => {
  it('is price × quantity when the total matches the subtotal', () => {
    const s = session({ items: [item({ price: 10, quantity: 3 }), item({ price: 5 })], total: 35 });
    expect(itemAmount(s, s.items[0])).toEqual({ original: 30, ils: 30 });
  });

  it('defaults a missing quantity to 1', () => {
    const s = session({ items: [item({ price: 10, quantity: undefined as unknown as number })], total: 10 });
    expect(itemAmount(s, s.items[0]).original).toBe(10);
  });

  it('spreads tax and tip over the items through the Session total', () => {
    const s = session({ total: 50 });
    expect(itemAmount(s, s.items[0]).original).toBeCloseTo(12.5);
    expect(itemAmount(s, s.items[1]).original).toBeCloseTo(37.5);
  });

  it('uses subtotal + tax + tip when the Session has no total', () => {
    const s = session({ total: 0, tax: 6, tip: 4 });
    expect(itemAmount(s, s.items[0]).original).toBeCloseTo(12.5);
  });

  it('spreads a discount the same way', () => {
    const s = session({ total: 32 });
    expect(itemAmount(s, s.items[0]).original).toBeCloseTo(8);
    expect(itemAmount(s, s.items[1]).original).toBeCloseTo(24);
  });

  it('makes the line amounts add up to the total', () => {
    const s = session({ items: [item({ price: 3.33, quantity: 3 }), item({ price: 7.1 })], total: 19.99, currency: 'USD', exchangeRate: 3.65 });
    const sum = s.items.reduce((acc, i) => acc + itemAmount(s, i).ils, 0);
    expect(sum).toBeCloseTo(sessionTotal(s).ils, 10);
  });

  it('applies no ratio when the subtotal is zero', () => {
    const s = session({ items: [item({ price: 0 })], total: 25 });
    expect(itemAmount(s, s.items[0])).toEqual({ original: 0, ils: 0 });
  });

  it('converts to ILS at the Session rate, or the fallback', () => {
    const usd = session({ currency: 'USD', exchangeRate: 3.5 });
    expect(itemAmount(usd, usd.items[0])).toEqual({ original: 10, ils: 35 });

    const eurNoRate = session({ currency: 'EUR', exchangeRate: 1 });
    expect(itemAmount(eurNoRate, eurNoRate.items[0])).toEqual({ original: 10, ils: 40 });
  });

  it('returns unrounded numbers', () => {
    const s = session({ items: [item({ price: 1 }), item({ price: 2 })], total: 1 });
    expect(itemAmount(s, s.items[0]).original).toBe(1 / 3);
  });
});

describe('sessionTotal', () => {
  it('is the stored total, converted', () => {
    expect(sessionTotal(session({ total: 50, currency: 'USD', exchangeRate: 0 }))).toEqual({ original: 50, ils: 185 });
  });

  it('falls back to subtotal + tax + tip', () => {
    expect(sessionTotal(session({ total: 0, tax: 5, tip: 2 })).original).toBe(47);
  });

  it('is tax + tip for a Session with no items and no total', () => {
    expect(sessionTotal(session({ items: [], total: 0, tax: 5, tip: 2 })).original).toBe(7);
  });
});

describe('subtotal', () => {
  it('sums price × quantity before tax and tip', () => {
    expect(subtotal(session({ items: [item({ price: 2, quantity: 3 }), item({ price: 4 })] }))).toBe(10);
  });

  it('is 0 for a Session without items', () => {
    expect(subtotal(session({ items: undefined as unknown as ReceiptItem[] }))).toBe(0);
  });
});

describe('toDisplay', () => {
  it('converts ILS at the fixed rates', () => {
    expect(toDisplay(37, 'ILS')).toBe(37);
    expect(toDisplay(37, 'USD')).toBeCloseTo(10);
    expect(toDisplay(40, 'EUR')).toBeCloseTo(10);
  });
});
