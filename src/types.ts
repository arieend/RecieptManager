export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
}

export interface BillSession {
  id?: string;
  ownerUid: string;
  date: any; // Firestore Timestamp
  receiptData: ReceiptData;
  people: string[];
  totals: PersonTotal[];
  currency: string;
  receiptImageUrl?: string;
}

export interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  category?: string;
  assignedTo: string[]; // List of person names
}

export interface ReceiptData {
  storeName?: string;
  items: ReceiptItem[];
  tax: number;
  tip: number;
  total: number;
  currency?: string;
  receiptImageUrl?: string;
}

export interface PersonTotal {
  name: string;
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}
