import { Session, ReceiptItem } from '../types';
import { itemAmount, sessionTotal, toDisplay } from './money';

export interface CategorySummaryItem {
  name: string;
  amount: number;
  percentage: number;
  color: string;
  itemCount: number;
  receiptCount: number;
  items: {
    sessionId: string;
    storeName: string;
    englishStoreName?: string;
    date: string;
    name: string;
    price: number;
    convertedPrice: number;
    quantity: number;
    currency: string;
  }[];
}

export interface MonthlyTrendPoint {
  monthKey: string; // 'YYYY-MM'
  monthLabel: string; // e.g. 'Jan 2026'
  total: number;
  receiptCount: number;
  Other?: number; // spend outside the top categories
  [categoryName: string]: string | number;
}

export interface DailySpendingPoint {
  day: number;
  dayLabel: string;
  dateStr: string;
  total: number;
  receiptCount: number;
}

export const CATEGORY_PALETTE = [
  '#10b981', // emerald-500
  '#3b82f6', // blue-500
  '#f59e0b', // amber-500
  '#ec4899', // pink-500
  '#8b5cf6', // purple-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#14b8a6', // teal-500
  '#6366f1', // indigo-500
  '#84cc16', // lime-500
  '#e11d48', // rose-600
  '#64748b', // slate-500
];

const PREDEFINED_COLORS: Record<string, string> = {
  food: '#10b981',
  groceries: '#059669',
  supermarket: '#047857',
  dining: '#f59e0b',
  restaurant: '#d97706',
  shopping: '#ec4899',
  clothing: '#db2777',
  transport: '#3b82f6',
  transportation: '#2563eb',
  travel: '#0284c7',
  entertainment: '#8b5cf6',
  utilities: '#06b6d4',
  bills: '#0891b2',
  health: '#e11d48',
  healthcare: '#be123c',
  pharmacy: '#9f1239',
  tech: '#6366f1',
  electronics: '#4f46e5',
  services: '#84cc16',
  other: '#64748b',
  uncategorized: '#94a3b8',
};

export function getCategoryColor(categoryName: string, index = 0): string {
  const normalized = categoryName.trim().toLowerCase();
  if (PREDEFINED_COLORS[normalized]) {
    return PREDEFINED_COLORS[normalized];
  }
  // Generate consistent hash color if not predefined
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % CATEGORY_PALETTE.length;
  return CATEGORY_PALETTE[(colorIndex + index) % CATEGORY_PALETTE.length];
}

/** Accepts a Date, a Firestore Timestamp (or its `{ seconds }` shape), epoch millis, or a date string. */
export function parseSessionDate(dateVal: unknown): Date | null {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal;
  const fields = typeof dateVal === 'object' ? (dateVal as { toDate?: unknown; seconds?: unknown }) : {};
  if (typeof fields.toDate === 'function') {
    const d: Date = fields.toDate.call(dateVal);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof fields.seconds === 'number') {
    const d = new Date(fields.seconds * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof dateVal === 'number') {
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (!trimmed) return null;
    const direct = new Date(trimmed);
    if (!isNaN(direct.getTime())) return direct;

    // Try slash or dot separated formats: DD/MM/YYYY or YYYY/MM/DD
    const parts = trimmed.split(/[\/\.\- ]/);
    if (parts.length >= 3) {
      if (parts[2].length === 4) {
        // DD/MM/YYYY
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d;
      } else if (parts[0].length === 4) {
        // YYYY/MM/DD
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d;
      }
    }
  }
  return null;
}

export function getAvailableYears(sessions: Session[]): number[] {
  const yearsSet = new Set<number>();
  const currentYear = new Date().getFullYear();
  yearsSet.add(currentYear);

  sessions.forEach(session => {
    const d = parseSessionDate(session.createdAt);
    if (d) {
      yearsSet.add(d.getFullYear());
    }
  });

  return Array.from(yearsSet).sort((a, b) => b - a);
}

export function getAvailableMonthsForYear(
  sessions: Session[],
  year: number,
  targetCurrency: 'ILS' | 'USD' | 'EUR' = 'ILS'
): { month: number; monthKey: string; monthName: string; receiptCount: number; totalAmount: number }[] {
  const monthData = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const monthKey = `${year}-${String(m).padStart(2, '0')}`;
    const d = new Date(year, i, 1);
    const monthName = d.toLocaleDateString('en-US', { month: 'long' });
    return {
      month: m,
      monthKey,
      monthName,
      receiptCount: 0,
      totalAmount: 0,
    };
  });

  sessions.forEach(session => {
    const d = parseSessionDate(session.createdAt);
    if (!d || d.getFullYear() !== year) return;
    const mIndex = d.getMonth();
    if (mIndex >= 0 && mIndex < 12) {
      monthData[mIndex].receiptCount += 1;
      monthData[mIndex].totalAmount += toDisplay(sessionTotal(session).ils, targetCurrency);
    }
  });

  return monthData;
}

