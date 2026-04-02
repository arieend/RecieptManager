import { Session, ReceiptItem, Person } from '../types';

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

export const calculateTotals = (session: Session): Totals => {
  const personTotals: Record<string, number> = {};
  const categoryTotals: Record<string, number> = {};
  const tagTotals: Record<string, number> = {};
  
  session.people.forEach((p: Person) => personTotals[p.id] = 0);
  
  let assignedSubtotal = 0;
  session.items.forEach((item: ReceiptItem) => {
    const cat = item.category || 'Other';
    const price = Number(item.price) || 0;
    const quantity = Number(item.quantity) || 1;
    const itemTotal = price * quantity;
    
    categoryTotals[cat] = (categoryTotals[cat] || 0) + itemTotal;

    (item.labels || []).forEach((tag: string) => {
      tagTotals[tag] = (tagTotals[tag] || 0) + itemTotal;
    });

    if (item.assignedTo.length > 0) {
      assignedSubtotal += itemTotal;
      const share = itemTotal / item.assignedTo.length;
      item.assignedTo.forEach((personId: string) => {
        personTotals[personId] = (personTotals[personId] || 0) + share;
      });
    }
  });

  const subtotal = session.items.reduce((sum: number, item: ReceiptItem) => {
    const price = Number(item.price) || 0;
    const quantity = Number(item.quantity) || 1;
    return sum + (price * quantity);
  }, 0);

  const tax = Number(session.tax) || 0;
  const tip = Number(session.tip) || 0;
  const sessionTotal = Number(session.total) || 0;

  const totalWithTaxTip = sessionTotal || (subtotal + tax + tip);
  const ratio = subtotal > 0 ? totalWithTaxTip / subtotal : 1;

  const finalTotals = Object.entries(personTotals).map(([id, amount]) => ({
    id,
    name: session.people.find((p: Person) => p.id === id)?.name || 'Unknown',
    amount: amount * ratio
  }));

  const finalCategoryTotals = Object.entries(categoryTotals).map(([name, amount]) => ({
    name,
    amount
  })).sort((a, b) => b.amount - a.amount);

  const finalTagTotals = Object.entries(tagTotals).map(([name, amount]) => ({
    name,
    amount
  })).sort((a, b) => b.amount - a.amount);

  const unassignedAmount = (subtotal - assignedSubtotal) * ratio;
  const progress = subtotal > 0 ? (assignedSubtotal / subtotal) * 100 : 0;

  return { 
    personTotals: finalTotals, 
    categoryTotals: finalCategoryTotals,
    tagTotals: finalTagTotals,
    subtotal, 
    total: totalWithTaxTip,
    unassignedAmount,
    progress,
    tax: session.tax,
    tip: session.tip
  };
};
