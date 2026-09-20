import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeLatexStructure } from "@/server/documents/from-latex";
import { resumeDocumentModelSchema, normalizeResumeDocument } from "@/server/documents/resume-document-model";
import { executeLlmGeneration } from "@/server/llm/provider-router";
import type { LlmProvider } from "@/types/resume";

export const runtime = "nodejs";

const extractRequestSchema = z.object({
  latex: z.string().min(10),
  forceLlm: z.boolean().optional(),
  provider: z.enum(["gemini", "groq", "claude"]).optional(),
  apiKey: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = extractRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid extract request payload.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { latex, forceLlm, provider = "gemini", apiKey } = parsed.data;

    // 1. Run deterministic AST structure analysis
    const analysis = analyzeLatexStructure(latex);

    // If structure is clean and LLM is not forced, return immediately
    if (!analysis.hasCustomStructure && !forceLlm) {
      return NextResponse.json({
        model: analysis.model,
        method: "deterministic",
        hasCustomStructure: false,
        structuralDiffs: [],
      });
    }

    // 2. LLM Fallback Extraction for structurally modified or custom LaTeX
    const prompt = `You are an expert LaTeX and resume document parser.
Extract the following LaTeX resume source into a clean, structured JSON conforming to the ResumeDocumentModel schema.

CRITICAL INSTRUCTIONS:
1. Extract personalInfo (fullName, headline, email, phone, location, linkedin, github, portfolio).
2. Extract summary text.
3. Extract experience entries: array of { id, company, role, location, startDate, endDate, bullets: string[], technologies: string[] }.
4. Extract education entries: array of { id, institution, degree, field, location, startDate, endDate, gpa, bullets: string[] }.
5. Extract skills: array of { id, category, skills: string[] }.
6. Extract projects: array of { id, title, subtitle, startDate, endDate, link, technologies: string[], bullets: string[] }.
7. Extract extras: array of { id, title, subtitle, date, description, bullets: string[] } (used for achievements, awards, or certifications), plus extrasLabel (e.g. "Achievements", "Certifications").
8. Do NOT invent or hallucinate information. Preserve the applicant's real details and text.
9. Return ONLY a valid JSON object.

LATEX SOURCE:
\`\`\`latex
${latex}
\`\`\`
`;

    try {
      const rawLlmOutput = await executeLlmGeneration({
        provider: provider as LlmProvider,
        prompt,
        apiKey,
      });

      const cleaned = rawLlmOutput.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      const parsedJson = JSON.parse(cleaned);
      const validatedModel = normalizeResumeDocument(parsedJson);

      return NextResponse.json({
        model: validatedModel,
        method: "llm",
        hasCustomStructure: true,
        structuralDiffs: analysis.structuralDiffs,
      });
    } catch (llmError) {
      // Fallback to deterministic model if LLM fails
      return NextResponse.json({
        model: analysis.model,
        method: "deterministic-fallback",
        hasCustomStructure: true,
        structuralDiffs: analysis.structuralDiffs,
        warning: "AI extraction encountered an issue; loaded best-effort deterministic AST model.",
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to extract LaTeX model." },
      { status: 500 },
    );
  }
}
