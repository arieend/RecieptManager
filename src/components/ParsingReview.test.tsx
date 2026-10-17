import type { ReactNode, Ref } from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ParsingReview } from './ParsingReview';
import { translations } from '../translations';
import type { Session } from '../types';
import type { RateLookup } from '../services/rateLookup';

vi.mock('motion/react', () => {
  const React = require('react');
  const motion = new Proxy({}, {
    get: (_target, tag: string) =>
      React.forwardRef(({ children, ...props }: { children?: ReactNode; [prop: string]: unknown }, ref: Ref<unknown>) => {
        const { initial, animate, exit, transition, ...rest } = props;
        return React.createElement(tag, { ...rest, ref }, children);
      }),
  });
  return { motion, AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</> };
});

const t = translations.en;

const draft = (overrides: Partial<Session> = {}): Session => ({
  id: 's1',
  userId: 'u1',
  storeName: 'Corner Shop',
  items: [{ id: 'i1', name: 'Bread', price: 10, quantity: 1, assignedTo: [], category: 'Food', labels: [] }],
  people: [],
  tax: 0,
  tip: 0,
  total: 10,
  currency: 'USD',
  exchangeRate: 3.1268,
  rateConfirmed: false,
  createdAt: new Date(2026, 2, 13, 12).toISOString(),
  updatedAt: new Date(2026, 2, 13, 12).toISOString(),
  ...overrides,
});

const renderReview = (session: Session, rateLookup: RateLookup = vi.fn(async () => null)) => {
  const onConfirm = vi.fn();
  render(
    <ParsingReview
      session={session}
      rateLookup={rateLookup}
      onConfirm={onConfirm}
      onRescan={vi.fn()}
      onCancel={vi.fn()}
      language="en"
      translations={translations}
      currencySymbol="₪"
    />,
  );
  return { onConfirm, rateLookup };
};

const confirmButton = () => screen.getByRole('button', { name: t.ok });
const rateField = () => screen.getByLabelText(t.rateToIlsLabel) as HTMLInputElement;

describe('ParsingReview', () => {
  it('shows the suggested rate and keeps Confirm disabled until it is accepted', () => {
    const { onConfirm } = renderReview(draft());

    expect(rateField().value).toBe('3.1268');
    expect(confirmButton()).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: t.acceptRate }));
    fireEvent.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ exchangeRate: 3.1268, rateConfirmed: true }));
  });

  it('shows an empty field marked unknown when there is no rate, and a typed positive rate confirms it', () => {
    const { onConfirm } = renderReview(draft({ currency: 'EUR', exchangeRate: null }));

    expect(rateField().value).toBe('');
    expect(screen.getByText(t.rateUnknown)).toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();

    fireEvent.change(rateField(), { target: { value: '0' } });
    expect(confirmButton()).toBeDisabled();

    fireEvent.change(rateField(), { target: { value: '3.95' } });
    fireEvent.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ exchangeRate: 3.95, rateConfirmed: true }));
  });

  it('looks the rate up again for a new date and needs it confirmed again', async () => {
    const rateLookup = vi.fn<RateLookup>(async () => 3.2001);
    const { onConfirm } = renderReview(draft(), rateLookup);
    fireEvent.click(screen.getByRole('button', { name: t.acceptRate }));
    expect(confirmButton()).toBeEnabled();

    fireEvent.change(screen.getByLabelText(t.transactionDate), { target: { value: '2026-03-15' } });

    expect(rateLookup).toHaveBeenCalledWith('USD', '2026-03-15');
    expect(confirmButton()).toBeDisabled();
    await waitFor(() => expect(rateField().value).toBe('3.2001'));

    fireEvent.click(screen.getByRole('button', { name: t.acceptRate }));
    fireEvent.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ exchangeRate: 3.2001, rateConfirmed: true }));
  });

  describe('while the lookup for a new date is pending', () => {
    /** A Rate lookup that answers only when the test says so. */
    const pendingLookup = () => {
      let answer: (rate: number | null) => void = () => {};
      const lookup = vi.fn<RateLookup>(() => new Promise((resolve) => { answer = resolve; }));
      return { lookup, answer: (rate: number | null) => act(async () => answer(rate)) };
    };
    const acceptButton = () => screen.getByRole('button', { name: new RegExp(`${t.acceptRate}|${t.rateAccepted}`) });

    it('keeps the rate unconfirmed with Accept off, and a typed rate survives the late result', async () => {
      const { lookup, answer } = pendingLookup();
      const { onConfirm } = renderReview(draft(), lookup);
      fireEvent.click(acceptButton());

      fireEvent.change(screen.getByLabelText(t.transactionDate), { target: { value: '2026-03-15' } });
      expect(acceptButton()).toBeDisabled();
      expect(confirmButton()).toBeDisabled();

      fireEvent.change(rateField(), { target: { value: '3.3' } });
      await answer(3.2001);

      expect(rateField().value).toBe('3.3');
      fireEvent.click(confirmButton());
      expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ exchangeRate: 3.3, rateConfirmed: true }));
    });

    it('does not show a rate as accepted that the user never accepted', async () => {
      const { lookup, answer } = pendingLookup();
      const { onConfirm } = renderReview(draft(), lookup);

      fireEvent.change(screen.getByLabelText(t.transactionDate), { target: { value: '2026-03-15' } });
      fireEvent.click(acceptButton());
      await answer(3.2001);

      expect(rateField().value).toBe('3.2001');
      expect(screen.getByRole('button', { name: t.acceptRate })).toBeEnabled();
      expect(confirmButton()).toBeDisabled();
      fireEvent.click(confirmButton());
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  it('empties the field when the new date has no rate', async () => {
    renderReview(draft(), vi.fn<RateLookup>(async () => null));

    fireEvent.change(screen.getByLabelText(t.transactionDate), { target: { value: '2026-03-16' } });

    await waitFor(() => expect(rateField().value).toBe(''));
    expect(confirmButton()).toBeDisabled();
  });

  it('shows no rate field for an ILS receipt and confirms it as before', () => {
    const rateLookup = vi.fn<RateLookup>(async () => null);
    const session = draft({ currency: 'ILS', exchangeRate: 1, rateConfirmed: true });
    const { onConfirm } = renderReview(session, rateLookup);

    expect(screen.queryByLabelText(t.rateToIlsLabel)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(t.transactionDate), { target: { value: '2026-03-15' } });
    fireEvent.click(confirmButton());

    expect(rateLookup).not.toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ currency: 'ILS', exchangeRate: 1, rateConfirmed: true }));
  });

  it('has Hebrew strings for the rate field and the accept action', () => {
    for (const key of ['rateToIlsLabel', 'acceptRate', 'rateAccepted', 'rateUnknown'] as const) {
      expect(translations.he[key]).toMatch(/[֐-׿]/);
    }
  });
});