export function getAvailableMonthKeys(sessions: Session[]): { key: string; label: string; year: number; month: number; count: number }[] {
  const monthMap = new Map<string, { key: string; label: string; year: number; month: number; count: number }>();

  sessions.forEach(session => {
    const date = parseSessionDate(session.createdAt);
    if (!date) return;

    const year = date.getFullYear();
    const month = date.getMonth(); // 0-11
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    if (!monthMap.has(key)) {
      const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthMap.set(key, { key, label, year, month, count: 1 });
    } else {
      monthMap.get(key)!.count += 1;
    }
  });

  // Also include current month if missing
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (!monthMap.has(currentKey)) {
    const label = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    monthMap.set(currentKey, { key: currentKey, label, year: now.getFullYear(), month: now.getMonth(), count: 0 });
  }

  return Array.from(monthMap.values()).sort((a, b) => b.key.localeCompare(a.key));
}

export function filterSessionsByTimeframe(
  sessions: Session[],
  selectedTimeframe: string // 'all', 'last6', 'last12', 'year:YYYY', or 'YYYY-MM'
): Session[] {
  if (selectedTimeframe === 'all') {
    return sessions;
  }

  const now = new Date();

  if (selectedTimeframe === 'last6') {
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0, 0);
    return sessions.filter(s => {
      const d = parseSessionDate(s.createdAt);
      return d !== null && d >= sixMonthsAgo;
    });
  }

  if (selectedTimeframe === 'last12') {
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0, 0);
    return sessions.filter(s => {
      const d = parseSessionDate(s.createdAt);
      return d !== null && d >= twelveMonthsAgo;
    });
  }

  if (selectedTimeframe.startsWith('year:')) {
    const targetYear = parseInt(selectedTimeframe.replace('year:', ''), 10);
    return sessions.filter(s => {
      const d = parseSessionDate(s.createdAt);
      return d !== null && d.getFullYear() === targetYear;
    });
  }

  // Exact YYYY-MM
  return sessions.filter(s => {
    const d = parseSessionDate(s.createdAt);
    if (!d) return false;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return key === selectedTimeframe;
  });
}

export function aggregateCategoryBreakdown(
  sessions: Session[],
  targetCurrency: 'ILS' | 'USD' | 'EUR'
): { categories: CategorySummaryItem[]; totalSpent: number; totalItems: number } {
  const catMap = new Map<string, {
    amount: number;
    itemCount: number;
    receiptIds: Set<string>;
    items: CategorySummaryItem['items'];
  }>();

  let totalSpent = 0;
  let totalItems = 0;

  sessions.forEach(session => {
    const sessionCurrency = session.currency || 'ILS';

    if (session.items && session.items.length > 0) {
      session.items.forEach(item => {
        const rawCategory = item.category?.trim() || 'Other';
        // Normalize common category names capitalization
        const categoryName = rawCategory.charAt(0).toUpperCase() + rawCategory.slice(1);
        const qty = Number(item.quantity) || 1;
        const amount = itemAmount(session, item);
        const converted = toDisplay(amount.ils, targetCurrency);

        totalSpent += converted;
        totalItems += qty;

        if (!catMap.has(categoryName)) {
          catMap.set(categoryName, {
            amount: 0,
            itemCount: 0,
            receiptIds: new Set(),
            items: []
          });
        }

        const entry = catMap.get(categoryName)!;
        entry.amount += converted;
        entry.itemCount += qty;
        entry.receiptIds.add(session.id);
        entry.items.push({
          sessionId: session.id,
          storeName: session.storeName || 'Unknown Store',
          englishStoreName: session.englishStoreName,
          date: session.createdAt,
          name: item.name || 'Unnamed item',
          price: amount.original,
          convertedPrice: converted,
          quantity: qty,
          currency: sessionCurrency,
        });
      });
    } else {
      // If session has no individual items, categorize the session as a whole under 'General'
      const total = sessionTotal(session);
      const converted = toDisplay(total.ils, targetCurrency);
      totalSpent += converted;
      totalItems += 1;

      const categoryName = 'General';
      if (!catMap.has(categoryName)) {
        catMap.set(categoryName, {
          amount: 0,
          itemCount: 0,
          receiptIds: new Set(),
          items: []
        });
      }

      const entry = catMap.get(categoryName)!;
      entry.amount += converted;
      entry.itemCount += 1;
      entry.receiptIds.add(session.id);
      entry.items.push({
        sessionId: session.id,
        storeName: session.storeName || 'Unknown Store',
        englishStoreName: session.englishStoreName,
        date: session.createdAt,
        name: session.storeName || 'Receipt Total',
        price: total.original,
        convertedPrice: converted,
        quantity: 1,
        currency: sessionCurrency,
      });
    }
  });

  const categories: CategorySummaryItem[] = Array.from(catMap.entries()).map(([name, data], idx) => {
    const percentage = totalSpent > 0 ? (data.amount / totalSpent) * 100 : 0;
    return {
      name,
      amount: data.amount,
      percentage,
      color: getCategoryColor(name, idx),
      itemCount: data.itemCount,
      receiptCount: data.receiptIds.size,
      items: data.items.sort((a, b) => b.convertedPrice - a.convertedPrice),
    };
  }).sort((a, b) => b.amount - a.amount);

  return { categories, totalSpent, totalItems };
}

