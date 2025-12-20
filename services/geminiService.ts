import { GoogleGenAI, Type } from "@google/genai";

export const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzeMealImage = async (files: File[]): Promise<any> => {
  if (!process.env.API_KEY) {
      throw new Error("Missing Google Gemini API Key. Please configure API_KEY in your .env file.");
  }

  // Always use a new GoogleGenAI instance for each request to ensure fresh configuration.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const imageParts = await Promise.all(files.map(file => fileToGenerativePart(file)));

  const prompt = `
    As an expert culinary nutritionist specialized in Pan-Asian cuisine, analyze these food images.
    
    1. Identify specific dishes from Malay, Indian, Chinese, Thai, or Vietnamese cuisines.
    2. Estimate calories, protein, carbs, and fat per serving.
    3. Account for hidden fats like coconut milk, palm oil, or ghee.
    4. Provide a catchy, concise name for the overall meal (max 6 words).

    Return the response as a valid JSON object.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: {
        parts: [
          { text: prompt },
          ...imageParts.map(p => ({ inlineData: p.inlineData }))
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mealName: {
              type: Type.STRING,
              description: "A concise name for the overall meal."
            },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { 
                    type: Type.STRING,
                    description: "Name of the dish."
                  },
                  calories: { type: Type.NUMBER },
                  protein: { type: Type.NUMBER },
                  carbs: { type: Type.NUMBER },
                  fat: { type: Type.NUMBER },
                  servingSize: { type: Type.STRING }
                },
                required: ["name", "calories", "protein", "carbs", "fat"]
              }
            },
            summary: { 
              type: Type.STRING,
              description: "Brief nutritional breakdown."
            }
          },
          required: ["mealName", "items", "summary"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};