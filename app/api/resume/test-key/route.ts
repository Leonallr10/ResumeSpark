import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { LlmProvider } from "@/types/resume";

export const runtime = "nodejs";

const requestSchema = z.object({
  provider: z.enum(["gemini", "groq", "claude"]),
  model: z.string().min(1).max(120),
  apiKey: z.string().min(1).max(500),
});

const ENV_KEY_MAP: Record<LlmProvider, string> = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  claude: "ANTHROPIC_API_KEY",
};

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid request." },
      { status: 400 },
    );
  }

  const { provider, model } = parsed.data;
  const apiKey = parsed.data.apiKey.trim() || process.env[ENV_KEY_MAP[provider]];

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: `No ${provider} API key provided.` },
      { status: 400 },
    );
  }

  try {
    if (provider === "gemini") {
      const ai = new GoogleGenAI({ apiKey });
      const result = await ai.models.generateContent({
        model,
        contents: "Reply with exactly: OK",
        config: { temperature: 0, maxOutputTokens: 10 },
      });
      const text = result.text ?? "";
      return NextResponse.json({ ok: true, reply: text.trim() });
    }

    if (provider === "groq") {
      const groq = new Groq({ apiKey });
      const result = await groq.chat.completions.create({
        model,
        messages: [{ role: "user", content: "Reply with exactly: OK" }],
        temperature: 0,
        max_tokens: 10,
      });
      const text = result.choices[0]?.message?.content ?? "";
      return NextResponse.json({ ok: true, reply: text.trim() });
    }

    if (provider === "claude") {
      const anthropic = new Anthropic({ apiKey });
      const result = await anthropic.messages.create({
        model,
        messages: [{ role: "user", content: "Reply with exactly: OK" }],
        temperature: 0,
        max_tokens: 10,
      });
      const textBlock = result.content.find(
        (block): block is Anthropic.TextBlock => block.type === "text",
      );
      return NextResponse.json({ ok: true, reply: textBlock?.text?.trim() ?? "" });
    }

    return NextResponse.json({ ok: false, error: "Unknown provider." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("401") || message.includes("Unauthorized") || message.includes("invalid")) {
      return NextResponse.json({ ok: false, error: "Invalid API key." }, { status: 401 });
    }

    if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED") || message.toLowerCase().includes("quota")) {
      return NextResponse.json({ ok: false, error: "Key works but quota exceeded. Try later." }, { status: 429 });
    }

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
