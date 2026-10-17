import type { ReactNode, Ref } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';
import { syncToCloud } from './services/syncService';
import { GoogleApiError } from './services/googleApiError';
import { signInWithDrive, uploadReceipt, confirmReview } from './test/appFlow';

// Mock Firebase
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: {
      uid: 'test-uid',
      displayName: 'Test User',
      email: 'test@example.com',
      photoURL: 'http://photo.com'
    },
  })),
  onAuthStateChanged: vi.fn((auth, cb) => {
    cb({
      uid: 'test-uid',
      displayName: 'Test User',
      email: 'test@example.com',
      photoURL: 'http://photo.com'
    });
    return vi.fn();
  }),
  GoogleAuthProvider: class {
    static credentialFromResult = vi.fn(() => ({ accessToken: 'mock-token' }));
    addScope = vi.fn();
    setCustomParameters = vi.fn();
  },
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  setPersistence: vi.fn(() => Promise.resolve()),
  browserLocalPersistence: 'browserLocalPersistence',
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  initializeFirestore: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn((q, cb) => {
    cb({ docs: [] });
    return vi.fn();
  }),
  doc: vi.fn(),
  getDocFromServer: vi.fn(),
  setDoc: vi.fn(),
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-doc-id' })),
}));

// Mock Gemini SDK
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class {
      models = {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            store_or_brand_name: 'Mock Store',
            store_name_english: 'Mock Store',
            price: 100,
            items: [],
            tax: 10,
            tip: 5
          })
        })
      };
    },
    Type: {
      OBJECT: 'OBJECT',
      ARRAY: 'ARRAY',
      STRING: 'STRING',
      NUMBER: 'NUMBER',
      INTEGER: 'INTEGER'
    }
  };
});

// Mock motion to avoid animation issues
vi.mock('motion/react', () => {
  const React = require('react');
  const motion = Object.assign(<T,>(Component: T) => Component, {} as Record<string, unknown>);
  const tags = ['div', 'main', 'span', 'button', 'section', 'h1', 'h2', 'h3', 'p', 'img', 'video', 'canvas', 'svg', 'path', 'line'];
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

// Mock utils and services
vi.mock('./utils/imageUtils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./utils/imageUtils')>()),
  prepareReceiptImage: vi.fn(() => Promise.resolve('data:image/jpeg;base64,mock')),
  compressImage: vi.fn((b) => Promise.resolve(b)),
}));

vi.mock('./services/geminiService', () => ({
  parseReceiptImage: vi.fn(() => new Promise(resolve => {
    setTimeout(() => {
      resolve({
        store_or_brand_name: 'Mock Store',
        store_name_english: 'Mock Store',
        items: [],
        tax: 0,
        tip: 0,
        price: 0,
      });
    }, 100);
  })),
  interpretChatCommand: vi.fn(),
  transcribeStoreName: vi.fn(),
}));

vi.mock('./services/syncService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./services/syncService')>()),
  syncToCloud: vi.fn(async () => ({
    driveFileId: 'file-1',
    driveLink: 'https://drive.google.com/file/d/file-1/view',
    driveFileName: 'receipt.jpg',
    spreadsheetLink: 'https://docs.google.com/spreadsheets/d/sheet-1/edit',
  })),
}));

beforeEach(() => {
  localStorage.clear();
});

describe('App Camera Functionality', () => {
  it('triggers the scanner when "Take Photo" is clicked', async () => {
    // Mock getUserMedia
    const mockGetUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }]
    });
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: mockGetUserMedia
      },
      configurable: true,
      writable: true
    });

    render(<App />);
    
    // Find the "Scan Receipt" or "Take Photo" button
    const takePhotoBtn = await screen.findByText(/Scan Receipt|Start Scanning|Take Photo|סרוק קבלה|צלם קבלה/i);
    expect(takePhotoBtn).toBeInTheDocument();
    
    // Click the button
    fireEvent.click(takePhotoBtn);
    
    // Verify that the scanner overlay text is present
    await waitFor(() => {
      expect(screen.getByText(/Position the receipt within the frame|מקמו את הקבלה בתוך המסגרת/i)).toBeInTheDocument();
    });
  });

  it('starts parsing when a file is selected via the file input', async () => {
    render(<App />);
    uploadReceipt();
    
    // Wait for parsing state
    await waitFor(() => {
      expect(screen.getByText(/Parsing Receipt|מנתח קבלה/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Wait for the review view to appear (mocked Gemini response)
    // First, verify the review step header is visible
    expect(await screen.findByText(/Review Parsed Data|ביקורת נתונים/i, {}, { timeout: 5000 })).toBeInTheDocument();
    
    // The store name should be inside the input field
    const storeInput = await screen.findByDisplayValue(/Mock Store/i, {}, { timeout: 3000 });
    expect(storeInput).toBeInTheDocument();
  });
});

describe('Saving a receipt', () => {
  it('appends its rows to the Purchases sheet once when auto-save files it and the user then presses Save', async () => {
    signInWithDrive();
    render(<App />);
    uploadReceipt();

    await confirmReview();
    await waitFor(() => expect(syncToCloud).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Later edits don't reach it/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument());
    const sheetWrites = vi.mocked(syncToCloud).mock.calls.filter(([, settings]) => settings.syncToSheets);
    expect(sheetWrites).toHaveLength(1);
  }, 15000);
});

describe('An expired Google access token', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const sessionExpired = 'Google Drive session expired. Please reconnect.';
  const googleAccessKeys = () => [localStorage.getItem('drive_token'), localStorage.getItem('drive_token_timestamp')];

  it('is cleared from storage when Google rejects it during Receipt filing', async () => {
    signInWithDrive();
    vi.mocked(syncToCloud).mockRejectedValueOnce(new GoogleApiError('Invalid Credentials', 401));
    render(<App />);
    uploadReceipt();

    await confirmReview();

    expect(await screen.findByText(sessionExpired)).toBeInTheDocument();
    expect(googleAccessKeys()).toEqual([null, null]);
    expect(screen.getByTitle('Connect Google Drive')).toBeInTheDocument();
  }, 15000);

  it('is cleared from storage when Google rejects it while connecting a spreadsheet', async () => {
    signInWithDrive();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'Invalid Credentials' } }) })));
    render(<App />);

    fireEvent.click(screen.getByTitle('Connect Google Sheets'));

    expect(await screen.findByText(sessionExpired)).toBeInTheDocument();
    expect(googleAccessKeys()).toEqual([null, null]);
    expect(screen.getByTitle('Connect Google Drive')).toBeInTheDocument();
  });
});
