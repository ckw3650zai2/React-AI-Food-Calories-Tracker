import { GoogleGenAI, Type } from "@google/genai";

// Helper to convert file to base64
export const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
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
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment variables");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Prepare image parts
  const imageParts = await Promise.all(files.map(file => fileToGenerativePart(file)));

  // Schema for structured output
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Name of the food item (e.g. Hainanese Chicken Rice)" },
            calories: { type: Type.NUMBER, description: "Estimated calories" },
            protein: { type: Type.NUMBER, description: "Protein in grams" },
            carbs: { type: Type.NUMBER, description: "Carbohydrates in grams" },
            fat: { type: Type.NUMBER, description: "Fat in grams" },
            servingSize: { type: Type.STRING, description: "Estimated serving size" },
          },
          required: ["name", "calories", "protein", "carbs", "fat"],
        },
      },
      summary: {
        type: Type.STRING,
        description: "A short, encouraging summary of the meal analysis.",
      }
    },
    required: ["items", "summary"],
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        role: 'user',
        parts: [
          ...imageParts,
          {
            text: "Analyze these food images. Identify the dishes (focusing on accuracy for Asian cuisine if applicable). Estimate the nutritional content per serving shown. Be realistic with oil and sauce calories common in Asian cooking. Return JSON."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.4, // Lower temperature for more factual analysis
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response text from Gemini");
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};
