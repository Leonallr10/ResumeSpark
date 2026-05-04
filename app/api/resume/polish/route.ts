import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import { NextResponse } from "next/server";

import { polishRequestSchema } from "@/lib/schemas";
import type { LlmProvider, PolishAction } from "@/types/resume";

export const runtime = "nodejs";

const GEMINI_MODELS = ["gemini-2.5-pro-preview-05-06", "gemini-2.0-flash"] as const;

const ENV_KEY_MAP: Record<LlmProvider, string> = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  claude: "ANTHROPIC_API_KEY",
};

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

  const provider = parsed.data.provider;
  const resolvedApiKey = parsed.data.apiKey?.trim() || process.env[ENV_KEY_MAP[provider]];

  if (!resolvedApiKey) {
    return NextResponse.json(
      { error: `Missing ${provider} API key. Add it in settings or .env.local.` },
      { status: 500 },
    );
  }

  const { text, action } = parsed.data;

  const userPrompt = `Selected text: "${text}"

Polish type: "${action}"
→ ${ACTION_INSTRUCTIONS[action]}

Rewrite the selected text using the "${action}" polish type.
Return ONLY the rewritten text.`;

  try {
    if (provider === "groq") {
      return streamGroq(resolvedApiKey, userPrompt, parsed.data.model);
    }
    if (provider === "claude") {
      return streamClaude(resolvedApiKey, userPrompt, parsed.data.model);
    }
    return streamGemini(resolvedApiKey, userPrompt, parsed.data.model);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);
    return NextResponse.json(
      { error: `${providerLabel} error: ${message}` },
      { status: 500 },
    );
  }
}

const STREAM_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-cache",
  "X-Content-Type-Options": "nosniff",
} as const;

async function streamGemini(apiKey: string, userPrompt: string, model?: string) {
  const ai = new GoogleGenAI({ apiKey });
  const fullPrompt = `${SYSTEM_PROMPT}\n\n${userPrompt}`;
  const preferredModel = model?.trim() || GEMINI_MODELS[0];
  const modelsToTry = [
    preferredModel,
    ...GEMINI_MODELS.filter((m) => m !== preferredModel),
  ];

  for (const modelId of modelsToTry) {
    try {
      const stream = await ai.models.generateContentStream({
        model: modelId,
        contents: fullPrompt,
        config: { temperature: 0.3 },
      });

      const readable = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          try {
            for await (const chunk of stream) {
              const part = chunk.text ?? "";
              if (part) controller.enqueue(encoder.encode(part));
            }
          } catch (streamError) {
            controller.error(streamError);
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, { headers: STREAM_HEADERS });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("not found") || message.includes("not supported")) continue;
      throw error;
    }
  }

  throw new Error("No available Gemini model could fulfill the request.");
}

async function streamGroq(apiKey: string, userPrompt: string, model?: string) {
  const groq = new Groq({ apiKey });
  const stream = await groq.chat.completions.create({
    model: model || "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    stream: true,
  });

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of stream) {
          const part = chunk.choices[0]?.delta?.content ?? "";
          if (part) controller.enqueue(encoder.encode(part));
        }
      } catch (streamError) {
        controller.error(streamError);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, { headers: STREAM_HEADERS });
}

async function streamClaude(apiKey: string, userPrompt: string, model?: string) {
  const anthropic = new Anthropic({ apiKey });

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        const stream = anthropic.messages.stream({
          model: model || "claude-sonnet-4-20250514",
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
          temperature: 0.3,
        });

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (streamError) {
        controller.error(streamError);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, { headers: STREAM_HEADERS });
}
