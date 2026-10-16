import { Person, ReceiptItem, Session } from '../types';
import { mimeTypeOf } from '../utils/imageUtils';

export const HOUSEHOLD_PERSON: Person = {
  id: 'person-family',
  name: 'משפחה',
  color: 'hsl(150, 70%, 50%)'
};

/** Gemini's receipt JSON as it arrives: loosely typed, cleaned up by intake. */
export interface RawParsedReceipt {
  store_or_brand_name?: unknown;
  store_name_english?: unknown;
  transaction_datetime?: unknown;
  price?: unknown;
  items?: unknown;
  tax?: unknown;
  tip?: unknown;
  currency?: unknown;
  exchange_rate_to_ils?: unknown;
}

/** Turns a prepared image into Gemini's raw receipt JSON. */
export type ReceiptParser = (dataUrl: string, mimeType: string) => Promise<RawParsedReceipt>;

/** Turns an upload or camera capture into a data URL ready for parsing. */
export type ImagePreparer = (input: File | string) => Promise<string>;

export interface ReceiptIntakeDeps {
  parser: ReceiptParser;
  prepare: ImagePreparer;
  now: () => number;
}

export type ReceiptIntakeErrorKind = 'unreadable-file' | 'parse-failed';

export class ReceiptIntakeError extends Error {
  name = 'ReceiptIntakeError';
  constructor(public kind: ReceiptIntakeErrorKind, public cause?: unknown) {
    super(`Receipt intake failed: ${kind}`);
  }
}

const CURRENCIES: Session['currency'][] = ['ILS', 'USD', 'EUR'];

/** A finite, non-zero number, or the fallback. */
const toNumber = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? n : fallback;
};

const toText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;

const toCurrency = (value: unknown): Session['currency'] =>
  CURRENCIES.includes(value as Session['currency']) ? (value as Session['currency']) : 'ILS';

/**
 * Reads the receipt's printed date as local wall-clock time.
 * Ambiguous a/b/YYYY is day-first; a missing time means noon.
 */
export const parseReceiptDate = (value: unknown): Date | null => {
  const text = toText(value)?.trim();
  if (!text) return null;

  const [datePart, timePart = '12:00:00'] = text.split(/[ T]/);
  const fields = datePart.split(/[-/.]/);
  if (fields.length !== 3) return null;

  const [a, b, c] = fields.map(Number);
  const [year, month, day] = fields[0].length === 4 ? [a, b, c] : [c, b, a];
  // The printed time is wall-clock; a zone suffix from the parser is ignored.
  const wallClock = timePart.replace(/(Z|[+-]\d{2}:?\d{2})$/i, '');
  const [hours = 12, minutes = 0, seconds = 0] = wallClock.split(':').map(Number);

  const date = new Date(year, month - 1, day, hours, minutes, seconds);
  const isExact = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return isExact && !isNaN(date.getTime()) ? date : null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const toLabels = (value: unknown): string[] | undefined =>
  Array.isArray(value) ? value.filter((label): label is string => typeof label === 'string') : undefined;

const toItems = (rawItems: unknown): ReceiptItem[] =>
  (Array.isArray(rawItems) ? rawItems : []).filter(isRecord).map((item, idx) => ({
    id: `item-${idx}`,
    name: toText(item.name) ?? '',
    price: toNumber(item.unit_price, toNumber(item.price, 0)),
    quantity: toNumber(item.quantity, 1),
    category: toText(item.category),
    labels: toLabels(item.labels),
    assignedTo: [HOUSEHOLD_PERSON.id]
  }));

export const createReceiptIntake = ({ parser, prepare, now }: ReceiptIntakeDeps) => {
  const prepareOrFail = async (input: File | string) => {
    try {
      return await prepare(input);
    } catch (error) {
      throw new ReceiptIntakeError('unreadable-file', error);
    }
  };

  const parseOrFail = async (dataUrl: string) => {
    let raw: unknown;
    try {
      raw = await parser(dataUrl, mimeTypeOf(dataUrl));
    } catch (error) {
      throw new ReceiptIntakeError('parse-failed', error);
    }
    if (!isRecord(raw)) {
      throw new ReceiptIntakeError('parse-failed', raw);
    }
    return raw as RawParsedReceipt;
  };

  return {
    /** Turns one upload or camera capture into a Draft Session. */
    async intake(input: File | string, userId: string): Promise<Session> {
      const dataUrl = await prepareOrFail(input);
      const raw = await parseOrFail(dataUrl);
      const storeName = toText(raw.store_or_brand_name);

      return {
        id: now().toString(),
        userId,
        storeName: storeName ?? 'unknown',
        englishStoreName: toText(raw.store_name_english) ?? storeName ?? 'unknown',
        createdAt: (parseReceiptDate(raw.transaction_datetime) ?? new Date(now())).toISOString(),
        items: toItems(raw.items),
        people: [HOUSEHOLD_PERSON],
        tax: toNumber(raw.tax, 0),
        tip: toNumber(raw.tip, 0),
        total: toNumber(raw.price, 0),
        currency: toCurrency(raw.currency),
        exchangeRate: toNumber(raw.exchange_rate_to_ils, 1),
        imageUrl: dataUrl,
      };
    },
  };
};
