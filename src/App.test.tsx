import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';

// Mock Firebase
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: null,
  })),
  onAuthStateChanged: vi.fn((auth, cb) => {
    cb(null);
    return vi.fn();
  }),
  GoogleAuthProvider: class {
    addScope = vi.fn();
  },
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
  doc: vi.fn(),
  getDocFromServer: vi.fn(),
}));

// Mock Gemini SDK
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = {
      generateContent: vi.fn(),
    };
  },
  Type: {
    OBJECT: 'OBJECT',
    ARRAY: 'ARRAY',
    STRING: 'STRING',
    NUMBER: 'NUMBER',
  },
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    section: ({ children, ...props }: any) => <section {...props}>{children}</section>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock utils and services
vi.mock('./utils/imageUtils', () => ({
  resizeImage: vi.fn(() => Promise.resolve('data:image/png;base64,mock')),
}));

vi.mock('./services/geminiService', () => ({
  parseReceiptImage: vi.fn(() => new Promise(resolve => {
    setTimeout(() => {
      resolve({
        storeName: 'Mock Store',
        items: [],
        tax: 0,
        tip: 0,
        total: 0,
      });
    }, 100);
  })),
  interpretChatCommand: vi.fn(),
  transcribeStoreName: vi.fn(),
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
    
    // Find the "Take Photo" button
    const takePhotoBtn = screen.getByText(/Take Photo|צלם קבלה/i);
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
    });

    // Wait for the summary view to appear (mocked Gemini response)
    const summaryHeader = await screen.findByText(/Receipt Items|פריטי קבלה/i, {}, { timeout: 5000 });
    expect(summaryHeader).toBeInTheDocument();
  });
});
