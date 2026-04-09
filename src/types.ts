export type Language = 'en' | 'he';

export interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  assignedTo: string[]; // Array of Person IDs
  category?: string;
  labels?: string[];
  quantity: number;
  sheetsLink?: string;
}

export interface Person {
  id: string;
  name: string;
  color: string;
}

export interface Session {
  id: string;
  userId: string;
  storeName: string;
  englishStoreName?: string;
  createdAt: string;
  items: ReceiptItem[];
  people: Person[];
  tax: number;
  tip: number;
  total: number;
  currency: 'ILS' | 'USD' | 'EUR';
  exchangeRate: number; // Rate to convert to ILS (1 original unit = X ILS)
  imageUrl?: string;
  driveFileId?: string;
  driveLink?: string;
  driveFileName?: string;
  spreadsheetLink?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  createdAt: string;
}
