import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

import { polishRequestSchema } from "@/lib/schemas";
import type { PolishAction } from "@/types/resume";

export const runtime = "nodejs";

const GEMINI_MODELS = ["gemini-1.5-pro", "gemini-1.5-pro-latest", "gemini-pro"] as const;

const SYSTEM_PROMPT = `You are an expert resume writing assistant specialized in polishing resume content for software engineering roles.

The user has selected a specific word, line, or sentence from their resume and chosen a polishing action.

Your job is to return ONLY the rewritten version of the selected text — nothing else. No explanation, no preamble, no quotes, no labels, no markdown formatting.

STRICT RULES:
- Never change the core meaning or fabricate new facts
- Never add metrics that weren't implied in the original
- Keep the same subject (same tech, same project, same action)
- Output must be resume-ready (starts with action verb if it's a bullet)
- Match the length target based on polish type
- Preserve any LaTeX commands and formatting in the text exactly as they are
- If the text contains a metric (e.g., "40%"), preserve the exact number
- If the text mentions or includes links (Demo, Certificate, GitHub, live link, etc.), format them using: \\textcolor{blue}{\\href{URL}{\\textit{\\small LinkText}}}
- If the original text already has \\href or \\textcolor for links, preserve them exactly
- Any new link references added during elaboration must use the blue \\textcolor+\\href pattern
- Output only the rewritten text — plain, no markdown, no surrounding quotes`;

const ACTION_INSTRUCTIONS: Record<PolishAction, string> = {
  improve:
    "Fix weak verbs, vague language, passive voice. Make it sharper and more impactful. Keep the same length.",
  elaborate:
    "Expand the text by adding technical context, method used, or outcome. Target: 1.5x to 2x the original length. Must fill complete lines — no half-lines.",
  professional:
    "Rewrite using formal, corporate resume tone. Replace casual words with industry-standard terminology. Keep length similar.",
  concise:
    "Trim without losing meaning. Remove filler words. Target: 1 clean line.",
  quantify:
    'Add implied or reasonable scale/impact language. Never invent hard numbers unless the user provided them. e.g., "reduced load time" → "reduced load time by optimizing render pipeline, improving performance across all page views"',
};

export async function POST(request: Request) {
  const parsed = polishRequestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const resolvedApiKey = parsed.data.apiKey?.trim() || process.env.GEMINI_API_KEY;

  if (!resolvedApiKey) {
    return NextResponse.json(
      { error: "Missing Gemini API key. Add it in settings or .env.local." },
      { status: 500 },
    );
  }

  const { text, action } = parsed.data;

  const userPrompt = `Selected text: "${text}"

Polish type: "${action}"
→ ${ACTION_INSTRUCTIONS[action]}

Rewrite the selected text using the "${action}" polish type.
Return ONLY the rewritten text.`;

  const fullPrompt = `${SYSTEM_PROMPT}\n\n${userPrompt}`;

  const ai = new GoogleGenAI({ apiKey: resolvedApiKey });
  const preferredModel = parsed.data.model?.trim() || GEMINI_MODELS[0];
  const modelsToTry = [
    preferredModel,
    ...GEMINI_MODELS.filter((m) => m !== preferredModel),
  ];

  for (const model of modelsToTry) {
    try {
      const stream = await ai.models.generateContentStream({
        model,
        contents: fullPrompt,
        config: { temperature: 0.3 },
      });

      const readable = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();

          try {
            for await (const chunk of stream) {
              const part = chunk.text ?? "";

              if (part) {
                controller.enqueue(encoder.encode(part));
              }
            }
          } catch (streamError) {
            controller.error(streamError);
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes("not found") || message.includes("not supported")) {
        continue;
      }

      if (
        message.includes("429") ||
        message.includes("RESOURCE_EXHAUSTED") ||
        message.toLowerCase().includes("quota")
      ) {
        return NextResponse.json(
          { error: "Gemini quota limit reached. Please retry shortly." },
          { status: 429 },
        );
      }

      if (message.includes("503") || message.includes("UNAVAILABLE")) {
        return NextResponse.json(
          { error: "Gemini is busy right now. Please retry in a moment." },
          { status: 503 },
        );
      }

      return NextResponse.json(
        { error: `Gemini error: ${message}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    { error: "No available Gemini model could fulfill the request." },
    { status: 500 },
  );
}