export function generateMonthlyTrendSeries(
  sessions: Session[],
  timeframeOrCount: string | number = 6,
  targetCurrency: 'ILS' | 'USD' | 'EUR' = 'ILS'
): { series: MonthlyTrendPoint[]; topCategories: string[] } {
  const now = new Date();
  const monthKeys: { key: string; label: string; year: number; month: number }[] = [];

  if (typeof timeframeOrCount === 'number') {
    for (let i = timeframeOrCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      monthKeys.push({ key, label, year: d.getFullYear(), month: d.getMonth() });
    }
  } else if (timeframeOrCount === 'all') {
    // Find earliest and latest session date in history
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    sessions.forEach(s => {
      const d = parseSessionDate(s.createdAt);
      if (!d) return;
      if (!minDate || d < minDate) minDate = d;
      if (!maxDate || d > maxDate) maxDate = d;
    });

    if (!minDate) {
      minDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    }
    if (!maxDate) {
      maxDate = now;
    }

    let cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

    // If less than 6 months, expand to 6 months
    const monthDiff = (end.getFullYear() - cur.getFullYear()) * 12 + (end.getMonth() - cur.getMonth()) + 1;
    if (monthDiff < 6) {
      cur = new Date(end.getFullYear(), end.getMonth() - 5, 1);
    }

    while (cur <= end) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
      const label = cur.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      monthKeys.push({ key, label, year: cur.getFullYear(), month: cur.getMonth() });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
  } else if (timeframeOrCount.startsWith('year:')) {
    const yr = parseInt(timeframeOrCount.replace('year:', ''), 10);
    for (let m = 0; m < 12; m++) {
      const d = new Date(yr, m, 1);
      const key = `${yr}-${String(m + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      monthKeys.push({ key, label, year: yr, month: m });
    }
  } else if (timeframeOrCount === 'last12') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      monthKeys.push({ key, label, year: d.getFullYear(), month: d.getMonth() });
    }
  } else if (timeframeOrCount === 'last6') {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      monthKeys.push({ key, label, year: d.getFullYear(), month: d.getMonth() });
    }
  } else {
    // Specific month YYYY-MM: show 6-month progression ending on that month
    const parts = timeframeOrCount.split('-');
    const selYear = parseInt(parts[0], 10);
    const selMonth = parseInt(parts[1], 10) - 1;
    for (let i = 5; i >= 0; i--) {
      const d = new Date(selYear, selMonth - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      monthKeys.push({ key, label, year: d.getFullYear(), month: d.getMonth() });
    }
  }

  // Find all categories across all sessions to stack
  const categorySpendTotals = new Map<string, number>();

  const dataByMonth = new Map<string, {
    total: number;
    receiptCount: number;
    catTotals: Record<string, number>;
  }>();

  monthKeys.forEach(m => {
    dataByMonth.set(m.key, { total: 0, receiptCount: 0, catTotals: {} });
  });

  sessions.forEach(session => {
    const d = parseSessionDate(session.createdAt);
    if (!d) return;

    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!dataByMonth.has(monthKey)) return;

    const entry = dataByMonth.get(monthKey)!;
    entry.receiptCount += 1;

    if (session.items && session.items.length > 0) {
      session.items.forEach(item => {
        const rawCategory = item.category?.trim() || 'Other';
        const catName = rawCategory.charAt(0).toUpperCase() + rawCategory.slice(1);
        const converted = toDisplay(itemAmount(session, item).ils, targetCurrency);

        entry.total += converted;
        entry.catTotals[catName] = (entry.catTotals[catName] || 0) + converted;
        categorySpendTotals.set(catName, (categorySpendTotals.get(catName) || 0) + converted);
      });
    } else {
      const converted = toDisplay(sessionTotal(session).ils, targetCurrency);
      entry.total += converted;
      entry.catTotals['General'] = (entry.catTotals['General'] || 0) + converted;
      categorySpendTotals.set('General', (categorySpendTotals.get('General') || 0) + converted);
    }
  });

  // Top 5 categories + 'Other'
  const sortedCats = Array.from(categorySpendTotals.entries()).sort((a, b) => b[1] - a[1]);
  const topCategories = sortedCats.slice(0, 5).map(c => c[0]);

  const series: MonthlyTrendPoint[] = monthKeys.map(m => {
    const data = dataByMonth.get(m.key)!;
    const point: MonthlyTrendPoint = {
      monthKey: m.key,
      monthLabel: m.label,
      total: Math.round(data.total * 100) / 100,
      receiptCount: data.receiptCount,
    };

    let otherAmount = 0;
    Object.entries(data.catTotals).forEach(([cat, amount]) => {
      if (topCategories.includes(cat)) {
        point[cat] = Math.round(amount * 100) / 100;
      } else {
        otherAmount += amount;
      }
    });

    if (otherAmount > 0) {
      point['Other'] = Math.round(((point['Other'] || 0) + otherAmount) * 100) / 100;
    }

    // Ensure all top categories exist as keys (0 if no spend)
    topCategories.forEach(cat => {
      if (point[cat] === undefined) {
        point[cat] = 0;
      }
    });

    return point;
  });

  return { series, topCategories };
}

export function generateDailySpendingSeries(
  sessions: Session[],
  monthKeyOrTimeframe: string, // 'YYYY-MM' or other timeframe
  targetCurrency: 'ILS' | 'USD' | 'EUR',
  overrideMonthKey?: string
): DailySpendingPoint[] {
  let targetKey = overrideMonthKey || monthKeyOrTimeframe;
  let year: number;
  let monthIndex: number;

  if (targetKey && targetKey.includes('-') && !targetKey.startsWith('year:')) {
    const parts = targetKey.split('-');
    year = parseInt(parts[0], 10);
    monthIndex = parseInt(parts[1], 10) - 1;
  } else {
    // Find latest session month for this timeframe or default to current month
    let latestDate: Date | null = null;
    const targetYear = targetKey?.startsWith('year:') ? parseInt(targetKey.replace('year:', ''), 10) : null;

    sessions.forEach(s => {
      const d = parseSessionDate(s.createdAt);
      if (!d) return;
      if (targetYear !== null && d.getFullYear() !== targetYear) return;
      if (!latestDate || d > latestDate) latestDate = d;
    });

    if (latestDate) {
      year = (latestDate as Date).getFullYear();
      monthIndex = (latestDate as Date).getMonth();
    } else {
      const now = new Date();
      year = targetYear !== null ? targetYear : now.getFullYear();
      monthIndex = now.getMonth();
    }
  }

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const dailyMap = new Map<number, { total: number; receiptCount: number }>();

  for (let d = 1; d <= daysInMonth; d++) {
    dailyMap.set(d, { total: 0, receiptCount: 0 });
  }

  sessions.forEach(session => {
    const d = parseSessionDate(session.createdAt);
    if (!d) return;

    if (d.getFullYear() === year && d.getMonth() === monthIndex) {
      const day = d.getDate();
      const entry = dailyMap.get(day);
      if (entry) {
        entry.receiptCount += 1;
        entry.total += toDisplay(sessionTotal(session).ils, targetCurrency);
      }
    }
  });

  return Array.from(dailyMap.entries()).map(([day, data]) => ({
    day,
    dayLabel: `${day}`,
    dateStr: `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    total: Math.round(data.total * 100) / 100,
    receiptCount: data.receiptCount,
  }));
}
