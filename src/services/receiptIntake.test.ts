/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { createReceiptIntake, RawParsedReceipt } from './receiptIntake';

const JPEG = 'data:image/jpeg;base64,abc';
const NOW = new Date('2026-03-15T09:30:00.000Z').getTime();
const DRAFT_ID = 'draft-0b7c';

const makeIntake = (response: RawParsedReceipt) =>
  createReceiptIntake({
    parser: async () => response,
    prepare: async (input) => input as string,
    now: () => NOW,
    newId: () => DRAFT_ID,
  });

describe('Receipt intake', () => {
  it('turns a clean parser response into a Draft Session', async () => {
    const intake = makeIntake({
      store_or_brand_name: 'שופרסל',
      store_name_english: 'Supersal',
      transaction_datetime: '2026-02-10 18:45:00',
      price: 120.5,
      items: [],
      tax: 17.5,
      tip: 0,
      currency: 'USD',
      exchange_rate_to_ils: 3.6,
    });

    const draft = await intake.intake(JPEG, 'user-1');

    expect(draft).toMatchObject({
      userId: 'user-1',
      storeName: 'שופרסל',
      englishStoreName: 'Supersal',
      total: 120.5,
      tax: 17.5,
      tip: 0,
      currency: 'USD',
      exchangeRate: 3.6,
      imageUrl: JPEG,
    });
  });

  it('maps items and assigns them all to the Household person', async () => {
    const intake = makeIntake({
      store_or_brand_name: 'Shop',
      price: 32,
      items: [
        { name: 'Milk', unit_price: 6, quantity: 2, category: 'Food', labels: ['Dairy'] },
        { name: 'Bread', price: 20, category: 'Food', labels: ['Bakery'] },
      ],
      currency: 'ILS',
    });

    const draft = await intake.intake(JPEG, 'user-1');

    expect(draft.people).toEqual([
      { id: 'person-family', name: 'משפחה', color: 'hsl(150, 70%, 50%)' },
    ]);
    expect(draft.items).toEqual([
      { id: 'item-0', name: 'Milk', price: 6, quantity: 2, category: 'Food', labels: ['Dairy'], assignedTo: ['person-family'] },
      { id: 'item-1', name: 'Bread', price: 20, quantity: 1, category: 'Food', labels: ['Bakery'], assignedTo: ['person-family'] },
    ]);
  });

  it('cleans up missing and non-numeric values', async () => {
    const intake = makeIntake({
      store_or_brand_name: null,
      price: '45.90',
      tax: null,
      tip: 'n/a',
      currency: 'GBP',
      exchange_rate_to_ils: 0,
    });

    const draft = await intake.intake(JPEG, 'user-1');

    expect(draft).toMatchObject({
      storeName: 'unknown',
      englishStoreName: 'unknown',
      total: 45.9,
      tax: 0,
      tip: 0,
      currency: 'ILS',
      exchangeRate: 1,
      items: [],
    });
  });

  it('falls back to the original store name when there is no English name', async () => {
    const draft = await makeIntake({ store_or_brand_name: 'רמי לוי' }).intake(JPEG, 'user-1');

    expect(draft.englishStoreName).toBe('רמי לוי');
  });

  it('cleans up item prices and quantities', async () => {
    const draft = await makeIntake({
      items: [
        { name: 'Eggs', unit_price: '12.5', quantity: '3' },
        { name: 'Bag', unit_price: null, quantity: 0 },
      ],
    }).intake(JPEG, 'user-1');

    expect(draft.items.map(({ price, quantity }) => ({ price, quantity }))).toEqual([
      { price: 12.5, quantity: 3 },
      { price: 0, quantity: 1 },
    ]);
  });

  it('skips item entries that are not objects and cleans item text fields', async () => {
    const draft = await makeIntake({
      items: [null, 'Milk 6.00', { name: 'Eggs', unit_price: 12 }, { name: 42, category: 7, labels: ['Dairy', 3, null] }],
    }).intake(JPEG, 'user-1');

    expect(draft.items).toEqual([
      { id: 'item-0', name: 'Eggs', price: 12, quantity: 1, category: undefined, labels: undefined, assignedTo: ['person-family'] },
      { id: 'item-1', name: '', price: 0, quantity: 1, category: undefined, labels: ['Dairy'], assignedTo: ['person-family'] },
    ]);
  });

  it.each([
    ['data:image/jpeg;base64,abc', 'image/jpeg'],
    ['data:application/pdf;base64,abc', 'application/pdf'],
    ['data:image/heic;base64,abc', 'image/heic'],
  ])('sends the prepared %s to the parser as %s', async (prepared, mimeType) => {
    const calls: [string, string][] = [];
    const intake = createReceiptIntake({
      parser: async (dataUrl, mime) => { calls.push([dataUrl, mime]); return {}; },
      prepare: async () => prepared,
      now: () => NOW,
      newId: () => DRAFT_ID,
    });

    const draft = await intake.intake(new File(['x'], 'receipt.bin'), 'user-1');

    expect(calls).toEqual([[prepared, mimeType]]);
    expect(draft.imageUrl).toBe(prepared);
  });

  it('takes the draft ID from newId', async () => {
    const draft = await makeIntake({}).intake(JPEG, 'user-1');

    expect(draft.id).toBe(DRAFT_ID);
  });

  describe('recorded Gemini responses', () => {
    // Real parser output captured with `npm run capture:gemini` (see TESTING.md).
    const recorded = Object.entries(
      import.meta.glob<RawParsedReceipt>('./__fixtures__/gemini/*.json', { eager: true, import: 'default' })
    );

    if (recorded.length === 0) {
      it.skip('no recorded responses yet: capture some with npm run capture:gemini', () => {});
    }

    it.each(recorded)('%s becomes a well-formed Draft Session', async (_path, response) => {
      const draft = await makeIntake(response).intake(JPEG, 'user-1');

      expect(draft.storeName).not.toBe('');
      expect(['ILS', 'USD', 'EUR']).toContain(draft.currency);
      expect(Number.isNaN(Date.parse(draft.createdAt))).toBe(false);
      for (const value of [draft.total, draft.tax, draft.tip, draft.exchangeRate]) {
        expect(Number.isFinite(value)).toBe(true);
      }
      for (const item of draft.items) {
        expect(typeof item.name).toBe('string');
        expect(Number.isFinite(item.price)).toBe(true);
        expect(item.quantity).toBeGreaterThan(0);
        expect(item.assignedTo).toEqual(['person-family']);
      }
    });
  });

  describe('failures', () => {
    const intakeWith = (deps: Partial<Parameters<typeof createReceiptIntake>[0]>) =>
      createReceiptIntake({
        parser: async () => ({}),
        prepare: async () => JPEG,
        now: () => NOW,
        newId: () => DRAFT_ID,
        ...deps,
      });

    it('reports unreadable-file when the image cannot be prepared', async () => {
      const intake = intakeWith({ prepare: async () => { throw new Error('Failed to decode image'); } });

      await expect(intake.intake(JPEG, 'user-1')).rejects.toMatchObject({
        name: 'ReceiptIntakeError',
        kind: 'unreadable-file',
      });
    });

    it('reports parse-failed when the parser throws', async () => {
      const intake = intakeWith({ parser: async () => { throw new Error('Gemini timeout'); } });

      await expect(intake.intake(JPEG, 'user-1')).rejects.toMatchObject({ kind: 'parse-failed' });
    });

    it.each([null, 'oops', 42])('reports parse-failed when the parser returns %j', async (junk) => {
      const intake = intakeWith({ parser: async () => junk as unknown as RawParsedReceipt });

      await expect(intake.intake(JPEG, 'user-1')).rejects.toMatchObject({ kind: 'parse-failed' });
    });
  });

  describe('receipt date', () => {
    const createdAtFor = async (transaction_datetime: unknown) =>
      (await makeIntake({ transaction_datetime }).intake(JPEG, 'user-1')).createdAt;

    const local = (y: number, m: number, d: number, h = 12, min = 0) =>
      new Date(y, m - 1, d, h, min).toISOString();

    it.each([
      ['2026-02-10 18:45:00', local(2026, 2, 10, 18, 45)],
      ['2026-02-10T18:45:00', local(2026, 2, 10, 18, 45)],
      ['2026-04-03', local(2026, 4, 3)],
      ['03/04/2026', local(2026, 4, 3)],
      ['3/4/2026 08:15:00', local(2026, 4, 3, 8, 15)],
      ['2026/04/03', local(2026, 4, 3)],
      ['2026-02-10T18:45:00Z', local(2026, 2, 10, 18, 45)],
      ['2026-02-10T18:45:00+02:00', local(2026, 2, 10, 18, 45)],
      ['2026-02-10T18:45:00.000', local(2026, 2, 10, 18, 45)],
      ['2026-02-10 18:45', local(2026, 2, 10, 18, 45)],
    ])('reads %s as %s', async (raw, expected) => {
      expect(await createdAtFor(raw)).toBe(expected);
    });

    it.each([null, '', 'not a date', '31/31/2026'])('falls back to now for %s', async (raw) => {
      expect(await createdAtFor(raw)).toBe(new Date(NOW).toISOString());
    });
  });
});
