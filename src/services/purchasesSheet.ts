import { ReceiptItem, Session } from '../types';
import { HOUSEHOLD_PERSON } from './receiptIntake';
import { itemAmount, rateToIls } from '../utils/money';

/** A cell as the Purchases sheet reads it back: its shown text and any number format. */
export interface SheetCell {
  value: string;
  numberFormat?: { type?: string; pattern?: string };
}

export interface SpreadsheetTab {
  sheetId: number;
  title: string;
}

/** 1-based, inclusive. */
export interface RowSpan {
  firstRow: number;
  lastRow: number;
}

/** Where spreadsheets live: Google Sheets in production, memory in tests. Failures throw, carrying `status` when HTTP gave one. */
export interface SpreadsheetAdapter {
  findByName(name: string): Promise<string | null>;
  /** Creates a spreadsheet whose one tab has a frozen header row. */
  create(name: string, tab: { title: string; headers: string[]; locale: string }): Promise<{ spreadsheetId: string; sheetId: number }>;
  describe(spreadsheetId: string): Promise<{ locale: string; tabs: SpreadsheetTab[] }>;
  /** The first `rowCount` rows of the tab, header included. */
  readTop(spreadsheetId: string, tabTitle: string, rowCount: number): Promise<SheetCell[][]>;
  /** Appends after the last row; the span is null when the adapter can't tell where the rows landed. */
  append(spreadsheetId: string, tabTitle: string, rows: unknown[][]): Promise<RowSpan | null>;
  /** Gives one column a DATE format: the given rows, or every row below the header. */
  formatDates(spreadsheetId: string, target: { sheetId: number; column: number; rows?: RowSpan }, sheetsPattern: string): Promise<void>;
}

const TAB_TITLE = 'Purchases';
const NEW_SHEET_LOCALE = 'iw_IL';
const ROWS_SAMPLED = 25;

/** The date format the sheet already uses: ours (`DD/MM/YYYY`) and Google's (`dd/mm/yyyy`). */
interface DateFormat {
  pattern: string;
  sheetsPattern: string;
}

/** Where to write and how to write dates, as found in the sheet. */
interface Target {
  tab: { title: string; sheetId?: number };
  dateColumn: number;
  dateFormat: DateFormat;
}

const DEFAULT_DATE_FORMAT: DateFormat = { pattern: 'DD/MM/YYYY', sheetsPattern: 'dd/mm/yyyy' };
const US_DATE_FORMAT: DateFormat = { pattern: 'MM/DD/YYYY', sheetsPattern: 'mm/dd/yyyy' };

const formatDate = (date: Date, pattern: string): string => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear().toString();
  const shortYear = year.slice(-2);
  const shortDay = date.getDate().toString();
  const shortMonth = (date.getMonth() + 1).toString();

  const normalized = (pattern || 'DD/MM/YYYY').toUpperCase().trim();

  if (normalized.includes('YYYY-MM-DD')) return `${year}-${month}-${day}`;
  if (normalized.includes('YYYY/MM/DD')) return `${year}/${month}/${day}`;

  if (normalized === 'M/D/YYYY' || normalized === 'M/D/YY') {
    return `${shortMonth}/${shortDay}/${normalized.includes('YYYY') ? year : shortYear}`;
  }
  if (normalized.startsWith('MM/DD') || normalized.startsWith('M/D')) {
    return `${month}/${day}/${normalized.includes('YYYY') ? year : shortYear}`;
  }

  if (normalized.includes('.')) {
    return normalized.startsWith('D.') ? `${shortDay}.${shortMonth}.${year}` : `${day}.${month}.${year}`;
  }

  if (normalized.includes('-') && normalized.startsWith('DD')) return `${day}-${month}-${year}`;

  if (normalized === 'D/M/YYYY' || normalized === 'D/M/YY') {
    return `${shortDay}/${shortMonth}/${normalized.includes('YYYY') ? year : shortYear}`;
  }

  // No leading quote, so Sheets parses it as a native date.
  return `${day}/${month}/${year}`;
};

