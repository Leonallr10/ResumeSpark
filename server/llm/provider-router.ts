import { generateWithGemini } from "./providers/gemini";
import { generateWithClaude } from "./providers/claude";
import { generateWithGroq } from "./providers/groq";
import { generateWithOllama } from "./providers/ollama";
import type { LlmProvider } from "@/types/resume";

const ENV_KEY_MAP: Record<LlmProvider, string> = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  claude: "ANTHROPIC_API_KEY",
};

export async function executeLlmGeneration(params: {
  provider: LlmProvider | "ollama";
  prompt: string;
  apiKey?: string;
  model?: string;
  jsonSchema?: Record<string, unknown>;
  systemInstruction?: string;
}): Promise<string> {
  const { provider, prompt, apiKey, model, jsonSchema, systemInstruction } = params;

  if (provider === "ollama") {
    return generateWithOllama(prompt, model);
  }

  const resolvedApiKey = apiKey?.trim() || process.env[ENV_KEY_MAP[provider]];
  if (!resolvedApiKey) {
    throw new Error(`Missing ${provider} API key. Configure it in settings or .env.local.`);
  }

  if (provider === "groq") {
    return generateWithGroq(resolvedApiKey, prompt, model, systemInstruction);
  }

  if (provider === "claude") {
    return generateWithClaude(resolvedApiKey, prompt, model, systemInstruction);
  }

  return generateWithGemini(resolvedApiKey, prompt, model, jsonSchema, systemInstruction);
}
