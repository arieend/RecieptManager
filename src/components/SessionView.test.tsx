import type { ReactNode, Ref } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionView } from './SessionView';
import { translations } from '../translations';
import * as geminiService from '../services/geminiService';
import type { RateLookup } from '../services/rateLookup';

const fakeRateLookup = (rates: Record<string, number | null> = { USD: 3.1268, EUR: 3.62 }) => {
  const calls: [string, string][] = [];
  const lookup: RateLookup = async (currency, date) => {
    calls.push([currency, date]);
    return rates[currency] ?? null;
  };
  return { lookup, calls };
};

// Mock motion to avoid animation issues
vi.mock('motion/react', () => {
  const React = require('react');
  const motion = Object.assign(<T,>(Component: T) => Component, {} as Record<string, unknown>);
  const tags = ['div', 'span', 'button', 'section', 'h1', 'h2', 'h3', 'p', 'img', 'video', 'canvas', 'svg', 'path', 'line'];
  tags.forEach(tag => {
    motion[tag] = React.forwardRef(({ children, ...props }: { children?: ReactNode; [prop: string]: unknown }, ref: Ref<unknown>) => {
      const { initial, animate, exit, transition, ...rest } = props;
      return React.createElement(tag, { ...rest, ref }, children);
    });
  });
  return {
    motion,
    AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  };
});

vi.mock('../services/geminiService');

