import { describe, it, expect } from 'vitest';
import {
  aggregateCategoryBreakdown,
  generateDailySpendingSeries,
  generateMonthlyTrendSeries,
  getAvailableMonthsForYear,
} from './monthlySummary';
import { ReceiptItem, Session } from '../types';

const item = (overrides: Partial<ReceiptItem> = {}): ReceiptItem => ({
  id: 'i', name: 'Item', price: 10, quantity: 1, assignedTo: [], category: 'food', ...overrides,
});

const session = (overrides: Partial<Session> = {}): Session => ({
  id: 's1',
  userId: 'user1',
  storeName: 'Store',
  items: [item({ id: 'a', price: 10, quantity: 2, category: 'food' }), item({ id: 'b', price: 20, category: 'home' })],
  people: [],
  tax: 0,
  tip: 0,
  total: 40,
  currency: 'ILS',
  exchangeRate: 1,
  createdAt: new Date(2026, 2, 14, 12).toISOString(),
  imageUrl: '',
  ...overrides,
});

/** Reads a month or day back by its key, not its position in the series. */
const march = (months: ReturnType<typeof getAvailableMonthsForYear>) => months.find((m) => m.monthKey === '2026-03')!;

describe('getAvailableMonthsForYear', () => {
  it('totals each month in the display currency', () => {
    const months = getAvailableMonthsForYear([session(), session({ id: 's2', total: 34 })], 2026, 'ILS');
    expect(march(months)).toMatchObject({ receiptCount: 2, totalAmount: 74 });
  });

  it('gives a USD Session with no rate the fallback rate', () => {
    const months = getAvailableMonthsForYear([session({ currency: 'USD', exchangeRate: 1, total: 10 })], 2026, 'ILS');
    expect(march(months).totalAmount).toBeCloseTo(37);
  });

  it('converts ILS to USD at the fixed rate', () => {
    const months = getAvailableMonthsForYear([session({ total: 37 })], 2026, 'USD');
    expect(march(months).totalAmount).toBeCloseTo(10);
  });

  it('falls back to subtotal + tax + tip when the Session has no total', () => {
    const months = getAvailableMonthsForYear([session({ total: 0, tax: 5, tip: 5 })], 2026, 'ILS');
    expect(march(months).totalAmount).toBe(50);
  });
});

describe('aggregateCategoryBreakdown', () => {
  it('gives each category its Line amounts, which add up to the total', () => {
    const { categories, totalSpent, totalItems } = aggregateCategoryBreakdown([session({ total: 50 })], 'ILS');

    expect(totalSpent).toBeCloseTo(50);
    expect(totalItems).toBe(3);
    const food = categories.find((c) => c.name === 'Food')!;
    const home = categories.find((c) => c.name === 'Home')!;
    expect(food.amount).toBeCloseTo(25);
    expect(home.amount).toBeCloseTo(25);
    expect(food.items[0]).toMatchObject({ price: 25, quantity: 2, currency: 'ILS' });
    expect(food.items[0].convertedPrice).toBeCloseTo(25);
  });

  it('converts a foreign Session at its own rate into the display currency', () => {
    const { totalSpent } = aggregateCategoryBreakdown([session({ currency: 'EUR', exchangeRate: 3.7 })], 'USD');
    // 40 EUR × 3.7 = 148 ILS = 40 USD
    expect(totalSpent).toBeCloseTo(40);
  });

  it('puts a Session without items under General at its total', () => {
    const { categories, totalSpent } = aggregateCategoryBreakdown(
      [session({ items: [], total: 10, currency: 'USD', exchangeRate: 0 })],
      'ILS',
    );
    expect(totalSpent).toBeCloseTo(37);
    expect(categories).toHaveLength(1);
    expect(categories[0]).toMatchObject({ name: 'General', itemCount: 1, receiptCount: 1 });
    expect(categories[0].items[0]).toMatchObject({ price: 10, currency: 'USD' });
  });
});

describe('generateMonthlyTrendSeries', () => {
  it('stacks Line amounts per category and month', () => {
    const { series, topCategories } = generateMonthlyTrendSeries(
      [session({ total: 50 }), session({ id: 'empty', items: [], total: 8 })],
      '2026-03',
      'ILS',
    );
    const march = series.find((p) => p.monthKey === '2026-03')!;

    expect(march.total).toBe(58);
    expect(march.receiptCount).toBe(2);
    expect(march.Food).toBe(25);
    expect(march.Home).toBe(25);
    expect(march.General).toBe(8);
    expect(topCategories).toEqual(expect.arrayContaining(['Food', 'Home', 'General']));
  });

  it('converts to the display currency', () => {
    const { series } = generateMonthlyTrendSeries([session({ total: 37, items: [item({ price: 37 })] })], '2026-03', 'USD');
    expect(series.find((p) => p.monthKey === '2026-03')!.total).toBe(10);
  });
});

describe('generateDailySpendingSeries', () => {
  it('totals each day in the display currency', () => {
    const days = generateDailySpendingSeries(
      [session(), session({ id: 's2', currency: 'USD', exchangeRate: 1, total: 10 })],
      '2026-03',
      'ILS',
    );
    expect(days).toHaveLength(31);
    expect(days.find((d) => d.dateStr === '2026-03-14')).toMatchObject({ day: 14, receiptCount: 2, total: 77 });
  });
});
