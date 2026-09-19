import { Guardrails } from "@/server/guardrails";
import { executeLlmGeneration } from "@/server/llm/provider-router";
import type { LlmProvider, PolishAction } from "@/types/resume";
import { z } from "zod";

const polishResponseSchema = z.object({
  polishedText: z.string().min(1),
  explanation: z.string().optional(),
});

export interface PolishOrchestratorInput {
  text: string;
  action: PolishAction;
  provider: LlmProvider;
  model?: string;
  apiKey?: string;
  ipOrUser?: string;
}

export async function orchestrateTextPolish(input: PolishOrchestratorInput): Promise<{ polishedText: string }> {
  const ip = input.ipOrUser || "anonymous";

  // 1. INPUT GUARD
  const inputCheck = Guardrails.runInputGuard(
    {
      resumeText: input.text,
    },
    ip,
  );

  if (!inputCheck.ok) {
    throw new Error(inputCheck.error || "Input guardrail validation failed.");
  }

  const prompt = `
You are an expert resume editor and technical writer.
Apply the action "${input.action}" to the following bullet point or resume text.

Input Text:
${input.text}

Action descriptions:
- "improve": Make the phrasing sharper, stronger, and more impactful using high-signal action verbs.
- "elaborate": Add technical depth, architectural reasoning, and scale context.
- "professional": Elevate tone to executive and senior engineer standards.
- "concise": Remove fluff and trim to high-density 1-2 lines.
- "quantify": Frame the achievement around metrics, efficiency gain, latency, or throughput without fabricating false facts.

Return valid JSON in this shape:
{
  "polishedText": "The polished sentence/bullet without leading bullet points or markdown fences.",
  "explanation": "Brief rationale"
}
`.trim();

  // 2. PROVIDER ROUTER -> LLM
  const rawResponse = await executeLlmGeneration({
    provider: input.provider,
    prompt,
    apiKey: input.apiKey,
    model: input.model,
  });

  // 3. OUTPUT GUARD
  const outputCheck = Guardrails.runOutputGuard(rawResponse, polishResponseSchema, ip);

  if (!outputCheck.ok || !outputCheck.data) {
    // Fallback if model returned plain string
    const fallbackCleaned = rawResponse.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    return { polishedText: fallbackCleaned || input.text };
  }

  return { polishedText: outputCheck.data.polishedText };
}
