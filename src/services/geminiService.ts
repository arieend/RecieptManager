import { GoogleGenAI, Type } from "@google/genai";
import { ReceiptData, ReceiptItem } from "../types";
import { Language } from "../translations";

// Lazy initialization to prevent startup crashes if the API key is missing
let aiClient: GoogleGenAI | null = null;

const getAIClient = (): GoogleGenAI => {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required.");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
};

const MODEL_NAME = "gemini-3-flash-preview";

/**
 * Safely parses a JSON string, falling back to a default value if parsing fails.
 */
const safeParseJSON = <T>(text: string | undefined, fallback: T): T => {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    console.error("Failed to parse LLM response as JSON:", error, text);
    return fallback;
  }
};

interface LLMReceiptResponse {
  storeName?: string;
  items?: { name?: string; price?: number; category?: string }[];
  tax?: number;
  tip?: number;
}

export const parseReceiptImage = async (base64Image: string, mimeType: string): Promise<ReceiptData> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType: mimeType,
              },
            },
            {
              text: "Extract the store name, items, prices, categories, tax, and tip from this receipt. Return a JSON object with 'storeName', 'items' (array of {name, price, category}), 'tax', and 'tip'. The category should be a short, general classification (e.g., Groceries, Electronics, Food, Drinks). IMPORTANT: Do not extract VAT (מע\"מ) as tax, as it is already included in the item prices. Set tax to 0 unless there is an additional tax explicitly added on top of the items. If tax or tip are not found, use 0. Ensure prices are numbers.",
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            storeName: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  price: { type: Type.NUMBER },
                  category: { type: Type.STRING },
                },
                required: ["name", "price"],
              },
            },
            tax: { type: Type.NUMBER },
            tip: { type: Type.NUMBER },
          },
          required: ["items", "tax", "tip"],
        },
      },
    });

    const data = safeParseJSON<LLMReceiptResponse>(response.text, {});
    
    // Add unique IDs and ensure types
    const itemsWithIds: ReceiptItem[] = (data.items || []).map((item, index) => ({
      id: `item-${Date.now()}-${index}`,
      name: item.name || 'Unknown Item',
      price: Number(item.price) || 0,
      category: item.category || 'Uncategorized',
      assignedTo: [],
    }));

    const tax = Number(data.tax) || 0;
    const tip = Number(data.tip) || 0;
    const subtotal = itemsWithIds.reduce((sum, item) => sum + item.price, 0);

    return {
      storeName: data.storeName || 'Unknown Store',
      items: itemsWithIds,
      tax,
      tip,
      total: subtotal + tax + tip,
    };
  } catch (error) {
    console.error("Error parsing receipt image:", error);
    throw new Error("Failed to parse receipt image. Please try again.");
  }
};

interface LLMChatResponse {
  assignments?: { itemId?: string; personNames?: string[] }[];
  newPeople?: string[];
  feedback?: string;
}

export const transcribeStoreName = async (storeName: string): Promise<string> => {
  if (!storeName) return 'Receipt';
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Transliterate the following store name into English letters (e.g., 'ברברשופ' -> 'Barbershop'). If it's a known brand, use its English name. Return ONLY the English name, no punctuation. Store name: ${storeName}`,
    });
    
    const transcribed = response.text?.trim() || 'Receipt';
    // Clean up any non-alphanumeric characters just in case
    return transcribed.replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'Receipt';
  } catch (error) {
    console.error("Failed to transcribe store name:", error);
    return storeName;
  }
};

export const interpretChatCommand = async (
  command: string, 
  items: ReceiptItem[], 
  people: string[],
  language: Language = 'he'
): Promise<{ 
  assignments: { itemId: string; personNames: string[] }[]; 
  newPeople: string[];
  feedback: string;
}> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `
        You are a receipt labeling assistant.
        Current items: ${JSON.stringify(items.map(i => ({ id: i.id, name: i.name })))}
        Current labels: ${JSON.stringify(people)}
        
        User command: "${command}"
        
        Interpret the command to assign items to labels. 
        - If the user says "Label the nachos as Snacks", find the item "nachos" (or closest match) and assign it the label "Snacks".
        - If multiple labels apply to an item, assign all of them.
        - If a label is not in the current list, add it.
        - Return a JSON object with:
          - 'assignments': array of { itemId, personNames } (personNames means labels here)
          - 'newPeople': array of labels to add to the list (only those not already in 'labels')
          - 'feedback': a short friendly confirmation message in ${language === 'he' ? 'Hebrew' : 'English'}.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            assignments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  itemId: { type: Type.STRING },
                  personNames: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ["itemId", "personNames"],
              },
            },
            newPeople: { type: Type.ARRAY, items: { type: Type.STRING } },
            feedback: { type: Type.STRING },
          },
          required: ["assignments", "newPeople", "feedback"],
        },
      },
    });

    const parsed = safeParseJSON<LLMChatResponse>(response.text, {});
    
    return {
      assignments: (parsed.assignments || []).map(a => ({
        itemId: a.itemId || '',
        personNames: a.personNames || []
      })),
      newPeople: parsed.newPeople || [],
      feedback: parsed.feedback || (language === 'he' ? 'אירעה שגיאה בעיבוד הבקשה.' : 'Error processing command.')
    };
  } catch (error) {
    console.error("Error interpreting chat command:", error);
    throw new Error("Failed to interpret command. Please try again.");
  }
};
