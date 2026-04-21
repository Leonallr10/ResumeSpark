import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  suggestionRequestSchema,
  suggestionResponseSchema,
} from "@/lib/schemas";
import { getResumeText } from "@/lib/resume";

export const runtime = "nodejs";

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

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: suggestionResponseJsonSchema,
        temperature: 0.25,
      },
    });

    const parsedGemini = parseGeminiJson(result.text ?? "");
    const validatedResponse = suggestionResponseSchema.parse(parsedGemini);
    const safeResponse = filterInvalidTargets(validatedResponse, parsedRequest.data);

    return NextResponse.json(safeResponse);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? "Gemini returned an invalid response shape."
        : "Unable to generate resume suggestions.";

    return NextResponse.json(
      {
        error: message,
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
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
You are an expert resume editor. Tailor the uploaded resume to the target company, role, and job description.

Hard rules:
- Return valid JSON only. Do not wrap it in markdown.
- Do not invent companies, dates, degrees, metrics, tools, achievements, or experience.
- New content may only be based on the uploaded resume, the user-provided extra projects, or the JD wording.
- Review every resume section, field, and bullet point.
- Give suggestions only where the change improves match, clarity, keyword coverage, impact, or relevance.
- If a section or line is already strong and needs no edit, do not mention it in suggestions or sectionReviews.
- Keep the resume truthful, concise, and ATS-friendly.
- Each suggestedText must be one resume-ready line only. Do not put multiple bullets, paragraphs, or newline-separated blocks into one suggestion.
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
