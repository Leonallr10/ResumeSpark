import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { LlmProvider } from "@/types/resume";

export const runtime = "nodejs";

const ENV_KEY_MAP: Record<LlmProvider, string> = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  claude: "ANTHROPIC_API_KEY",
};

const errorFixRequestSchema = z.object({
  diagnostic: z.object({
    line: z.number(),
    message: z.string(),
    context: z.string().optional(),
  }),
  codeSnippet: z.string(),
  fullLine: z.string(),
  provider: z.enum(["gemini", "groq", "claude"]),
  model: z.string().optional(),
  apiKey: z.string().optional(),
});

const SYSTEM_PROMPT = `You are an expert LaTeX debugging assistant. Given a LaTeX compilation error and the surrounding code, provide a fix.

Return valid JSON only with this exact structure:
{
  "fixedCode": "the corrected line of LaTeX code",
  "explanation": "brief explanation of what was wrong and how it was fixed"
}

Rules:
- fixedCode should be the complete corrected line that replaces the error line
- Keep the fix minimal — only change what's necessary to resolve the error
- If the fix requires adding a package, mention it in the explanation
- Do not wrap JSON in markdown code blocks`;

export async function POST(request: Request) {
  const parsed = errorFixRequestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { diagnostic, codeSnippet, fullLine, provider, model, apiKey } = parsed.data;

  const resolvedApiKey = apiKey?.trim() || process.env[ENV_KEY_MAP[provider]];

  if (!resolvedApiKey) {
    return NextResponse.json(
      { error: `Missing ${provider} API key. Add it in settings or .env.local.` },
      { status: 500 },
    );
  }

  const userPrompt = `LaTeX compilation error on line ${diagnostic.line}:
Error message: ${diagnostic.message}
${diagnostic.context ? `Context: ${diagnostic.context}` : ""}

The error line:
${fullLine}

Surrounding code (5 lines context):
${codeSnippet}

Provide the corrected version of line ${diagnostic.line} and a brief explanation.`;

  try {
    let responseText: string;

    if (provider === "groq") {
      responseText = await generateWithGroq(resolvedApiKey, userPrompt, model);
    } else if (provider === "claude") {
      responseText = await generateWithClaude(resolvedApiKey, userPrompt, model);
    } else {
      responseText = await generateWithGemini(resolvedApiKey, userPrompt, model);
    }

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "AI returned an unparseable response. Raw: " + responseText.slice(0, 200) },
        { status: 500 },
      );
    }

    let result: { fixedCode?: string; explanation?: string };
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json(
        { error: "AI returned invalid JSON." },
        { status: 500 },
      );
    }

    if (!result.fixedCode) {
      return NextResponse.json(
        { error: "AI did not provide a fix." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      fixedCode: result.fixedCode,
      explanation: result.explanation ?? "Fix applied.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[error-fix] Provider error:", message);
    return NextResponse.json(
      { error: `${provider} error: ${message}` },
      { status: 500 },
    );
  }
}

async function generateWithGroq(apiKey: string, prompt: string, model?: string): Promise<string> {
  const groq = new Groq({ apiKey });
  const response = await groq.chat.completions.create({
    model: model || "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });
  return response.choices[0]?.message?.content ?? "";
}

async function generateWithClaude(apiKey: string, prompt: string, model?: string): Promise<string> {
  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: model || "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });
  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text",
  );
  return textBlock?.text ?? "";
}

const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-2.5-flash"] as const;

async function generateWithGemini(apiKey: string, prompt: string, model?: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const modelsToTry = model
    ? [model, ...GEMINI_MODELS.filter((m) => m !== model)]
    : [...GEMINI_MODELS];

  let lastError: unknown;
  for (const m of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: m,
        contents: `${SYSTEM_PROMPT}\n\n${prompt}`,
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });
      return response.text ?? "";
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
