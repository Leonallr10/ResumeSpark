import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  suggestionRequestSchema,
  suggestionResponseSchema,
} from "@/lib/schemas";
import { getResumeText } from "@/lib/resume";

export const runtime = "nodejs";
const GEMINI_SUGGESTION_MODELS = [
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-2.0-flash",
  "gemini-flash-lite-latest",
] as const;

export async function POST(request: Request) {
  const parsedRequest = suggestionRequestSchema.safeParse(await request.json());

  if (!parsedRequest.success) {
    return NextResponse.json(
      {
        error: "Invalid request payload.",
        details: parsedRequest.error.flatten(),
      },
      { status: 400 },
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "Missing GEMINI_API_KEY in .env.local." },
      { status: 500 },
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = buildResumeTailorPrompt(parsedRequest.data);
    const result = await generateWithRetry(ai, prompt);

    const parsedGemini = parseGeminiJson(result.text ?? "");
    const validatedResponse = suggestionResponseSchema.parse(parsedGemini);
    const safeResponse = filterInvalidTargets(validatedResponse, parsedRequest.data);

    return NextResponse.json(safeResponse);
  } catch (error) {
    const quotaError = isQuotaGeminiError(error);
    const retryableError = isRetryableGeminiError(error);
    const retryAfterSeconds = getRetryAfterSeconds(error);
    const message =
      error instanceof z.ZodError
        ? "Gemini returned an invalid response shape."
        : quotaError
          ? "Gemini quota limit reached. Please retry shortly or check Gemini billing/quota."
        : retryableError
          ? "Gemini is busy right now. Please retry in a moment."
        : "Unable to generate resume suggestions.";

    return NextResponse.json(
      {
        error: message,
        details: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: quotaError ? 429 : retryableError ? 503 : 500,
        headers:
          quotaError || retryableError
            ? {
                "Retry-After": String(retryAfterSeconds ?? 4),
              }
            : undefined,
      },
    );
  }
}

type SuggestionRequest = z.infer<typeof suggestionRequestSchema>;
type SuggestionResponse = z.infer<typeof suggestionResponseSchema>;