const isUsLocale = (locale: string) => {
  const l = locale.toLowerCase();
  return l.startsWith('en_us') || l === 'en-us';
};

const formatForLocale = (locale: string): DateFormat => (isUsLocale(locale) ? US_DATE_FORMAT : DEFAULT_DATE_FORMAT);

/** Maps a Sheets number-format pattern onto ours. */
const fromSheetsPattern = (sheetsPattern: string): string => {
  const p = sheetsPattern.toLowerCase();
  if (p.includes('yyyy') && p.includes('mm') && p.includes('dd')) {
    if (p.indexOf('yyyy') < p.indexOf('mm')) {
      return p.includes('/') ? 'YYYY/MM/DD' : 'YYYY-MM-DD';
    }
    if (p.indexOf('dd') < p.indexOf('mm')) {
      if (p.includes('.')) return 'DD.MM.YYYY';
      if (p.includes('-')) return 'DD-MM-YYYY';
      return 'DD/MM/YYYY';
    }
    return 'MM/DD/YYYY';
  }
  if (p.includes('d') && p.includes('m') && p.includes('yy')) {
    if (p.indexOf('d') < p.indexOf('m')) {
      if (p.includes('.')) return 'DD.MM.YYYY';
      if (p.includes('-')) return 'DD-MM-YYYY';
      return 'DD/MM/YYYY';
    }
    return 'MM/DD/YYYY';
  }
  return 'DD/MM/YYYY';
};

/** Reads the format off a date as shown; ambiguous slashes follow the locale. */
const formatOfShownDate = (shown: string, locale: string): DateFormat | null => {
  const trimmed = shown.trim();

  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(trimmed)) {
    return trimmed.includes('/')
      ? { pattern: 'YYYY/MM/DD', sheetsPattern: 'yyyy/mm/dd' }
      : { pattern: 'YYYY-MM-DD', sheetsPattern: 'yyyy-mm-dd' };
  }
  if (/^\d{1,2}\.\d{1,2}\.\d{4}/.test(trimmed)) return { pattern: 'DD.MM.YYYY', sheetsPattern: 'dd.mm.yyyy' };
  if (/^\d{1,2}-\d{1,2}-\d{4}/.test(trimmed)) return { pattern: 'DD-MM-YYYY', sheetsPattern: 'dd-mm-yyyy' };

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    if (parseInt(slashMatch[1], 10) > 12) return DEFAULT_DATE_FORMAT;
    if (parseInt(slashMatch[2], 10) > 12) return US_DATE_FORMAT;
    return formatForLocale(locale);
  }

  return null;
};

const isDateHeader = (header: string) => {
  const h = header.trim().toLowerCase();
  return h.includes('date') || h.includes('תאריך');
};

/** The format of the first date found under the header: an explicit DATE format wins over the shown text. */
const dateFormatIn = (rows: SheetCell[][], column: number, locale: string): DateFormat | null => {
  for (const row of rows.slice(1)) {
    const cell = row[column];
    if (!cell) continue;

    const { type, pattern } = cell.numberFormat ?? {};
    if ((type === 'DATE' || type === 'DATE_TIME') && pattern) {
      return { pattern: fromSheetsPattern(pattern), sheetsPattern: pattern };
    }

    const shown = cell.value.trim();
    if (shown && !isDateHeader(shown)) {
      const detected = formatOfShownDate(shown, locale);
      if (detected) return detected;
    }
  }
  return null;
};

const roundCents = (amount: number) => Math.round(amount * 100) / 100;

type Row = { session: Session; item: ReceiptItem; target: Target; links: ReceiptLinks };

