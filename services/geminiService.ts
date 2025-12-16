import { GoogleGenerativeAI } from "@google/generative-ai";

// Helper to convert file to base64 for the stable SDK
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

  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Use gemini-1.5-flash which is standard for this SDK
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.4,
    }
  });

  const imageParts = await Promise.all(files.map(file => fileToGenerativePart(file)));

  const prompt = `
    Analyze these food images. Identify the dishes (focusing on accuracy for Asian cuisine if applicable). 
    Estimate the nutritional content per serving shown. Be realistic with oil and sauce calories common in Asian cooking.
    Return a JSON object with this exact structure:
    {
      "items": [
        {
          "name": "string",
          "calories": number,
          "protein": number,
          "carbs": number,
          "fat": number,
          "servingSize": "string"
        }
      ],
      "summary": "string"
    }
  `;

  try {
    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();
    
    if (!text) throw new Error("No response text from Gemini");
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};