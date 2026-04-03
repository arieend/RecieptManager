import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ItemCard } from './ItemCard';
import { translations } from '../translations';

describe('ItemCard', () => {
  const mockItem = {
    id: 'i1',
    name: 'Test Item',
    price: 10.5,
    quantity: 2,
    assignedTo: ['p1'],
    category: 'Food',
    labels: ['Tag1'],
  };

  const mockPeople = [
    { id: 'p1', name: 'Person 1', color: '#ff0000' },
    { id: 'p2', name: 'Person 2', color: '#00ff00' },
  ];

  const mockProps = {
    item: mockItem,
    people: mockPeople,
    currencySymbol: '$',
    onToggleAssignment: vi.fn(),
    onUpdateQuantity: vi.fn(),
    translations: translations.en,
  };

  it('renders item details correctly', () => {
    render(<ItemCard {...mockProps} />);
    expect(screen.getByText('Test Item')).toBeInTheDocument();
    expect(screen.getByText('$10.50')).toBeInTheDocument();
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getByText('#Tag1')).toBeInTheDocument();
  });

  it('calls onUpdateQuantity when + or - is clicked', () => {
    render(<ItemCard {...mockProps} />);
    const plusBtn = screen.getByText('+');
    const minusBtn = screen.getByText('-');
    
    fireEvent.click(plusBtn);
    expect(mockProps.onUpdateQuantity).toHaveBeenCalledWith('i1', 3);
    
    fireEvent.click(minusBtn);
    expect(mockProps.onUpdateQuantity).toHaveBeenCalledWith('i1', 1);
  });

  it('calls onToggleAssignment when a person button is clicked', () => {
    render(<ItemCard {...mockProps} />);
    const personBtn = screen.getByText('Person 2');
    fireEvent.click(personBtn);
    expect(mockProps.onToggleAssignment).toHaveBeenCalledWith('i1', 'p2');
  });

  it('shows total price when quantity > 1', () => {
    render(<ItemCard {...mockProps} />);
    expect(screen.getByText('$21.00')).toBeInTheDocument();
  });

  it('highlights assigned people', () => {
    render(<ItemCard {...mockProps} />);
    const person1Btn = screen.getByText('Person 1');
    expect(person1Btn).toHaveClass('bg-emerald-600');
    
    const person2Btn = screen.getByText('Person 2');
    expect(person2Btn).toHaveClass('bg-slate-100');
  });
});
