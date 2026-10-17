import { Session, ReceiptItem, Person } from '../types';
import { itemAmount, sessionTotal, subtotal as subtotalOf } from './money';

export interface Totals {
  personTotals: { id: string; name: string; amount: number }[];
  categoryTotals: { name: string; amount: number }[];
  tagTotals: { name: string; amount: number }[];
  subtotal: number;
  total: number;
  unassignedAmount: number;
  progress: number;
  tax: number;
  tip: number;
}

/** Splits the Session's bill, in its own currency. Every amount is a Line amount, so tax, tip and discounts are shared out. */
export const calculateTotals = (session: Session): Totals => {
  const personTotals: Record<string, number> = {};
  const categoryTotals: Record<string, number> = {};
  const tagTotals: Record<string, number> = {};
  
  session.people.forEach((p: Person) => personTotals[p.id] = 0);
  
  let assignedSubtotal = 0;
  let unassignedAmount = 0;
  session.items.forEach((item: ReceiptItem) => {
    const cat = item.category || 'Other';
    const amount = itemAmount(session, item).original;
    
    categoryTotals[cat] = (categoryTotals[cat] || 0) + amount;

    (item.labels || []).forEach((tag: string) => {
      tagTotals[tag] = (tagTotals[tag] || 0) + amount;
    });

    if (item.assignedTo.length > 0) {
      assignedSubtotal += (Number(item.price) || 0) * (Number(item.quantity) || 1);
      const share = amount / item.assignedTo.length;
      item.assignedTo.forEach((personId: string) => {
        personTotals[personId] = (personTotals[personId] || 0) + share;
      });
    } else {
      unassignedAmount += amount;
    }
  });

  const subtotal = subtotalOf(session);

  const finalTotals = Object.entries(personTotals).map(([id, amount]) => ({
    id,
    name: session.people.find((p: Person) => p.id === id)?.name || 'Unknown',
    amount
  }));

  const finalCategoryTotals = Object.entries(categoryTotals).map(([name, amount]) => ({
    name,
    amount
  })).sort((a, b) => b.amount - a.amount);

  const finalTagTotals = Object.entries(tagTotals).map(([name, amount]) => ({
    name,
    amount
  })).sort((a, b) => b.amount - a.amount);

  const progress = subtotal > 0 ? (assignedSubtotal / subtotal) * 100 : 0;

  return { 
    personTotals: finalTotals, 
    categoryTotals: finalCategoryTotals,
    tagTotals: finalTagTotals,
    subtotal, 
    total: sessionTotal(session).original,
    unassignedAmount,
    progress,
    tax: session.tax,
    tip: session.tip
  };
};
