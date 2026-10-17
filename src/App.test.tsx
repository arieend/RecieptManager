import type { ReactNode, Ref } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';
import { syncToCloud } from './services/syncService';

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
    // Mock URL.createObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock');

    render(<App />);
    
    // Find the hidden file input
    const inputs = document.querySelectorAll('input[type="file"]');
    const fileInput = Array.from(inputs).find(input => !input.getAttribute('capture')) as HTMLInputElement;
    
    // Create a mock file
    const file = new File(['(⌐□_□)'], 'receipt.png', { type: 'image/png' });
    
    // Trigger the change event
    fireEvent.change(fileInput, { target: { files: [file] } });
    
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
    localStorage.setItem('drive_token', 'mock-token');
    localStorage.setItem('drive_token_timestamp', String(Date.now()));
    global.URL.createObjectURL = vi.fn(() => 'blob:mock');
    render(<App />);
    const inputs = document.querySelectorAll('input[type="file"]');
    const fileInput = Array.from(inputs).find(input => !input.getAttribute('capture')) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(['(⌐□_□)'], 'receipt.png', { type: 'image/png' })] } });

    fireEvent.click(await screen.findByRole('button', { name: /^Confirm$/ }, { timeout: 5000 }));
    await waitFor(() => expect(syncToCloud).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Later edits don't reach it/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument());
    const sheetWrites = vi.mocked(syncToCloud).mock.calls.filter(([, settings]) => settings.syncToSheets);
    expect(sheetWrites).toHaveLength(1);
  }, 15000);
});
