import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const parseReceiptImage = async (base64Image: string, mimeType: string = "image/jpeg") => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze this receipt ${mimeType.includes('pdf') ? 'document' : 'image'} and extract the following information in JSON format:
    - storeName: The name of the store or restaurant.
    - items: An array of objects, each with 'name' (string) and 'price' (number).
    - tax: The tax amount (number).
    - tip: The tip amount (number, if present, otherwise 0).
    - total: The total amount (number).
    - date: The date on the receipt (string, YYYY-MM-DD format if possible).
    - time: The time on the receipt (string, HH:mm format if possible).

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
          storeName: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                price: { type: Type.NUMBER }
              },
              required: ["name", "price"]
            }
          },
          tax: { type: Type.NUMBER },
          tip: { type: Type.NUMBER },
          total: { type: Type.NUMBER },
          date: { type: Type.STRING },
          time: { type: Type.STRING }
        },
        required: ["storeName", "items", "tax", "tip", "total"]
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
      "itemPrice": number (if add_item)
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