describe('SessionView', () => {
  const mockSession = {
    id: '1',
    userId: 'user1',
    storeName: 'Test Store',
    items: [
      { id: 'i1', name: 'Item 1', price: 10, quantity: 1, assignedTo: ['person-family'], category: 'Food', labels: ['Tag1'] },
    ],
    people: [
      { id: 'person-family', name: 'Family', color: '#ff0000' },
    ],
    tax: 0,
    tip: 0,
    total: 10,
    currency: 'USD' as const,
    exchangeRate: 3.5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    imageUrl: 'data:image/jpeg;base64,mock',
    driveFileId: '',
    driveLink: '',
    driveFileName: '',
  };

  const mockProps = {
    session: mockSession,
    setSession: vi.fn(),
    onBack: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onChat: vi.fn(),
    translations: translations,
    language: 'en' as const,
    currencySymbol: '$',
    rateLookup: fakeRateLookup().lookup,
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders session details correctly', () => {
    render(<SessionView {...mockProps} />);
    expect(screen.getByText('Test Store')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getAllByText('Family').length).toBeGreaterThan(0);
  });

  it('shows the fixed rate Money uses when a USD Session has a stored rate of 1', () => {
    render(<SessionView {...mockProps} session={{ ...mockSession, exchangeRate: 1 }} />);
    expect(screen.getByText('1 USD = 3.7 ₪')).toBeInTheDocument();
    expect(screen.getByDisplayValue('3.7')).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', () => {
    render(<SessionView {...mockProps} />);
    const backBtn = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backBtn);
    expect(mockProps.onBack).toHaveBeenCalled();
  });

  it('calls onSave when save button is clicked', () => {
    render(<SessionView {...mockProps} />);
    const saveBtn = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveBtn);
    expect(mockProps.onSave).toHaveBeenCalled();
  });

  it('calls onDelete when delete button is clicked', () => {
    render(<SessionView {...mockProps} />);
    const deleteBtn = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteBtn);
    expect(mockProps.onDelete).toHaveBeenCalled();
  });

  it('opens chat when chat button is clicked', () => {
    render(<SessionView {...mockProps} />);
    const chatBtn = screen.getByRole('button', { name: /chat/i });
    fireEvent.click(chatBtn);
    expect(screen.getByText(translations.en.aiAssistant)).toBeInTheDocument();
  });

  it('calls onChat when message is sent', () => {
    render(<SessionView {...mockProps} />);
    fireEvent.click(screen.getByRole('button', { name: /chat/i }));
    const input = screen.getByPlaceholderText(translations.en.typeCommand);
    fireEvent.change(input, { target: { value: 'Assign Item 1 to John' } });
    const sendBtn = screen.getByRole('button', { name: /send/i });
    fireEvent.click(sendBtn);
    expect(mockProps.onChat).toHaveBeenCalledWith('Assign Item 1 to John');
  });

  it('calls categorizeItems when regenerate button is clicked', async () => {
    vi.mocked(geminiService.categorizeItems).mockResolvedValueOnce([
      { name: 'Item 1', category: 'New Cat', labels: ['New Tag'] }
    ]);
    render(<SessionView {...mockProps} />);
    const regenerateBtn = screen.getByRole('button', { name: /regenerate/i });
    fireEvent.click(regenerateBtn);
    
    await waitFor(() => {
      expect(geminiService.categorizeItems).toHaveBeenCalled();
      expect(mockProps.setSession).toHaveBeenCalled();
    });
  });

  describe('the rate to ILS', () => {
    const unconfirmed = { ...mockSession, exchangeRate: 3.1268, rateConfirmed: false };

    it('shows the badge and marks ILS amounts as estimated while the rate is unconfirmed', () => {
      render(<SessionView {...mockProps} session={unconfirmed} />);
      expect(screen.getByText(translations.en.waitingForRate)).toBeInTheDocument();
      expect(screen.getByText(translations.en.ilsEstimated)).toBeInTheDocument();
    });

    it('shows neither once the rate is confirmed', () => {
      render(<SessionView {...mockProps} session={{ ...unconfirmed, rateConfirmed: true }} />);
      expect(screen.queryByText(translations.en.waitingForRate)).not.toBeInTheDocument();
      expect(screen.queryByText(translations.en.ilsEstimated)).not.toBeInTheDocument();
    });

    it("looks up the new currency's rate for the receipt's date and leaves it unconfirmed", async () => {
      const { lookup, calls } = fakeRateLookup();
      const session = { ...mockSession, rateConfirmed: true, createdAt: new Date(2026, 2, 15, 10).toISOString() };
      render(<SessionView {...mockProps} session={session} rateLookup={lookup} />);
      fireEvent.click(screen.getByRole('button', { name: '€' }));
      await waitFor(() => expect(mockProps.setSession).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'EUR', exchangeRate: 3.62, rateConfirmed: false }),
      ));
      expect(calls).toEqual([['EUR', '2026-03-15']]);
    });

    it('leaves the rate unknown when the lookup fails', async () => {
      render(<SessionView {...mockProps} rateLookup={fakeRateLookup({}).lookup} />);
      fireEvent.click(screen.getByRole('button', { name: '€' }));
      await waitFor(() => expect(mockProps.setSession).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'EUR', exchangeRate: null, rateConfirmed: false }),
      ));
    });

    it('sets rate 1, confirmed, for a change to ILS without a lookup', async () => {
      const { lookup, calls } = fakeRateLookup();
      render(<SessionView {...mockProps} session={unconfirmed} rateLookup={lookup} />);
      fireEvent.click(screen.getByRole('button', { name: '₪' }));
      await waitFor(() => expect(mockProps.setSession).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'ILS', exchangeRate: 1, rateConfirmed: true }),
      ));
      expect(calls).toEqual([]);
    });

    it('confirms the suggested rate in one tap', () => {
      render(<SessionView {...mockProps} session={unconfirmed} />);
      fireEvent.click(screen.getByRole('button', { name: translations.en.acceptRate }));
      expect(mockProps.setSession).toHaveBeenLastCalledWith(
        expect.objectContaining({ exchangeRate: 3.1268, rateConfirmed: true }),
      );
    });

    it('confirms the rate the user types', () => {
      render(<SessionView {...mockProps} session={unconfirmed} />);
      fireEvent.change(screen.getByDisplayValue('3.1268'), { target: { value: '3.2' } });
      expect(mockProps.setSession).toHaveBeenLastCalledWith(
        expect.objectContaining({ exchangeRate: 3.2, rateConfirmed: true }),
      );
    });
  });

  it('opens image modal when eye icon is clicked', () => {
    render(<SessionView {...mockProps} />);
    const eyeBtn = screen.getByRole('button', { name: /view image/i });
    fireEvent.click(eyeBtn);
    expect(screen.getByText(translations.en.viewOriginal)).toBeInTheDocument();
  });
});
