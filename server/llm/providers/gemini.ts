import { GoogleGenAI } from "@google/genai";

const GEMINI_MODELS = [
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
] as const;

export async function generateWithGemini(
  apiKey: string,
  prompt: string,
  preferredModel?: string,
  jsonSchema?: Record<string, unknown>,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const delaysMs = [1000, 2000];
  let lastError: unknown;

  const modelsToTry = preferredModel
    ? [preferredModel, ...GEMINI_MODELS.filter((m) => m !== preferredModel)]
    : [...GEMINI_MODELS];

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseJsonSchema: jsonSchema,
            temperature: 0.25,
          },
        });
        return response.text ?? "";
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("404") || msg.includes("NOT_FOUND")) {
          break; // skip to next fallback model
        }
        if (attempt < delaysMs.length) {
          await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]));
        }
      }
    }
  }

  throw lastError ?? new Error("Gemini generation failed across all retry models.");
}
