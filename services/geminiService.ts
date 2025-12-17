
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
  // Always use a new GoogleGenAI instance for each request to ensure fresh configuration.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const imageParts = await Promise.all(files.map(file => fileToGenerativePart(file)));

  const prompt = `
    As an expert culinary nutritionist specialized in Pan-Asian cuisine, analyze these food images with high precision.
    
    1. Identify specific regional dishes from Malay (e.g., Nasi Lemak, Rendang), Indian (e.g., Biryani, Paneer Tikka), Chinese (e.g., Dim Sum, Char Kway Teow), Thai (e.g., Tom Yum, Pad Thai), or Vietnamese (e.g., Pho, Banh Mi) cuisines.
    2. Pay close attention to hidden ingredients:
       - Coconut milk/cream in curries and desserts.
       - Palm oil or ghee used in frying or sautéing.
       - Sugar content in sauces (especially Thai and Vietnamese).
       - Sodium levels in fermented pastes (Belacan, Miso, Fish Sauce).
    3. Estimate nutritional content per serving shown. Be conservative with calorie counts—Asian street food and restaurant dishes often use more oil than home-cooked versions.
    4. If a dish is deep-fried (like Tempura or Pakora), ensure the fat content reflects that.

    Return the response as a valid JSON object.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { 
                    type: Type.STRING,
                    description: "Specific name of the dish, including regional identifiers if possible."
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
              description: "A brief nutritional breakdown explaining why these values were chosen (e.g., 'High fat due to coconut milk base')."
            }
          },
          required: ["items", "summary"]
        }
      }
    });

    // Directly access the .text property from the GenerateContentResponse object.
    const text = response.text;
    if (!text) throw new Error("No response text from Gemini");
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};
