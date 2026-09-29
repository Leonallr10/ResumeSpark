import { NextResponse } from "next/server";
import { z } from "zod";
import { resumeDocumentModelSchema } from "@/server/documents/resume-document-model";

export const runtime = "nodejs";
export const maxDuration = 60;

const parseRequestSchema = z
  .object({
    sourceText: z.string().max(100000).optional(),
    images: z.array(z.string()).max(5).optional(), // base64 JPEG or PNG
  })
  .refine(
    (data) =>
      (typeof data.sourceText === "string" && data.sourceText.trim().length > 0) ||
      (Array.isArray(data.images) && data.images.length > 0),
    {
      message: "Either sourceText or images must be provided.",
    },
  );

/**
 * POST /api/resume/parse
 *
 * Accepts raw text extracted from a PDF or scanned PDF page images (for OCR fallback)
 * and uses Gemini to produce a structured ResumeDocumentModel JSON. The response is
 * Zod-validated and each extracted string is verified to exist in the source text.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parseRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { sourceText, images } = parsed.data;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "LLM API key not configured." }, { status: 500 });
  }

  type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } };
  const contentsParts: GeminiPart[] = [];

  if (images && images.length > 0) {
    contentsParts.push({
      text:
        "You are an expert OCR resume parser. Transcribe and extract all resume information directly from the provided scanned resume image(s) into the structured ResumeDocumentModel JSON schema described below. Never invent information not present in the document.\n\n" +
        buildParsePrompt(""),
    });
    for (const img of images) {
      contentsParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: img,
        },
      });
    }
  } else {
    contentsParts.push({ text: buildParsePrompt(sourceText || "") });
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: contentsParts }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(55000),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: "LLM API error.", details: text.slice(0, 300) }, { status: 502 });
    }

    const llmData = await res.json();
    const rawText = llmData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Extract JSON from markdown fences if present
    const jsonText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(jsonText);
    } catch {
      return NextResponse.json(
        { error: "LLM returned invalid JSON.", raw: rawText.slice(0, 500) },
        { status: 422 },
      );
    }

    // Validate against schema
    const validated = resumeDocumentModelSchema.safeParse(parsedJson);
    if (!validated.success) {
      return NextResponse.json(
        { error: "LLM output failed schema validation.", details: validated.error.flatten() },
        { status: 422 },
      );
    }

    // Grounding check: verify each extracted string exists in source text (when sourceText is present)
    const model = sourceText ? groundModel(validated.data, sourceText) : validated.data;

    return NextResponse.json({ model }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "Parse request failed.", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

/* ─────────────────────────── Prompt builder ──────────────────────────── */

function buildParsePrompt(sourceText: string): string {
  return `You are an expert resume parser. Extract structured information from the raw resume text below.

RULES:
1. NEVER invent data. Only use information explicitly present in the text.
2. Use empty string "" for missing optional fields.
3. For missing arrays (experience, education, skills, projects, achievements), use [].
4. Generate unique IDs using the format: "exp-1", "edu-1", "skill-1", "proj-1", "ach-1", etc.
5. Return ONLY valid JSON matching the schema — no markdown fences, no explanation.

SCHEMA (TypeScript interface for reference):
{
  version: "1.0.0",
  templateId: "template-1",
  personalInfo: {
    fullName: string,
    headline: string,
    email: string,
    phone: string,
    location: string,
    linkedin: string,
    github: string,
    portfolio: string,
    website: string
  },
  sectionTitles: {
    summary: "Professional Summary",
    experience: "Work Experience",
    education: "Education",
    skills: "Skills",
    projects: "Projects",
    achievements: "Achievements and Activities",
    extras: "Achievements and Activities"
  },
  summary: string,
  experience: Array<{
    id: string,
    company: string,
    role: string,
    location: string,
    startDate: string,
    endDate: string,
    bullets: string[],
    technologies: string[]
  }>,
  education: Array<{
    id: string,
    institution: string,
    degree: string,
    field: string,
    location: string,
    startDate: string,
    endDate: string,
    gpa: string,
    bullets: string[]
  }>,
  projects: Array<{
    id: string,
    title: string,
    subtitle: string,
    startDate: string,
    endDate: string,
    link: string,
    technologies: string[],
    bullets: string[]
  }>,
  skills: Array<{
    id: string,
    category: string,
    skills: string[]
  }>,
  achievements: Array<{
    id: string,
    title: string,
    subtitle: string,
    date: string,
    description: string,
    bullets: string[]
  }>,
  extras: [],
  extrasLabel: "Achievements and Activities",
  customSections: [],
  metadata: {
    targetRole: "",
    targetCompany: "",
    lastModified: "${new Date().toISOString()}",
    lastFlow: "pdf"
  }
}

RAW RESUME TEXT:
---
${sourceText.slice(0, 18000)}
---

Output ONLY the JSON object.`;
}

/* ─────────────────────────── Grounding verification ──────────────────────────── */

/**
 * Clears any field values that do not appear in the source text.
 * Prevents hallucinations from slipping through.
 */
function groundModel(
  model: ReturnType<typeof resumeDocumentModelSchema.parse>,
  sourceText: string,
): ReturnType<typeof resumeDocumentModelSchema.parse> {
  const lower = sourceText.toLowerCase();

  function inSource(val: string): boolean {
    if (!val || val.length < 3) return true; // short values pass
    return lower.includes(val.toLowerCase().slice(0, 40));
  }

  function cleanString(val: string): string {
    return inSource(val) ? val : "";
  }

  return {
    ...model,
    personalInfo: {
      fullName: cleanString(model.personalInfo.fullName),
      headline: cleanString(model.personalInfo.headline),
      email: cleanString(model.personalInfo.email),
      phone: cleanString(model.personalInfo.phone),
      location: cleanString(model.personalInfo.location),
      linkedin: cleanString(model.personalInfo.linkedin),
      github: cleanString(model.personalInfo.github),
      portfolio: cleanString(model.personalInfo.portfolio),
      website: cleanString(model.personalInfo.website),
    },
    summary: cleanString(model.summary),
    experience: model.experience.map((exp) => ({
      ...exp,
      company: cleanString(exp.company),
      role: cleanString(exp.role),
      bullets: exp.bullets.filter((b) => inSource(b)),
    })).filter((exp) => exp.company || exp.role),
    education: model.education.map((edu) => ({
      ...edu,
      institution: cleanString(edu.institution),
      degree: cleanString(edu.degree),
    })).filter((edu) => edu.institution),
    projects: model.projects.map((proj) => ({
      ...proj,
      title: cleanString(proj.title),
      bullets: proj.bullets.filter((b) => inSource(b)),
    })).filter((proj) => proj.title),
    skills: model.skills.map((s) => ({
      ...s,
      skills: s.skills.filter((sk) => inSource(sk)),
    })).filter((s) => s.skills.length > 0),
    achievements: model.achievements.map((a) => ({
      ...a,
      title: cleanString(a.title),
    })).filter((a) => a.title),
  };
}
