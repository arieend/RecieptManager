import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SummaryCard } from './SummaryCard';
import { translations } from '../translations';

// Mock motion to avoid animation issues
vi.mock('motion/react', () => {
  const React = require('react');
  const motion = (Component: any) => Component;
  const tags = ['div', 'span', 'button', 'section', 'h1', 'h2', 'h3', 'p', 'img', 'video', 'canvas', 'svg', 'path', 'line'];
  tags.forEach(tag => {
    (motion as any)[tag] = React.forwardRef(({ children, ...props }: any, ref: any) => {
      const { initial, animate, exit, transition, ...rest } = props;
      return React.createElement(tag, { ...rest, ref }, children);
    });
  });
  return {
    motion,
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

describe('SummaryCard', () => {
  const mockTotals = {
    personTotals: [
      { id: 'p1', name: 'Person 1', amount: 30 },
      { id: 'p2', name: 'Person 2', amount: 20 },
    ],
    categoryTotals: [
      { name: 'Food', amount: 40 },
      { name: 'Drink', amount: 10 },
    ],
    tagTotals: [
      { name: 'Tag1', amount: 50 },
    ],
    subtotal: 50,
    total: 70,
    unassignedAmount: 20,
    progress: 60,
    tax: 10,
    tip: 10,
  };

  const mockProps = {
    totals: mockTotals,
    language: 'en' as const,
    translations: translations,
    currencySymbol: '$',
  };

  it('renders total amount correctly', () => {
    render(<SummaryCard {...mockProps} />);
    expect(screen.getByText('$70.00')).toBeInTheDocument();
  });

  it('renders person totals by default', () => {
    render(<SummaryCard {...mockProps} />);
    expect(screen.getByText('Person 1')).toBeInTheDocument();
    expect(screen.getByText('$30.00')).toBeInTheDocument();
    expect(screen.getByText('Person 2')).toBeInTheDocument();
    // Use getAllByText because unassigned amount might also be $20.00
    expect(screen.getAllByText('$20.00').length).toBeGreaterThanOrEqual(1);
  });

  it('switches to category breakdown when tab is clicked', () => {
    render(<SummaryCard {...mockProps} />);
    const categoryTab = screen.getByText(translations.en.categoryBreakdown);
    fireEvent.click(categoryTab);
    
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getByText('$40.00')).toBeInTheDocument();
    expect(screen.queryByText('Person 1')).not.toBeInTheDocument();
  });

  it('switches to tags breakdown when tab is clicked', () => {
    render(<SummaryCard {...mockProps} />);
    const tagsTab = screen.getByText(translations.en.tags);
    fireEvent.click(tagsTab);
    
    expect(screen.getByText('#Tag1')).toBeInTheDocument();
    expect(screen.getByText('$50.00')).toBeInTheDocument();
  });

  it('renders tax and tip details', () => {
    render(<SummaryCard {...mockProps} />);
    expect(screen.getByText(/Tax: \$10.00/i)).toBeInTheDocument();
    expect(screen.getByText(/Tip: \$10.00/i)).toBeInTheDocument();
  });

  it('renders unassigned amount if > 0', () => {
    render(<SummaryCard {...mockProps} />);
    expect(screen.getByText(translations.en.unassignedAmount)).toBeInTheDocument();
    // Use getAllByText because Person 2 also has $20.00
    expect(screen.getAllByText('$20.00').length).toBeGreaterThanOrEqual(1);
  });
});
