import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  TrendingUp, 
  Calendar, 
  PieChart as PieChartIcon, 
  BarChart3, 
  DollarSign, 
  ChevronLeft, 
  ChevronRight, 
  Receipt, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink,
  ShoppingBag,
  Layers,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid 
} from 'recharts';
import { Session } from '../types';
import { Translations, Language } from '../translations';
import { StorageSettings, getCurrencySymbol } from '../services/configService';
import { Button, Card } from './ui/Base';
import { 
  getAvailableYears,
  getAvailableMonthsForYear,
  getAvailableMonthKeys, 
  filterSessionsByTimeframe, 
  aggregateCategoryBreakdown, 
  generateMonthlyTrendSeries, 
  generateDailySpendingSeries,
  getCategoryColor,
  convertAmount,
  parseSessionDate,
  CategorySummaryItem
} from '../utils/monthlySummary';

interface MonthlySummaryViewProps {
  history: Session[];
  onBack: () => void;
  onSessionClick: (session: Session) => void;
  onScanClick: () => void;
  translations: Record<Language, Translations>;
  language: Language;
  currencySymbol: string;
  settings: StorageSettings;
}

export const MonthlySummaryView: React.FC<MonthlySummaryViewProps> = ({
  history,
  onBack,
  onSessionClick,
  onScanClick,
  translations,
  language,
  currencySymbol,
  settings,
}) => {
  const t = translations[language];

  // Base Currency selector state (default to settings currency or ILS)
  const [selectedCurrency, setSelectedCurrency] = useState<'ILS' | 'USD' | 'EUR'>(settings.currency || 'ILS');

  // Month / Timeframe state
  const availableYears = useMemo(() => getAvailableYears(history), [history]);
  const availableMonthKeys = useMemo(() => getAvailableMonthKeys(history), [history]);

  // Find latest session date in history to set sensible defaults
  const latestSessionDate = useMemo(() => {
    let latest: Date | null = null;
    history.forEach(s => {
      const d = parseSessionDate(s.createdAt);
      if (d && (!latest || d > latest)) latest = d;
    });
    return latest;
  }, [history]);

  // View mode: 'month' | 'year' | 'last6' | 'last12' | 'all'
  const [viewMode, setViewMode] = useState<'month' | 'year' | 'last6' | 'last12' | 'all'>('month');

  // Selected year and month
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    return latestSessionDate ? latestSessionDate.getFullYear() : new Date().getFullYear();
  });

  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    return latestSessionDate ? latestSessionDate.getMonth() + 1 : new Date().getMonth() + 1;
  });

  // Daily chart specific month override (for when viewing multi-month timeframes)
  const [dailyOverrideMonth, setDailyOverrideMonth] = useState<string>('');

  const [trendChartMode, setTrendChartMode] = useState<'stacked' | 'total'>('stacked');
  const [activeChartTab, setActiveChartTab] = useState<'trends' | 'categories' | 'daily'>('trends');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [hoveredPieCategory, setHoveredPieCategory] = useState<string | null>(null);

  const curSymbol = getCurrencySymbol(selectedCurrency);

  // Derive current timeframe key for filtering
  const selectedTimeframe = useMemo(() => {
    if (viewMode === 'all') return 'all';
    if (viewMode === 'last6') return 'last6';
    if (viewMode === 'last12') return 'last12';
    if (viewMode === 'year') return `year:${selectedYear}`;
    return `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  }, [viewMode, selectedYear, selectedMonth]);

  // Available months breakdown for the selected year
  const availableMonthsForYear = useMemo(() => {
    return getAvailableMonthsForYear(history, selectedYear, selectedCurrency);
  }, [history, selectedYear, selectedCurrency]);

  // Filter sessions for selected period
  const filteredSessions = useMemo(() => {
    return filterSessionsByTimeframe(history, selectedTimeframe);
  }, [history, selectedTimeframe]);

  // Aggregate Category Breakdown
  const { categories, totalSpent, totalItems } = useMemo(() => {
    return aggregateCategoryBreakdown(filteredSessions, selectedCurrency);
  }, [filteredSessions, selectedCurrency]);

  // Comparison metric (vs previous month or vs previous year)
  const priorPeriodComparison = useMemo(() => {
    if (viewMode === 'all' || viewMode === 'last6' || viewMode === 'last12') {
      return null;
    }

    if (viewMode === 'year') {
      const prevYearKey = `year:${selectedYear - 1}`;
      const prevSessions = filterSessionsByTimeframe(history, prevYearKey);
      const prevData = aggregateCategoryBreakdown(prevSessions, selectedCurrency);
      if (prevData.totalSpent === 0) {
        return totalSpent > 0 ? { diffPercent: 100, isUp: true, label: t.vsPreviousYear } : null;
      }
      const diff = totalSpent - prevData.totalSpent;
      const diffPercent = Math.round((diff / prevData.totalSpent) * 100);
      return {
        diffPercent: Math.abs(diffPercent),
        isUp: diff >= 0,
        label: t.vsPreviousYear,
      };
    }

    // Month mode:
    const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
    const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
    const prevKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    const prevSessions = filterSessionsByTimeframe(history, prevKey);
    const prevData = aggregateCategoryBreakdown(prevSessions, selectedCurrency);

    if (prevData.totalSpent === 0) {
      return totalSpent > 0 ? { diffPercent: 100, isUp: true, label: t.vsPreviousMonth } : null;
    }

    const diff = totalSpent - prevData.totalSpent;
    const diffPercent = Math.round((diff / prevData.totalSpent) * 100);
    return {
      diffPercent: Math.abs(diffPercent),
      isUp: diff >= 0,
      label: t.vsPreviousMonth,
    };
  }, [viewMode, selectedYear, selectedMonth, history, totalSpent, selectedCurrency, t]);

  // Monthly Trends Series - immediately reactive to selectedTimeframe
  const { series: trendSeries, topCategories } = useMemo(() => {
    return generateMonthlyTrendSeries(history, selectedTimeframe, selectedCurrency);
  }, [history, selectedTimeframe, selectedCurrency]);

  // Daily velocity series
  const dailySeries = useMemo(() => {
    return generateDailySpendingSeries(history, selectedTimeframe, selectedCurrency, dailyOverrideMonth || undefined);
  }, [history, selectedTimeframe, selectedCurrency, dailyOverrideMonth]);

  // Top category & average receipt
  const topCategory = categories.length > 0 ? categories[0] : null;
  const averageReceipt = filteredSessions.length > 0 ? totalSpent / filteredSessions.length : 0;

  // Month navigation helpers
  const handlePrev = () => {
    if (viewMode === 'year') {
      setSelectedYear(prev => prev - 1);
    } else if (viewMode === 'month') {
      if (selectedMonth === 1) {
        setSelectedYear(prev => prev - 1);
        setSelectedMonth(12);
      } else {
        setSelectedMonth(prev => prev - 1);
      }
    } else {
      // In all, last6, last12 mode: switch to month mode and step back from current selected
      setViewMode('month');
      if (selectedMonth === 1) {
        setSelectedYear(prev => prev - 1);
        setSelectedMonth(12);
      } else {
        setSelectedMonth(prev => prev - 1);
      }
    }
  };

  const handleNext = () => {
    if (viewMode === 'year') {
      setSelectedYear(prev => prev + 1);
    } else if (viewMode === 'month') {
      if (selectedMonth === 12) {
        setSelectedYear(prev => prev + 1);
        setSelectedMonth(1);
      } else {
        setSelectedMonth(prev => prev + 1);
      }
    } else {
      setViewMode('month');
    }
  };

  const toggleCategoryExpand = (catName: string) => {
    setExpandedCategories(prev => ({ ...prev, [catName]: !prev[catName] }));
  };

  // Filtered categories for search
  const displayedCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.items.some(i => i.name.toLowerCase().includes(q) || i.storeName.toLowerCase().includes(q))
    );
  }, [categories, searchQuery]);

  // Format month name for display
  const timeframeDisplayTitle = useMemo(() => {
    if (viewMode === 'all') {
      return `${t.allTime} (${filteredSessions.length} ${t.receiptsCount.toLowerCase()})`;
    }
    if (viewMode === 'last6') return t.last6Months;
    if (viewMode === 'last12') return t.last12Months;
    if (viewMode === 'year') return `${t.fullYear} ${selectedYear}`;

    const d = new Date(selectedYear, selectedMonth - 1, 1);
    return d.toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', { month: 'long', year: 'numeric' });
  }, [viewMode, selectedYear, selectedMonth, filteredSessions.length, language, t]);

  // Month name helper
  const getLocalizedMonthName = (monthNumber: number) => {
    const d = new Date(2026, monthNumber - 1, 1);
    return d.toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', { month: 'long' });
  };

  return (
    <main className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 pb-16 min-h-screen">
      {/* Top Sticky Header */}
      <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4 sticky top-0 z-30 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
            <ArrowLeft size={20} />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <TrendingUp size={18} strokeWidth={2.5} />
              </div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {t.monthlySummary}
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
              {t.monthlySummaryDesc}
            </p>
          </div>
        </div>

        {/* Currency Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl gap-1">
          {(['ILS', 'USD', 'EUR'] as const).map(curr => (
            <button
              key={curr}
              onClick={() => setSelectedCurrency(curr)}
              className={`px-3 py-1 text-xs font-black rounded-xl transition-all ${
                selectedCurrency === curr 
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {curr === 'ILS' ? '₪ NIS' : curr === 'USD' ? '$ USD' : '€ EUR'}
            </button>
          ))}
        </div>
      </header>

      <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto w-full">
        {/* Timeframe Selector & Navigation Card */}
        <section className="bg-white dark:bg-slate-900 rounded-[2rem] p-4 sm:p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
            {/* Step Navigator (Month or Year) */}
            <div className="flex items-center gap-2 justify-between sm:justify-start">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrev}
                className="w-10 h-10 rounded-2xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Previous"
              >
                <ChevronLeft size={18} />
              </Button>

              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl flex-1 sm:flex-initial sm:min-w-[200px] justify-center text-center">
                <Calendar size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-black text-slate-900 dark:text-white text-sm capitalize truncate">
                  {timeframeDisplayTitle}
                </span>
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={handleNext}
                className="w-10 h-10 rounded-2xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Next"
              >
                <ChevronRight size={18} />
              </Button>
            </div>

            {/* Quick Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
              <button
                onClick={() => {
                  const now = new Date();
                  setSelectedYear(now.getFullYear());
                  setSelectedMonth(now.getMonth() + 1);
                  setViewMode('month');
                }}
                className={`whitespace-nowrap px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  viewMode === 'month' && selectedYear === new Date().getFullYear() && selectedMonth === (new Date().getMonth() + 1)
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {t.thisMonth}
              </button>

              <button
                onClick={() => setViewMode('last6')}
                className={`whitespace-nowrap px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  viewMode === 'last6'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {t.last6Months}
              </button>

              <button
                onClick={() => setViewMode('last12')}
                className={`whitespace-nowrap px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  viewMode === 'last12'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {t.last12Months}
              </button>

              <button
                onClick={() => setViewMode('all')}
                className={`whitespace-nowrap px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  viewMode === 'all'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {t.allTime}
              </button>
            </div>
          </div>

          {/* Dedicated Specific Year & Month Picker Row */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Sparkles size={14} className="text-emerald-500" />
                {t.customPeriod}:
              </span>

              {/* Year Select */}
              <div className="relative">
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    const yr = parseInt(e.target.value, 10);
                    setSelectedYear(yr);
                    if (viewMode === 'last6' || viewMode === 'last12' || viewMode === 'all') {
                      setViewMode('month');
                    }
                  }}
                  className="appearance-none bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold pl-3 pr-7 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                >
                  {availableYears.map(yr => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {/* Month Select */}
              <div className="relative">
                <select
                  value={viewMode === 'year' ? 'year' : selectedMonth}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'year') {
                      setViewMode('year');
                    } else {
                      setSelectedMonth(parseInt(val, 10));
                      setViewMode('month');
                    }
                  }}
                  className="appearance-none bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold pl-3 pr-7 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                >
                  <option value="year">{t.allMonthsInYear} ({selectedYear})</option>
                  {availableMonthsForYear.map(m => (
                    <option key={m.month} value={m.month}>
                      {getLocalizedMonthName(m.month)} {m.receiptCount > 0 ? `(${m.receiptCount} ${t.receiptsCount.toLowerCase()})` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Total items & Receipts tag */}
            <div className="text-xs font-bold text-slate-400 flex items-center gap-2">
              <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300">
                {filteredSessions.length} {t.receiptsCount.toLowerCase()}
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-black">
                {curSymbol}{totalSpent.toFixed(2)}
              </span>
            </div>
          </div>
        </section>

        {/* 4 KPI Metrics Grid */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Total Spending */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.totalSpending}</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
                <DollarSign size={18} />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {curSymbol}{totalSpent.toFixed(2)}
              </p>
              {priorPeriodComparison && (
                <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold">
                  <span className={`px-1.5 py-0.5 rounded-md ${priorPeriodComparison.isUp ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'}`}>
                    {priorPeriodComparison.isUp ? '+' : '-'}{priorPeriodComparison.diffPercent}%
                  </span>
                  <span className="text-slate-400 font-medium truncate">{priorPeriodComparison.label}</span>
                </div>
              )}
            </div>
          </div>

          {/* Top Category */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.topCategory}</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center">
                <PieChartIcon size={18} />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white truncate">
                {topCategory ? topCategory.name : '—'}
              </p>
              <p className="text-xs font-bold text-slate-400 mt-1">
                {topCategory ? `${curSymbol}${topCategory.amount.toFixed(2)} (${Math.round(topCategory.percentage)}%)` : 'No expenses'}
              </p>
            </div>
          </div>

          {/* Receipts & Items */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.receiptsCount}</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center">
                <Receipt size={18} />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {filteredSessions.length}
              </p>
              <p className="text-xs font-bold text-slate-400 mt-1">
                {totalItems} {t.itemsPurchased.toLowerCase()}
              </p>
            </div>
          </div>

          {/* Average Receipt */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.avgReceipt}</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center">
                <BarChart3 size={18} />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {curSymbol}{averageReceipt.toFixed(2)}
              </p>
              <p className="text-xs font-bold text-slate-400 mt-1">
                {categories.length} {language === 'he' ? 'קטגוריות' : 'categories'}
              </p>
            </div>
          </div>
        </section>

        {/* Interactive Charts Section */}
        {filteredSessions.length > 0 || trendSeries.some(s => s.total > 0) ? (
          <section className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-5 sm:p-7 border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
            {/* Chart Sub-tabs Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                {[
                  { id: 'trends', label: t.monthlyTrends, icon: <TrendingUp size={16} /> },
                  { id: 'categories', label: t.categoryDistribution, icon: <PieChartIcon size={16} /> },
                  { id: 'daily', label: t.dailySpending, icon: <BarChart3 size={16} /> },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveChartTab(tab.id as any)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all ${
                      activeChartTab === tab.id
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Mode switch when on 'trends' tab */}
              {activeChartTab === 'trends' && (
                <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl gap-1 self-end sm:self-auto">
                  <button
                    onClick={() => setTrendChartMode('stacked')}
                    className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                      trendChartMode === 'stacked'
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Layers size={13} />
                    <span>{t.stackedView}</span>
                  </button>
                  <button
                    onClick={() => setTrendChartMode('total')}
                    className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                      trendChartMode === 'total'
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <TrendingUp size={13} />
                    <span>{t.totalTrend}</span>
                  </button>
                </div>
              )}
            </div>

            {/* TAB 1: Monthly Trends (AreaChart / BarChart) */}
            {activeChartTab === 'trends' && (
              <div className="space-y-4">
                <div className="h-72 sm:h-80 w-full min-h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {trendChartMode === 'stacked' ? (
                      <AreaChart 
                        key={`area-${selectedTimeframe}-${selectedCurrency}-${trendChartMode}`}
                        data={trendSeries} 
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          {topCategories.map((cat, idx) => (
                            <linearGradient key={cat} id={`grad-${cat}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={getCategoryColor(cat, idx)} stopOpacity={0.8} />
                              <stop offset="95%" stopColor={getCategoryColor(cat, idx)} stopOpacity={0.1} />
                            </linearGradient>
                          ))}
                          <linearGradient id="grad-Other" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.7} />
                            <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.1} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                        <XAxis 
                          dataKey="monthLabel" 
                          tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} 
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis 
                          tick={{ fill: '#94a3b8', fontSize: 12 }} 
                          axisLine={false} 
                          tickLine={false}
                          tickFormatter={(val) => `${curSymbol}${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`}
                        />
                        <Tooltip 
                          content={({ active, payload, label }) => {
                            if (!active || !payload || !payload.length) return null;
                            const totalVal = payload.reduce((sum, p) => sum + (Number(p.value) || 0), 0);
                            return (
                              <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-xl text-xs space-y-2 border border-slate-800 min-w-[160px]">
                                <div className="font-black text-sm border-b border-slate-800 pb-1 flex justify-between">
                                  <span>{label}</span>
                                  <span className="text-emerald-400">{curSymbol}{totalVal.toFixed(2)}</span>
                                </div>
                                <div className="space-y-1">
                                  {payload.map((entry: any) => (
                                    <div key={entry.name} className="flex justify-between items-center gap-3">
                                      <span className="flex items-center gap-1.5 text-slate-300">
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                        <span>{entry.name}</span>
                                      </span>
                                      <span className="font-bold">{curSymbol}{Number(entry.value).toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Legend 
                          wrapperStyle={{ paddingTop: 16 }}
                          formatter={(value) => <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{value}</span>}
                        />
                        {topCategories.map((cat, idx) => (
                          <Area
                            key={cat}
                            type="monotone"
                            dataKey={cat}
                            stackId="1"
                            stroke={getCategoryColor(cat, idx)}
                            strokeWidth={2}
                            fillOpacity={1}
                            fill={`url(#grad-${cat})`}
                          />
                        ))}
                        {trendSeries.some(s => s['Other'] > 0) && (
                          <Area
                            type="monotone"
                            dataKey="Other"
                            stackId="1"
                            stroke="#64748b"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#grad-Other)"
                          />
                        )}
                      </AreaChart>
                    ) : (
                      <BarChart 
                        key={`bar-${selectedTimeframe}-${selectedCurrency}-${trendChartMode}`}
                        data={trendSeries} 
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                        <XAxis 
                          dataKey="monthLabel" 
                          tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} 
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis 
                          tick={{ fill: '#94a3b8', fontSize: 12 }} 
                          axisLine={false} 
                          tickLine={false}
                          tickFormatter={(val) => `${curSymbol}${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`}
                        />
                        <Tooltip 
                          content={({ active, payload, label }) => {
                            if (!active || !payload || !payload.length) return null;
                            const point = payload[0]?.payload;
                            return (
                              <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-xl text-xs space-y-1.5 border border-slate-800 min-w-[150px]">
                                <p className="font-black text-sm text-slate-200">{label}</p>
                                <p className="text-emerald-400 text-base font-black">{curSymbol}{Number(point?.total || 0).toFixed(2)}</p>
                                <p className="text-slate-400">{point?.receiptCount || 0} {t.receiptsCount.toLowerCase()}</p>
                              </div>
                            );
                          }}
                        />
                        <Bar 
                          dataKey="total" 
                          fill="#10b981" 
                          radius={[12, 12, 0, 0]} 
                          maxBarSize={48}
                        />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* TAB 2: Category Distribution Donut Chart */}
            {activeChartTab === 'categories' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="h-72 w-full relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart key={`pie-${selectedTimeframe}-${selectedCurrency}-${categories.length}`}>
                      <Pie
                        data={categories}
                        dataKey="amount"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={3}
                        onMouseEnter={(_, index) => setHoveredPieCategory(categories[index]?.name || null)}
                        onMouseLeave={() => setHoveredPieCategory(null)}
                      >
                        {categories.map((entry, index) => (
                          <Cell 
                            key={`cell-${entry.name}`} 
                            fill={entry.color} 
                            stroke="none"
                            opacity={hoveredPieCategory && hoveredPieCategory !== entry.name ? 0.4 : 1}
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null;
                          const data = payload[0].payload as CategorySummaryItem;
                          return (
                            <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl text-xs space-y-1 border border-slate-800">
                              <p className="font-black text-sm flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                                {data.name}
                              </p>
                              <p className="text-emerald-400 font-bold text-base">{curSymbol}{data.amount.toFixed(2)}</p>
                              <p className="text-slate-400 font-medium">{Math.round(data.percentage)}% of total ({data.itemCount} items)</p>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Center Donut Label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      {hoveredPieCategory || t.totalSpending}
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                      {curSymbol}
                      {hoveredPieCategory 
                        ? (categories.find(c => c.name === hoveredPieCategory)?.amount || 0).toFixed(2)
                        : totalSpent.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Category Chips List */}
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1 no-scrollbar">
                  {categories.map(cat => (
                    <div 
                      key={cat.name}
                      onMouseEnter={() => setHoveredPieCategory(cat.name)}
                      onMouseLeave={() => setHoveredPieCategory(null)}
                      className={`flex justify-between items-center p-3 rounded-2xl transition-all cursor-pointer ${
                        hoveredPieCategory === cat.name 
                          ? 'bg-slate-100 dark:bg-slate-800 scale-[1.02]' 
                          : 'bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">{cat.name}</span>
                        <span className="text-xs text-slate-400 font-medium shrink-0">({cat.itemCount} {t.itemsPurchased.toLowerCase()})</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-black text-sm text-slate-900 dark:text-white">{curSymbol}{cat.amount.toFixed(2)}</span>
                        <span className="text-xs text-slate-400 font-bold ml-2">({Math.round(cat.percentage)}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: Daily Spending Velocity */}
            {activeChartTab === 'daily' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {timeframeDisplayTitle} — {t.spendingVelocity}
                  </p>
                  {/* If in multi-month timeframe, offer picking a specific month */}
                  {viewMode !== 'month' && availableMonthKeys.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-slate-400 font-medium">{t.selectMonth}:</span>
                      <select
                        value={dailyOverrideMonth}
                        onChange={(e) => setDailyOverrideMonth(e.target.value)}
                        className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500 cursor-pointer"
                      >
                        <option value="">{t.allTime} / {t.thisMonth}</option>
                        {availableMonthKeys.map(m => (
                          <option key={m.key} value={m.key}>{m.label} ({m.count})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="h-72 w-full min-h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      key={`daily-${selectedTimeframe}-${dailyOverrideMonth}-${selectedCurrency}`}
                      data={dailySeries} 
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                      <XAxis 
                        dataKey="dayLabel" 
                        tick={{ fill: '#94a3b8', fontSize: 11 }} 
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        tick={{ fill: '#94a3b8', fontSize: 11 }} 
                        axisLine={false} 
                        tickLine={false}
                        tickFormatter={(val) => `${curSymbol}${val}`}
                      />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null;
                          const point = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl text-xs space-y-1 border border-slate-800">
                              <p className="font-bold text-slate-300">{point.dateStr}</p>
                              <p className="text-emerald-400 font-black text-base">{curSymbol}{Number(point.total).toFixed(2)}</p>
                              <p className="text-slate-400">{point.receiptCount} {t.receiptsCount.toLowerCase()}</p>
                            </div>
                          );
                        }}
                      />
                      <Bar 
                        dataKey="total" 
                        fill="#3b82f6" 
                        radius={[8, 8, 0, 0]} 
                        maxBarSize={28}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </section>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 border border-slate-100 dark:border-slate-800 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto text-slate-300 dark:text-slate-700">
              <TrendingUp size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">{t.noExpensesForPeriod}</h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto font-medium">
              {language === 'he' ? 'נסה לבחור חודש אחר או סרוק קבלה חדשה כדי לראות תרשימים וסטטיסטיקות.' : 'Try selecting another month or scan a new receipt to view trends and charts.'}
            </p>
            <Button variant="primary" onClick={onScanClick} leftIcon={<Receipt size={18} />}>
              {t.scanReceipt}
            </Button>
          </div>
        )}

        {/* Category Breakdown Accordion & Drilldown List */}
        <section className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-5 sm:p-7 border border-slate-100 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <ShoppingBag size={20} className="text-emerald-600" />
                {t.categoryBreakdown}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {displayedCategories.length} {t.allCategories.toLowerCase()} ({totalItems} {t.itemsPurchased.toLowerCase()})
              </p>
            </div>

            {/* Instant Search Bar */}
            <div className="relative w-full sm:w-64">
              <Search size={16} className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={t.searchExpenses}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-2xl pl-9 rtl:pr-9 rtl:pl-3 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
              />
            </div>
          </div>

          {/* Categories List */}
          <div className="space-y-3">
            {displayedCategories.length > 0 ? (
              displayedCategories.map(cat => {
                const isExpanded = !!expandedCategories[cat.name];

                return (
                  <div
                    key={cat.name}
                    className="border border-slate-100 dark:border-slate-800/80 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/20 transition-all"
                  >
                    {/* Header Row */}
                    <button
                      onClick={() => toggleCategoryExpand(cat.name)}
                      className="w-full p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className="w-4 h-4 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: cat.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-black text-sm text-slate-900 dark:text-white truncate">
                              {cat.name}
                            </h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                              {cat.receiptCount} {t.receiptsCount.toLowerCase()}
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(cat.percentage, 100)}%`, backgroundColor: cat.color }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 pl-7 sm:pl-0">
                        <div className="text-right">
                          <p className="font-black text-sm text-slate-900 dark:text-white">
                            {curSymbol}{cat.amount.toFixed(2)}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400">
                            {Math.round(cat.percentage)}% of total
                          </p>
                        </div>

                        <div className="p-1 text-slate-400">
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </div>
                    </button>

                    {/* Drilldown items table */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 space-y-2"
                        >
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                            {t.allItemsInCat} ({cat.items.length})
                          </p>
                          <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {cat.items.map((item, idx) => {
                              const session = history.find(s => s.id === item.sessionId);
                              return (
                                <div
                                  key={`${item.sessionId}-${idx}`}
                                  className="py-2.5 flex justify-between items-center gap-3 text-xs"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="font-bold text-slate-900 dark:text-white truncate">
                                      {item.quantity > 1 ? `${item.quantity}x ` : ''}{item.name}
                                    </p>
                                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                                      <span>{language === 'he' ? item.storeName : (item.englishStoreName || item.storeName)}</span>
                                      <span>•</span>
                                      {(() => {
                                        const d = parseSessionDate(item.date);
                                        return <span>{d ? d.toLocaleDateString(language === 'he' ? 'he-IL' : 'en-GB') : item.date}</span>;
                                      })()}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className="font-black text-slate-900 dark:text-white">
                                      {curSymbol}{item.convertedPrice.toFixed(2)}
                                    </span>
                                    {session && (
                                      <button
                                        onClick={() => onSessionClick(session)}
                                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors"
                                        title={t.viewReceipt}
                                      >
                                        <ExternalLink size={14} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-400 font-medium">
                {t.noExpensesForPeriod}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
};