/** Each column once: its header on a new sheet and its value in every appended row. */
const COLUMNS: { header: string; value: (row: Row) => unknown }[] = [
  { header: 'Date', value: ({ session, target }) => formatDate(new Date(session.createdAt), target.dateFormat.pattern) },
  { header: 'Store', value: ({ session }) => session.storeName },
  { header: 'Item Name', value: ({ item }) => item.name },
  // The Line amount. Sheets created before it keep their 'Price (NIS)' header (ADR-0001).
  { header: 'Amount (NIS)', value: ({ session, item }) => roundCents(itemAmount(session, item).ils) },
  { header: 'Category', value: ({ item }) => item.category || '' },
  { header: 'AI Tags', value: ({ item }) => (item.labels || []).join(', ') },
  {
    header: 'Assigned To',
    value: ({ session, item }) =>
      item.assignedTo
        .map((id) => session.people.find((p) => p.id === id)?.name)
        .filter(Boolean)
        .join(', ') || HOUSEHOLD_PERSON.name,
  },
  {
    header: 'Receipt Link',
    value: ({ session, links }) => {
      const driveLink = links.driveLink || session.driveLink || '';
      const fileName = links.driveFileName || session.driveFileName || (session.storeName ? `${session.storeName}_Receipt` : 'Receipt');
      return driveLink ? `=HYPERLINK("${driveLink}", "${fileName}")` : '';
    },
  },
  {
    header: 'Original Amount',
    value: ({ session, item }) => (session.currency !== 'ILS' ? `${itemAmount(session, item).original.toFixed(2)} ${session.currency}` : ''),
  },
  { header: 'Exchange Rate', value: ({ session }) => (session.currency !== 'ILS' ? rateToIls(session) : '') },
];

/** Links from a Drive upload in this same sync, preferred over the ones the Session already has. */
export interface ReceiptLinks {
  driveLink?: string;
  driveFileName?: string;
}

export interface Appended {
  spreadsheetLink: string;
  /** Each ReceiptItem's row, by item ID; missing when the adapter couldn't say where the rows landed. */
  itemLinks?: Record<string, string>;
}

const spreadsheetLinkOf = (spreadsheetId: string) => `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

export const createPurchasesSheet = (adapter: SpreadsheetAdapter) => {
  const formatDatesQuietly = async (...args: Parameters<SpreadsheetAdapter['formatDates']>) => {
    try {
      await adapter.formatDates(...args);
    } catch (error) {
      console.warn('Could not apply the date format:', error);
    }
  };

  /** Prefers a tab called Purchases, else the first tab; falls back to defaults wherever the sheet can't be read. */
  const findTarget = async (spreadsheetId: string): Promise<Target> => {
    const fallback: Target = { tab: { title: TAB_TITLE }, dateColumn: 0, dateFormat: DEFAULT_DATE_FORMAT };

    let locale: string;
    let tabs: SpreadsheetTab[];
    try {
      ({ locale, tabs } = await adapter.describe(spreadsheetId));
    } catch (error) {
      console.warn('Could not read the spreadsheet, using the default date format:', error);
      return fallback;
    }

    const tab = tabs.find((t) => t.title.toLowerCase() === TAB_TITLE.toLowerCase()) ?? tabs[0] ?? fallback.tab;
    const byLocale: Target = { tab, dateColumn: 0, dateFormat: formatForLocale(locale) };

    let rows: SheetCell[][];
    try {
      rows = await adapter.readTop(spreadsheetId, tab.title, ROWS_SAMPLED);
    } catch (error) {
      console.warn('Could not read the spreadsheet rows, using its locale:', error);
      return byLocale;
    }
    if (rows.length === 0) return byLocale;

    const headerIndex = (rows[0] ?? []).findIndex((cell) => isDateHeader(cell.value));
    const dateColumn = Math.max(headerIndex, 0);
    return { tab, dateColumn, dateFormat: dateFormatIn(rows, dateColumn, locale) ?? byLocale.dateFormat };
  };

  /** Finds the spreadsheet by name, or creates it with today's headers. */
  const connect = async (name: string): Promise<{ spreadsheetId: string; created: boolean }> => {
    const found = await adapter.findByName(name);
    if (found) return { spreadsheetId: found, created: false };

    const { spreadsheetId, sheetId } = await adapter.create(name, {
      title: TAB_TITLE,
      headers: COLUMNS.map((c) => c.header),
      locale: NEW_SHEET_LOCALE,
    });
    await formatDatesQuietly(spreadsheetId, { sheetId, column: 0 }, DEFAULT_DATE_FORMAT.sheetsPattern);
    return { spreadsheetId, created: true };
  };

  /** Appends one row per ReceiptItem, in the date format the sheet already uses. */
  const append = async (spreadsheetId: string, session: Session, links: ReceiptLinks = {}): Promise<Appended> => {
    const target = await findTarget(spreadsheetId);
    const rows = session.items.map((item) => COLUMNS.map((c) => c.value({ session, item, target, links })));

    const span = await adapter.append(spreadsheetId, target.tab.title, rows);

    const { sheetId } = target.tab;
    if (span && sheetId !== undefined) {
      await formatDatesQuietly(spreadsheetId, { sheetId, column: target.dateColumn, rows: span }, target.dateFormat.sheetsPattern);
    }

    const spreadsheetLink = spreadsheetLinkOf(spreadsheetId);
    if (!span) return { spreadsheetLink };

    const itemLinks = Object.fromEntries(
      session.items.map((item, index) => [item.id, `${spreadsheetLink}#gid=${sheetId ?? 0}&range=A${span.firstRow + index}`]),
    );
    return { spreadsheetLink, itemLinks };
  };

  return { connect, append };
};

