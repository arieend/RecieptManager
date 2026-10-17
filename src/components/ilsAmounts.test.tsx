import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MainView } from './MainView';
import { HistoryView } from './HistoryView';
import { SummaryCard } from './SummaryCard';
import { ItemCard } from './ItemCard';
import { translations } from '../translations';
import { calculateTotals } from '../utils/calculations';
import { Session } from '../types';

// A stored rate of exactly 1 on a USD Session counts as no rate: Money converts at the fixed 3.7.
const usdSessionWithRateOne: Session = {
  id: 's1', userId: 'user-1', storeName: 'Store 1', createdAt: new Date().toISOString(),
  items: [{ id: 'i1', name: 'Item', price: 100, quantity: 1, assignedTo: [] }],
  people: [], tax: 0, tip: 0, total: 100, currency: 'USD', exchangeRate: 1,
};

const settings = {
  storagePath: 'Receipts',
  directories: { year: true, month: true, day: false },
  autoSave: true,
  syncToSheets: true,
  spreadsheetId: '',
  spreadsheetName: 'Receipts Database',
  currency: 'ILS' as const,
  theme: 'light' as const,
};

describe('ILS amount of a USD Session with a stored rate of 1', () => {
  it('is ₪370.00 on MainView', () => {
    render(
      <MainView
        user={{ displayName: 'Test User' }} history={[usdSessionWithRateOne]}
        onScan={vi.fn()} onUpload={vi.fn()} onUploadFolder={vi.fn()} onHistoryClick={vi.fn()}
        onSessionClick={vi.fn()} onSettingsClick={vi.fn()} onMonthlySummaryClick={vi.fn()}
        translations={translations} language="en" currencySymbol="₪"
        driveToken="token" onReconnectDrive={vi.fn()} settings={settings}
      />
    );
    expect(screen.getByText(/₪370\.00 total spending/i)).toBeInTheDocument();
  });

  it('is ₪370.00 in HistoryView', () => {
    render(
      <HistoryView
        history={[usdSessionWithRateOne]} onBack={vi.fn()} onSessionClick={vi.fn()}
        onDeleteSession={vi.fn()} onClearAll={vi.fn()}
        translations={translations} language="en" currencySymbol="₪" settings={settings}
      />
    );
    expect(screen.getByText('≈ ₪370.00')).toBeInTheDocument();
  });

  it('is ₪370.00 in SummaryCard', () => {
    render(
      <SummaryCard
        totals={calculateTotals(usdSessionWithRateOne)} session={usdSessionWithRateOne}
        language="en" translations={translations} currencySymbol="$"
      />
    );
    const total = screen.getByText(translations.en.totalAmount).parentElement!;
    expect(within(total).getByText('≈ ₪370.00')).toBeInTheDocument();
  });

  it('prices its item at ₪370.00 in ItemCard', () => {
    render(
      <ItemCard
        item={usdSessionWithRateOne.items[0]} people={[]} session={usdSessionWithRateOne}
        currencySymbol="$" onToggleAssignment={vi.fn()} onUpdateQuantity={vi.fn()}
        translations={translations.en}
      />
    );
    expect(screen.getByText('≈ ₪370.00')).toBeInTheDocument();
  });
});
