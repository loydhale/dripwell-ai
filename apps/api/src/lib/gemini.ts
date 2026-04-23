import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
const isMockMode = process.env.VISION_MOCK_MODE === 'true' || !apiKey;

export const VISION_MOCK_MODE = isMockMode;

let client: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (isMockMode) {
    throw new Error('Gemini client not available in mock mode');
  }
  if (!client) {
    client = new GoogleGenerativeAI(apiKey!);
  }
  return client;
}

export function getVisionModel() {
  if (isMockMode) {
    throw new Error('Vision model not available in mock mode');
  }
  const gemini = getGeminiClient();
  return gemini.getGenerativeModel({
    model: 'gemini-2.5-pro-preview-03-25',
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });
}

export function getTextModel() {
  if (isMockMode) {
    throw new Error('Text model not available in mock mode');
  }
  const gemini = getGeminiClient();
  return gemini.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });
}