export type PurchasesSheet = ReturnType<typeof createPurchasesSheet>;

interface MemoryTab extends SpreadsheetTab {
  rows: SheetCell[][];
}

interface MemorySpreadsheet {
  name: string;
  locale: string;
  tabs: MemoryTab[];
}

const notFound = (what: string) => Object.assign(new Error(`${what} not found`), { status: 404 });

/** A spreadsheet adapter in memory; `seed` adds an existing spreadsheet and `tab` reads one back. */
export const createInMemorySpreadsheetAdapter = () => {
  const spreadsheets = new Map<string, MemorySpreadsheet>();
  const dateFormats: { spreadsheetId: string; sheetId: number; column: number; rows?: RowSpan; sheetsPattern: string }[] = [];
  let nextId = 1;

  const spreadsheet = (id: string) => {
    const found = spreadsheets.get(id);
    if (!found) throw notFound(`Spreadsheet ${id}`);
    return found;
  };

  const tabOf = (id: string, title: string) => {
    const found = spreadsheet(id).tabs.find((t) => t.title === title);
    if (!found) throw Object.assign(new Error(`Unable to parse range: ${title}!A1`), { status: 400 });
    return found;
  };

  const cell = (value: unknown): SheetCell => ({ value: String(value ?? '') });

  const adapter: SpreadsheetAdapter = {
    findByName: async (name) => [...spreadsheets].find(([, s]) => s.name === name)?.[0] ?? null,

    create: async (name, { title, headers, locale }) => {
      const spreadsheetId = `memory-sheet-${nextId++}`;
      spreadsheets.set(spreadsheetId, { name, locale, tabs: [{ sheetId: 0, title, rows: [headers.map(cell)] }] });
      return { spreadsheetId, sheetId: 0 };
    },

    describe: async (id) => {
      const { locale, tabs } = spreadsheet(id);
      return { locale, tabs: tabs.map(({ sheetId, title }) => ({ sheetId, title })) };
    },

    readTop: async (id, title, rowCount) => tabOf(id, title).rows.slice(0, rowCount),

    append: async (id, title, rows) => {
      const tab = tabOf(id, title);
      const firstRow = tab.rows.length + 1;
      tab.rows.push(...rows.map((row) => row.map(cell)));
      return { firstRow, lastRow: tab.rows.length };
    },

    formatDates: async (spreadsheetId, { sheetId, column, rows }, sheetsPattern) => {
      dateFormats.push({ spreadsheetId, sheetId, column, rows, sheetsPattern });
    },
  };

  return {
    ...adapter,
    seed: (id: string, existing: { name: string; locale?: string; tabs: MemoryTab[] }) => {
      spreadsheets.set(id, { locale: 'iw_IL', ...existing });
    },
    /** A tab's rows as plain text, header included. */
    tab: (id: string, title: string) => tabOf(id, title).rows.map((row) => row.map((c) => c.value)),
    dateFormats,
  };
};
