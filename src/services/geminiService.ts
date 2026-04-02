import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const parseReceiptImage = async (base64Image: string, mimeType: string = "image/jpeg") => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze this receipt ${mimeType.includes('pdf') ? 'document' : 'image'} and extract the following information in JSON format:
    - store_or_brand_name: The name of the store or brand as it appears on the receipt. If it's in a non-English script (like Hebrew or Cyrillic), provide it in that script. If not found, return "unknown".
    - store_name_english: The common English name of the store or brand. For example, if the store is "שופרסל", return "Supersal". If it's "סופר-פארם", return "Superpharm". If it's "מאיר שיווק", return "Meir Shivuk". Use the most common English brand name if available.
    - transaction_datetime: The date and time on the receipt (string, YYYY-MM-DD HH:mm:ss format). If not found, return null.
    - price: The total price amount (number). If not found, return 0.
    - items: An array of objects, each with 'name' (string), 'unit_price' (number, the price for a single item), 'quantity' (integer, default to 1 if not clear), 'category' (string, e.g., "Food", "Electronics", "Clothing", "Home"), and 'labels' (array of strings, e.g., ["Grocery", "Dairy", "Snack"]).
    - tax: The tax amount (number).
    - tip: The tip amount (number, if present, otherwise 0).

    Return ONLY the JSON object.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image.split(',')[1] || base64Image
            }
          }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          store_or_brand_name: { type: Type.STRING },
          store_name_english: { type: Type.STRING },
          transaction_datetime: { type: Type.STRING, nullable: true },
          price: { type: Type.NUMBER },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                unit_price: { type: Type.NUMBER },
                quantity: { type: Type.INTEGER },
                category: { type: Type.STRING },
                labels: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ["name", "unit_price", "quantity", "category", "labels"]
            }
          },
          tax: { type: Type.NUMBER },
          tip: { type: Type.NUMBER }
        },
        required: ["store_or_brand_name", "store_name_english", "price", "items", "tax", "tip"]
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const interpretChatCommand = async (command: string, items: any[], people: any[]) => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Given a list of items and people, interpret the following command: "${command}"
    
    Items: ${JSON.stringify(items.map(i => ({ id: i.id, name: i.name })))}
    People: ${JSON.stringify(people.map(p => ({ id: p.id, name: p.name })))}
    
    Return a JSON object representing the action:
    {
      "action": "assign" | "add_person" | "add_item" | "unknown",
      "itemId": "string (if assign)",
      "personId": "string (if assign)",
      "personName": "string (if add_person)",
      "itemName": "string (if add_item)",
      "itemPrice": number (if add_item),
      "itemQuantity": number (if add_item, default to 1)
    }
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  });

  return JSON.parse(response.text || '{}');
};

export const transcribeStoreName = async (base64Image: string) => {
  const model = "gemini-3-flash-preview";
  const prompt = "What is the name of the store on this receipt? Return only the name.";
  
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(',')[1] || base64Image
            }
          }
        ]
      }
    ]
  });

  return response.text?.trim() || "Unknown Store";
};

export const categorizeItems = async (itemNames: string[]) => {
  const model = "gemini-3-flash-preview";
  const prompt = `Categorize these items from a receipt and provide 2-3 relevant labels for each. 
    Items: ${itemNames.join(', ')}`;
    
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            category: { type: Type.STRING },
            labels: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["name", "category", "labels"]
        }
      }
    }
  });

  return JSON.parse(response.text || '[]');
};
