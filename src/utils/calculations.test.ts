import { describe, it, expect } from 'vitest';
import { calculateTotals } from './calculations';
import { Session } from '../types';

describe('calculateTotals', () => {
  const mockSession: Session = {
    id: '1',
    userId: 'user1',
    storeName: 'Test Store',
    items: [
      { id: 'i1', name: 'Item 1', price: 10, quantity: 1, assignedTo: ['p1'], category: 'Food', labels: ['Tag1'] },
      { id: 'i2', name: 'Item 2', price: 20, quantity: 2, assignedTo: ['p1', 'p2'], category: 'Drink', labels: ['Tag2'] },
      { id: 'i3', name: 'Item 3', price: 5, quantity: 1, assignedTo: [], category: 'Other', labels: [] },
    ],
    people: [
      { id: 'p1', name: 'Person 1', color: '#ff0000' },
      { id: 'p2', name: 'Person 2', color: '#00ff00' },
    ],
    tax: 5,
    tip: 10,
    total: 70,
    createdAt: new Date().toISOString(),
    imageUrl: '',
    driveFileId: '',
    driveLink: '',
    driveFileName: '',
  };

  it('calculates subtotal correctly', () => {
    const totals = calculateTotals(mockSession);
    // 10*1 + 20*2 + 5*1 = 10 + 40 + 5 = 55
    expect(totals.subtotal).toBe(55);
  });

  it('calculates total correctly using session total', () => {
    const totals = calculateTotals(mockSession);
    expect(totals.total).toBe(70);
  });

  it('calculates total correctly when session total is missing', () => {
    const sessionWithoutTotal = { ...mockSession, total: 0 };
    const totals = calculateTotals(sessionWithoutTotal);
    // subtotal (55) + tax (5) + tip (10) = 70
    expect(totals.total).toBe(70);
  });

  it('calculates person totals correctly with ratio', () => {
    const totals = calculateTotals(mockSession);
    // subtotal = 55, total = 70, ratio = 70/55 = 1.2727...
    // i1 (10) assigned to p1
    // i2 (40) assigned to p1, p2 (20 each)
    // p1 raw = 10 + 20 = 30
    // p2 raw = 20
    // p1 final = 30 * (70/55) = 38.1818...
    // p2 final = 20 * (70/55) = 25.4545...
    const p1 = totals.personTotals.find(p => p.id === 'p1');
    const p2 = totals.personTotals.find(p => p.id === 'p2');
    expect(p1?.amount).toBeCloseTo(38.18, 2);
    expect(p2?.amount).toBeCloseTo(25.45, 2);
  });

  it('calculates unassigned amount correctly', () => {
    const totals = calculateTotals(mockSession);
    // i3 (5) is unassigned
    // unassigned raw = 5
    // unassigned final = 5 * (70/55) = 6.3636...
    expect(totals.unassignedAmount).toBeCloseTo(6.36, 2);
  });

  it('calculates progress correctly', () => {
    const totals = calculateTotals(mockSession);
    // assigned subtotal = 10 + 40 = 50
    // subtotal = 55
    // progress = (50/55) * 100 = 90.9090...
    expect(totals.progress).toBeCloseTo(90.91, 2);
  });

  it('calculates category totals correctly', () => {
    const totals = calculateTotals(mockSession);
    const food = totals.categoryTotals.find(c => c.name === 'Food');
    const drink = totals.categoryTotals.find(c => c.name === 'Drink');
    expect(food?.amount).toBe(10);
    expect(drink?.amount).toBe(40);
  });

  it('handles zero subtotal correctly', () => {
    const emptySession: Session = { ...mockSession, items: [], total: 0 };
    const totals = calculateTotals(emptySession);
    expect(totals.subtotal).toBe(0);
    expect(totals.total).toBe(15); // tax (5) + tip (10)
    expect(totals.progress).toBe(0);
  });
});
