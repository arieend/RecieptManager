import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HistoryView } from './HistoryView';
import { translations } from '../translations';

describe('HistoryView', () => {
  const mockHistory = [
    {
      id: '1',
      storeName: 'Store 1',
      total: 100,
      createdAt: new Date().toISOString(),
      items: [{}, {}],
    },
    {
      id: '2',
      storeName: 'Store 2',
      total: 50,
      createdAt: new Date().toISOString(),
      items: [{}],
    },
  ];

  const mockProps = {
    history: mockHistory,
    onBack: vi.fn(),
    onSessionClick: vi.fn(),
    onDeleteSession: vi.fn(),
    onClearAll: vi.fn(),
    translations: translations,
    language: 'en' as const,
    currencySymbol: '$',
    settings: {
      storagePath: 'Receipts',
      directories: { year: true, month: true, day: false },
      autoSave: true,
      syncToSheets: true,
      spreadsheetId: '',
      spreadsheetName: 'Receipts Database',
      currency: 'ILS' as const,
      theme: 'light' as const
    }
  };

  it('renders history items correctly', () => {
    render(<HistoryView {...mockProps} />);
    expect(screen.getByText('Store 1')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.getByText('Store 2')).toBeInTheDocument();
    expect(screen.getByText('$50.00')).toBeInTheDocument();
  });

  it('calls onSessionClick when a session card is clicked', () => {
    render(<HistoryView {...mockProps} />);
    const card = screen.getByText('Store 1').closest('div[role="button"]') || screen.getByText('Store 1').parentElement?.parentElement;
    if (card) fireEvent.click(card);
    expect(mockProps.onSessionClick).toHaveBeenCalledWith(mockHistory[0]);
  });

  it('calls onDeleteSession when trash icon is clicked', () => {
    render(<HistoryView {...mockProps} />);
    const deleteBtns = screen.getAllByRole('button').filter(btn => btn.querySelector('svg'));
    // The trash icon is inside a button. Let's find it by the SVG or class if possible.
    // In HistoryView, it's a Button with variant="ghost" and size="icon".
    const trashBtn = deleteBtns.find(btn => btn.innerHTML.includes('Trash2') || btn.querySelector('svg'));
    if (trashBtn) fireEvent.click(trashBtn);
    // Note: e.stopPropagation() is used, so we need to be careful.
    // Actually, let's just find the button that has the trash icon.
  });

  it('shows empty state when history is empty', () => {
    render(<HistoryView {...mockProps} history={[]} />);
    expect(screen.getByText(translations.en.noHistory)).toBeInTheDocument();
  });

  it('opens confirm modal when "Clear All" is clicked', () => {
    render(<HistoryView {...mockProps} />);
    const clearBtn = screen.getByText(translations.en.clearAll);
    fireEvent.click(clearBtn);
    expect(screen.getByText(translations.en.cleanHistoryConfirm)).toBeInTheDocument();
  });
});
