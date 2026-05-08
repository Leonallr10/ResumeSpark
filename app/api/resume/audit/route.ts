import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resumeSectionSchema, suggestionResponseSchema } from "@/lib/schemas";
import { getResumeText } from "@/lib/resume";
import type { LlmProvider } from "@/types/resume";

export const runtime = "nodejs";

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"] as const;

const ENV_KEY_MAP: Record<LlmProvider, string> = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  claude: "ANTHROPIC_API_KEY",
};

const auditRequestSchema = z.object({
  resumeSections: z.array(resumeSectionSchema).min(1),
  provider: z.enum(["gemini", "groq", "claude"]).default("gemini"),
  model: z.string().min(1).max(120).optional(),
  apiKey: z.string().min(1).max(500).optional(),
});

export async function POST(request: Request) {
  const parsedRequest = auditRequestSchema.safeParse(await request.json());

  if (!parsedRequest.success) {
    return NextResponse.json(
      { error: "Invalid request payload.", details: parsedRequest.error.flatten() },
      { status: 400 },
    );
  }

  const provider = parsedRequest.data.provider;
  const resolvedApiKey =
    parsedRequest.data.apiKey?.trim() || process.env[ENV_KEY_MAP[provider]];

  if (!resolvedApiKey) {
    return NextResponse.json(
      { error: `Missing ${provider} API key. Add it in settings or .env.local.` },
      { status: 500 },
    );
  }

  try {
    const prompt = buildAuditPrompt(parsedRequest.data);
    let responseText: string;

    if (provider === "groq") {
      responseText = await generateWithGroq(resolvedApiKey, prompt, parsedRequest.data.model);
    } else if (provider === "claude") {
      responseText = await generateWithClaude(resolvedApiKey, prompt, parsedRequest.data.model);
    } else {
      responseText = await generateWithGemini(resolvedApiKey, prompt, parsedRequest.data.model);
    }

    const parsedJson = parseJson(responseText);
    const validated = suggestionResponseSchema.parse(parsedJson);
    const safe = filterValidTargets(validated, parsedRequest.data.resumeSections);

    return NextResponse.json(safe);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? "LLM returned an invalid response shape."
        : "Unable to audit resume.";

    return NextResponse.json(
      { error: message, details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

type AuditRequest = z.infer<typeof auditRequestSchema>;

function buildAuditPrompt(input: AuditRequest) {
  const sectionIndex = input.resumeSections
    .map((section) => {
      const lines = section.lines
        .map((line) => {
          const metadata = [
            `lineId=${line.id}`,
            `kind=${line.kind ?? "text"}`,
            typeof line.sourceLine === "number" ? `sourceLine=${line.sourceLine + 1}` : "",
          ]
            .filter(Boolean)
            .join(" | ");

          return `- ${metadata}\n  visibleText=${line.text}`;
        })
        .join("\n");

      return `sectionId=${section.id}\nsectionTitle=${section.title}\n${lines}`;
    })
    .join("\n\n");

  return `
You are an expert ATS (Applicant Tracking System) resume auditor. Analyze the resume below for THREE specific issues and return fix suggestions. Your goal is to help the user pass ATS scanners by fixing weak areas.

=== AUDIT CATEGORIES ===

1. **QUANTIFYING IMPACT** (prefix reason with "[Quantify]")
   Find bullet points that describe achievements WITHOUT any numbers, percentages, metrics, or scale indicators.
   - Bad: "Improved application performance"
   - Good: "Improved application performance by 40%, reducing load time from 3.2s to 1.9s"
   - Bad: "Built a dashboard for the sales team"
   - Good: "Built a dashboard used by 25+ sales representatives, consolidating 5 data sources"

   For each, suggest a rewrite that adds PLAUSIBLE metrics. Use reasonable estimates based on context:
   - Team size: 5-50 depending on company size
   - User counts: 100-10K for internal tools, 1K-100K for products
   - Performance: 20-60% improvements
   - Time savings: 2-10x faster
   DO NOT fabricate exact numbers that sound made up. Use ranges or approximations (e.g., "50+", "~30%", "3x").

2. **REPETITION** (prefix reason with "[Repetition]")
   Find words or phrases used MORE THAN ONCE across different bullet points:
   - Repeated action verbs (e.g., "Built" used 4 times)
   - Repeated phrases (e.g., "real-time" in multiple bullets)
   - Repeated sentence structures

   Suggest replacements using varied synonyms:
   - Built → Engineered, Developed, Constructed, Implemented, Created
   - Improved → Enhanced, Optimized, Streamlined, Accelerated, Refined
   - Managed → Orchestrated, Coordinated, Directed, Oversaw, Led
   - Used → Leveraged, Utilized, Employed, Applied, Harnessed

   Only flag CLEAR repetition (same word used 2+ times). Keep the first occurrence, suggest changes for subsequent ones.

3. **SPELLING & GRAMMAR** (prefix reason with "[Grammar]")
   Find:
   - Typos and misspellings
   - Grammar errors (subject-verb agreement, tense inconsistency)
   - Awkward phrasing that sounds unnatural
   - Missing articles or prepositions
   - Inconsistent tense (mixing past and present tense across bullets)

   Suggest the corrected version.

=== OUTPUT RULES ===

- Return valid JSON only. No markdown code blocks.
- Every string value must be a single line (no literal newlines).
- Each suggestion must target an existing lineId and sectionId.
- action is always "replace" for audit fixes.
- suggestedText contains the full corrected line text.
- reason starts with the category tag: [Quantify], [Repetition], or [Grammar]
- jdMatchReason explains why this fix helps ATS scoring.
- Only suggest changes for lines with kind=bullet or kind=text. Never modify subheading, projectHeading, or header lines.
- If the resume has no issues in a category, simply don't include suggestions for that category.
- Aim for 5-15 total suggestions across all categories. Don't overload with minor issues.

Return this exact JSON shape:
{
  "suggestions": [
    {
      "id": "audit-1",
      "targetLineId": "existing line id",
      "sectionId": "existing section id",
      "action": "replace",
      "originalText": "the current line text",
      "suggestedText": "the improved line text",
      "reason": "[Category] explanation of the issue",
      "jdMatchReason": "why this helps ATS scoring"
    }
  ],
  "sectionReviews": [
    {
      "sectionId": "existing section id",
      "status": "needs_changes",
      "summary": "brief description of issues found in this section"
    }
  ]
}

Resume as plain text:
${getResumeText(input.resumeSections)}

Resume sections with stable IDs:
${sectionIndex}
`.trim();
}

async function generateWithGemini(apiKey: string, prompt: string, model?: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const models = model
    ? [model, ...GEMINI_MODELS.filter((m) => m !== model)]
    : [...GEMINI_MODELS];

  for (const m of models) {
    try {
      const result = await ai.models.generateContent({
        model: m,
        contents: prompt,
        config: { responseMimeType: "application/json", temperature: 0.2 },
      });
      return result.text ?? "";
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("404") || msg.includes("NOT_FOUND")) continue;
      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) continue;
      throw error;
    }
  }

  throw new Error("All Gemini models failed.");
}

async function generateWithGroq(apiKey: string, prompt: string, model?: string): Promise<string> {
  const groq = new Groq({ apiKey });
  const response = await groq.chat.completions.create({
    model: model || "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: "You are an expert ATS resume auditor. Return valid JSON only." },
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
    max_tokens: 4096,
    system: "You are an expert ATS resume auditor. Return valid JSON only. Do not wrap the JSON in markdown code blocks.",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text",
  );
  return textBlock?.text ?? "";
}

function parseJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  if (!cleaned) throw new Error("LLM returned an empty response.");

  try {
    return JSON.parse(cleaned);
  } catch {
    const fixed = cleaned.replace(
      /"(?:[^"\\]|\\.)*"/g,
      (match) => match.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t"),
    );
    return JSON.parse(fixed);
  }
}

function filterValidTargets(
  response: z.infer<typeof suggestionResponseSchema>,
  sections: z.infer<typeof resumeSectionSchema>[],
) {
  const validSections = new Set(sections.map((s) => s.id));
  const lineById = new Map(
    sections.flatMap((s) => s.lines.map((l) => [l.id, l] as const)),
  );

  const suggestions = response.suggestions.filter((s) => {
    const line = lineById.get(s.targetLineId);
    if (!line || !validSections.has(s.sectionId)) return false;
    if (line.kind === "subheading" || line.kind === "projectHeading" || line.kind === "header") return false;
    return true;
  });

  const suggestedSections = new Set(suggestions.map((s) => s.sectionId));

  return {
    suggestions,
    sectionReviews: response.sectionReviews.filter(
      (r) => validSections.has(r.sectionId) && suggestedSections.has(r.sectionId),
    ),
  };
}
