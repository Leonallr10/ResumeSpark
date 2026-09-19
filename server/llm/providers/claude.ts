import Anthropic from "@anthropic-ai/sdk";

// Models that support extended thinking and require the thinking beta header
const EXTENDED_THINKING_MODELS = [
  "claude-sonnet-4-5",
  "claude-sonnet-4-6",
  "claude-opus-4",
  "claude-opus-4-5",
  "claude-3-7-sonnet",
  "claude-3-7-sonnet-20250219",
];

function isExtendedThinkingModel(model: string): boolean {
  return EXTENDED_THINKING_MODELS.some((m) => model.toLowerCase().includes(m.toLowerCase()));
}

export async function generateWithClaude(
  apiKey: string,
  prompt: string,
  model?: string,
): Promise<string> {
  const anthropic = new Anthropic({ apiKey });
  const resolvedModel = model || "claude-sonnet-4-20250514";

  let response: Anthropic.Message;

  if (isExtendedThinkingModel(resolvedModel)) {
    // Extended thinking models require the thinking beta + budget_tokens.
    // Temperature must be 1 for extended thinking.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    response = await (anthropic.beta.messages.create as unknown as (params: Record<string, unknown>) => Promise<Anthropic.Message>)({
      model: resolvedModel,
      max_tokens: 16000,
      temperature: 1,
      thinking: { type: "enabled", budget_tokens: 8000 },
      betas: ["interleaved-thinking-2025-05-14"],
      system:
        "You are an expert technical resume tailoring assistant. Return valid JSON only. Do not wrap in markdown.",
      messages: [{ role: "user", content: prompt }],
    });
  } else {
    response = await anthropic.messages.create({
      model: resolvedModel,
      max_tokens: 8192,
      system:
        "You are an expert technical resume tailoring assistant. Return valid JSON only. Do not wrap in markdown.",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.25,
    });
  }

  // Collect all text blocks — thinking models interleave ThinkingBlock + TextBlock
  const textParts = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  if (!textParts.trim()) {
    throw new Error(
      `Claude (${resolvedModel}) returned an empty response. ` +
        "This can happen when the model is rate-limited or the thinking budget was exhausted. " +
        "Try again or switch to a non-thinking model.",
    );
  }

  return textParts;
}