function buildResumeTailorPrompt(input: SuggestionRequest) {
  const sectionIndex = input.resumeSections
    .map((section) => {
      const lines = section.lines
        .map((line) => {
          const metadata = [
            `lineId=${line.id}`,
            `kind=${line.kind ?? "text"}`,
            typeof line.sourceLine === "number" ? `sourceLine=${line.sourceLine + 1}` : "",
            line.sourceText ? `latex=${line.sourceText}` : "",
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
You are an expert Technical Recruiter, Senior Software Engineer, and Resume Strategist. Tailor the uploaded resume for the target company, role, and job description while keeping the output compatible with this app's inline LaTeX suggestion workflow.

Work internally before writing JSON:
1. Classify the role type such as Frontend, Backend, Fullstack, AI/ML, Data, DevOps, Mobile, or Security.
2. Extract required skills, preferred skills, tools, technologies, seniority expectations, and ATS keywords from the JD.
3. Compare those requirements against the resume and extra project input.
4. Select only high-impact edits that improve ATS match, recruiter readability, technical specificity, project relevance, or concision.
5. Convert that analysis into line-level suggestions only. Do not include the analysis, a full rewritten resume, markdown, explanations outside JSON, or any extra response fields.

Truthfulness and evidence rules:
- Return valid JSON only. Do not wrap it in markdown.
- Do not invent companies, dates, degrees, titles, certifications, metrics, tools, achievements, responsibilities, scale, or experience.
- Use a JD keyword only when the resume or extra project input supports that skill or context.
- Use metrics only when they already appear in the resume or extra project input. If no metric is present, phrase impact qualitatively.
- New content may only be grounded in the uploaded resume or the user-provided extra projects. JD wording can guide priority and phrasing, not create unsupported facts.
- Do not exaggerate beyond a believable junior/student/project resume.
- If a missing JD requirement is not supported by the resume or extra project input, do not add it as a suggestion. Mention the gap in sectionReviews only when that section also has an actionable supported suggestion.

Suggestion quality rules:
- Review every resume section, field, and bullet point.
- Give suggestions only where the change improves JD match, clarity, keyword coverage, impact, technical depth, relevance, or one-page concision.
- Prioritize JD-critical content near the top of the resume when the existing structure allows it.
- Prefer strong action verbs and STAR-style impact: action, technical method, result.
- Keep each bullet focused on one achievement, system, feature, or measurable outcome.
- Prefer concrete engineering language over generic recruiter phrases.
- Reorder skill text to match JD priority when editing a skills row.
- Remove or replace duplicated, vague, or low-relevance content when a stronger supported line exists.
- If a section or line is already strong and needs no edit, do not mention it in suggestions or sectionReviews.

App compatibility rules:
- Preserve this exact JSON contract. Do not add fields such as jdAnalysis, gapAnalysis, optimizedResume, or keyImprovements.
- Each suggestedText must be one resume-ready line only. Do not put multiple bullets, paragraphs, section blocks, or newline-separated content into one suggestion.
- Keep suggestedText compact enough to fit a one-page resume; prefer 90-150 characters for bullets.
- Every suggestion must target an existing lineId and sectionId from the resume.
- Preserve the target line kind. Do not turn company names, project names, education names, dates, locations, or role headings into achievement bullets.
- For kind=subheading, only improve the company/project/school heading text. Do not put a bullet, sentence, achievement, metric, tool list, or period-ending paragraph into suggestedText.
- For kind=projectHeading, only improve the project title. Do not put project explanation bullets into suggestedText.
- For kind=text skill rows that look like "Label: values", return the same label once followed by improved values, for example "Programming Languages: JavaScript, TypeScript, Python". Do not duplicate the old values.
- For kind=bullet, return only the bullet body text without a leading bullet symbol. Keep one concise achievement per suggestion.
- Insertions should target existing bullet lines only. Do not insert raw text around subheading/projectHeading structural lines.
- Deletions should target duplicated or weak bullet/text lines only. Do not delete subheading/projectHeading structural lines.
- For missing JD requirements, suggest insertion only if supported by existing resume text or extra project input.
- For adding a new project, target an existing bullet in the Projects section with action insert_after and use this exact single-line format:
  PROJECT | heading: Project Name | dates: Jan 2026 -- Apr 2026 | tech: React, Node.js | detail: One concise resume bullet
- Do not use the PROJECT format outside the Projects section.
- For projects, keep current projects if they fit. If not, add a project only from the extra project input.
- sectionReviews must include only sections that have actionable suggestions. Do not return "strong" reviews for unchanged sections.
- Keep reason and jdMatchReason short, specific, and useful. reason explains resume quality impact; jdMatchReason names the JD requirement or keyword match.

Return this exact JSON shape:
{
  "suggestions": [
    {
      "id": "short-unique-id",
      "targetLineId": "existing line id",
      "sectionId": "existing section id",
      "action": "replace | insert_before | insert_after | delete",
      "originalText": "existing target line text when useful",
      "suggestedText": "new or replacement resume text. Empty string only for delete.",
      "reason": "why this improves the resume",
      "jdMatchReason": "which JD need this supports"
    }
  ],
  "sectionReviews": [
    {
      "sectionId": "existing section id",
      "status": "strong | needs_changes | missing_jd_keywords | not_relevant",
      "summary": "short review of this section against the JD"
    }
  ]
}

Target company and role:
${input.companyRole}

Job description:
${input.jd}

Extra project input:
${input.project}

Resume as plain text:
${getResumeText(input.resumeSections)}

Resume sections with stable IDs:
${sectionIndex}
`.trim();
}

function parseGeminiJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  if (!cleaned) {
    throw new Error("Gemini returned an empty response.");
  }

  return JSON.parse(cleaned);
}

function filterInvalidTargets(response: SuggestionResponse, input: SuggestionRequest) {
  const validSections = new Set(input.resumeSections.map((section) => section.id));
  const lineById = new Map(
    input.resumeSections.flatMap((section) =>
      section.lines.map((line) => [line.id, line] as const),
    ),
  );
  const suggestions = response.suggestions.filter((suggestion) => {
    const targetLine = lineById.get(suggestion.targetLineId);

    if (!targetLine || !validSections.has(suggestion.sectionId)) {
      return false;
    }

    if (
      (targetLine.kind === "subheading" || targetLine.kind === "projectHeading") &&
      (suggestion.action === "delete" ||
        suggestion.action === "insert_before" ||
        suggestion.action === "insert_after" ||
        looksLikeBulletText(suggestion.suggestedText))
    ) {
      return false;
    }

    if (
      suggestion.action !== "replace" &&
      targetLine.kind !== "bullet" &&
      targetLine.kind !== "text"
    ) {
      return false;
    }

    return true;
  });
  const suggestedSections = new Set(suggestions.map((suggestion) => suggestion.sectionId));

  return {
    suggestions,
    sectionReviews: response.sectionReviews.filter((review) => {
      if (!validSections.has(review.sectionId) || review.status === "strong") {
        return false;
      }

      return suggestedSections.has(review.sectionId);
    }),
  };
}

function looksLikeBulletText(value: string) {
  const text = value.trim();

  return (
    text.length > 120 ||
    /[.!?]$/.test(text) ||
    /^(built|developed|engineered|implemented|architected|optimized|resolved|introduced|created|designed|integrated)\b/i.test(
      text,
    )
  );
}

async function generateWithRetry(ai: GoogleGenAI, prompt: string) {
  const delaysMs = [1200, 2500];
  let lastRetryableOrQuotaError: unknown;

  for (const model of GEMINI_SUGGESTION_MODELS) {
    for (let attempt = 0; attempt <= delaysMs.length; attempt += 1) {
      try {
        return await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseJsonSchema: suggestionResponseJsonSchema,
            temperature: 0.25,
          },
        });
      } catch (error) {
        if (isUnsupportedModelError(error)) {
          // Skip models unavailable for this account/version and continue fallback.
          break;
        }

        if (isQuotaGeminiError(error)) {
          // Quota can be model-specific, so try the next fallback model immediately.
          lastRetryableOrQuotaError = error;
          break;
        }

        if (!isRetryableGeminiError(error)) {
          throw error;
        }

        lastRetryableOrQuotaError = error;

        if (attempt < delaysMs.length) {
          await delay(delaysMs[attempt]);
        }
      }
    }
  }

  throw lastRetryableOrQuotaError ?? new Error("Gemini returned a retryable failure.");
}

function isRetryableGeminiError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes('"code":503') ||
    message.includes("503") ||
    message.includes("UNAVAILABLE") ||
    message.toLowerCase().includes("high demand")
  );
}

function isQuotaGeminiError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  return (
    message.includes('"code":429') ||
    message.includes("429") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    normalized.includes("quota exceeded") ||
    normalized.includes("rate limit") ||
    normalized.includes("exceeded your current quota")
  );
}

function isUnsupportedModelError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  return (
    message.includes('"code":404') ||
    message.includes("NOT_FOUND") ||
    normalized.includes("not supported for generatecontent") ||
    normalized.includes("model is not found")
  );
}

function getRetryAfterSeconds(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const retryDelayMatch = message.match(/"retryDelay"\s*:\s*"(\d+)s"/i);

  if (retryDelayMatch) {
    return Number.parseInt(retryDelayMatch[1], 10);
  }

  const retryInMatch = message.match(/retry in\s+(\d+(?:\.\d+)?)s/i);

  if (retryInMatch) {
    return Math.max(1, Math.ceil(Number.parseFloat(retryInMatch[1])));
  }

  return undefined;
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const suggestionResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["suggestions", "sectionReviews"],
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "targetLineId",
          "sectionId",
          "action",
          "suggestedText",
          "reason",
          "jdMatchReason",
        ],
        properties: {
          id: { type: "string" },
          targetLineId: { type: "string" },
          sectionId: { type: "string" },
          action: {
            type: "string",
            enum: ["replace", "insert_before", "insert_after", "delete"],
          },
          originalText: { type: "string" },
          suggestedText: { type: "string" },
          reason: { type: "string" },
          jdMatchReason: { type: "string" },
        },
      },
    },
    sectionReviews: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sectionId", "status", "summary"],
        properties: {
          sectionId: { type: "string" },
          status: {
            type: "string",
            enum: ["strong", "needs_changes", "missing_jd_keywords", "not_relevant"],
          },
          summary: { type: "string" },
        },
      },
    },
  },
};
