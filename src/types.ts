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
  /** Rate to convert to ILS (1 original unit = X ILS); null when unknown. Read it through Money. */
  exchangeRate: number | null;
  /**
   * Whether the user accepted the rate. Absent on Sessions saved before Unconfirmed rates
   * existed, which count as confirmed (ADR-0003).
   */
  rateConfirmed?: boolean;
  imageUrl?: string;
  driveFileId?: string;
  driveLink?: string;
  driveFileName?: string;
  spreadsheetLink?: string;
  updatedAt?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  createdAt: string;
}

/** Chromium's `beforeinstallprompt` event, which lib.dom does not declare. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}
