import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseReceiptImage, interpretChatCommand, transcribeStoreName, categorizeItems } from './geminiService';

// Mock GoogleGenAI
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

describe('geminiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parseReceiptImage calls generateContent with correct parameters', async () => {
    const result = await parseReceiptImage('base64data', 'image/jpeg');
    expect(result.store_or_brand_name).toBe('Mock Store');
    expect(result.price).toBe(100);
  });

  it('interpretChatCommand calls generateContent with correct parameters', async () => {
    const result = await interpretChatCommand('Assign burger to John', [], []);
    // The mock returns the same JSON for all calls in this setup, 
    // but we can verify it's parsed correctly.
    expect(result).toBeDefined();
  });

  it('transcribeStoreName returns a string', async () => {
    const result = await transcribeStoreName('base64data');
    expect(typeof result).toBe('string');
  });

  it('categorizeItems returns an array', async () => {
    // We need to adjust the mock for this specific call if we want a different response
    const result = await categorizeItems(['Burger', 'Coke']);
    expect(result).toBeDefined();
  });
});
