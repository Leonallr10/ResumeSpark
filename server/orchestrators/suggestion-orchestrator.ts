import { Guardrails } from "@/server/guardrails";
import { executeLlmGeneration } from "@/server/llm/provider-router";
import { suggestionResponseSchema, type ProjectRankingItem } from "@/lib/schemas";
import { getResumeText } from "@/lib/resume";
import type { ResumeSection, SuggestionResponse, LlmProvider } from "@/types/resume";
import type { ResumeDocumentModel } from "@/server/documents/resume-document-model";
import { documentModelToSections } from "@/server/documents/from-template";
import {
  rankProjectsWithLlm,
  toLightweightProjects,
  type RawCandidateProject,
} from "./project-ranker";
import { extractGroundTruthFacts, formatFactsWhitelist } from "@/server/guardrails/facts-extractor";

export interface SuggestionOrchestratorInput {
  resumeSections?: ResumeSection[];
  documentModel?: ResumeDocumentModel;
  companyRole: string;
  jd: string;
  project?: string;
  provider: LlmProvider;
  model?: string;
  apiKey?: string;
  ipOrUser?: string;
}

export async function orchestrateResumeSuggestions(
  input: SuggestionOrchestratorInput,
): Promise<SuggestionResponse> {
  const ip = input.ipOrUser || "anonymous";

  // 1. Resolve sections and document model
  const sections: ResumeSection[] = input.resumeSections?.length
    ? input.resumeSections
    : input.documentModel
      ? documentModelToSections(input.documentModel)
      : [];

  if (sections.length === 0) {
    throw new Error("No resume sections provided for suggestion analysis.");
  }

  const resumeText = getResumeText(sections);

  // 2. INPUT GUARD (Sanitization & Injection Blocking)
  const inputCheck = Guardrails.runInputGuard(
    {
      companyRole: input.companyRole,
      jd: input.jd,
      project: input.project,
      resumeText,
    },
    ip,
  );

  if (!inputCheck.ok || !inputCheck.sanitizedInput) {
    throw new Error(inputCheck.error || "Input guardrail check failed.");
  }

  const { companyRole, jd, project } = inputCheck.sanitizedInput;

  // 3. CALL #1: PROJECT RANKING CALL (Separation of Concerns)
  // Input: JD (full text) + Projects list (lightweight: title, techStack, 1-line summary only — NO bullets)
  // Output: ranked projectIds with relevance scores (0-100), matchedSkills, and reasons
  const candidateProjects =
    input.documentModel?.projects || extractProjectsFromSections(sections, project);

  let rankedProjects: ProjectRankingItem[] = [];
  if (candidateProjects.length > 0) {
    const lightweightProjects = toLightweightProjects(candidateProjects);
    rankedProjects = await rankProjectsWithLlm({
      jd,
      projects: lightweightProjects,
      provider: input.provider,
      model: input.model,
      apiKey: input.apiKey,
    });
  }

  // 4. EXTRACT GROUND-TRUTH FACTS WHITELIST (Restricted to Resume Data)
  const groundTruthFacts = extractGroundTruthFacts(sections, "", input.documentModel);
  const factsWhitelistText = formatFactsWhitelist(groundTruthFacts);

  // 5. CALL #2: RESUME TAILORING CALL
  // Input: ONLY Job Description (full text) + Candidate Resume data (sections, lines, stable IDs)
  // Note: Extra project full bullet data is strictly omitted.
  const prompt = buildResumeTailorPrompt({
    sections,
    companyRole,
    jd,
    factsWhitelistText,
  });

  // 6. PROVIDER ROUTER -> LLM (Call #2 Execution)
  const rawResponse = await executeLlmGeneration({
    provider: input.provider,
    prompt,
    apiKey: input.apiKey,
    model: input.model,
    jsonSchema: suggestionResponseJsonSchema,
  });

  // 7. OUTPUT GUARD (Zod Schema & Structure Recovery)
  const outputCheck = Guardrails.runOutputGuard(
    rawResponse,
    suggestionResponseSchema,
    ip,
  );

  if (!outputCheck.ok || !outputCheck.data) {
    throw new Error(outputCheck.error || "Output guardrail validation failed.");
  }

  // 8. FACT GUARD (Outright Rejection of Hallucinations with Audit Logging)
  const factCheck = Guardrails.runFactGuard(
    outputCheck.data.suggestions,
    resumeText,
    "",
    ip,
  );

  return {
    companyTone: outputCheck.data.companyTone,
    suggestions: factCheck.filteredSuggestions,
    sectionReviews: outputCheck.data.sectionReviews,
    rankedProjects,
  };
}

function extractProjectsFromSections(sections: ResumeSection[], extraProjectText: string): RawCandidateProject[] {
  const list: RawCandidateProject[] = [];
  const projSection = sections.find((s) => s.title.toLowerCase().includes("project"));

  if (projSection) {
    let currentProj: RawCandidateProject | null = null;
    for (const line of projSection.lines) {
      if (line.kind === "projectHeading" || line.kind === "subheading") {
        if (currentProj) list.push(currentProj);
        currentProj = {
          id: line.id,
          title: line.text,
          bullets: [],
          techStack: line.secondaryText ? [line.secondaryText] : [],
        };
      } else if (line.kind === "bullet" && currentProj) {
        currentProj.bullets = currentProj.bullets || [];
        currentProj.bullets.push(line.text);
      }
    }
    if (currentProj) list.push(currentProj);
  }

  if (extraProjectText && extraProjectText.trim()) {
    // Check if extraProjectText is valid JSON array or object
    try {
      const parsed = JSON.parse(extraProjectText);
      const rawList = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.projects)
          ? parsed.projects
          : Array.isArray(parsed.resume_projects)
            ? parsed.resume_projects
            : null;

      if (rawList) {
        (rawList as Record<string, unknown>[]).forEach((item, i) => {
          list.push({
            id: (item.id as string) || `extra-proj-${i + 1}`,
            title: (item.title as string) || (item.heading as string) || (item.name as string) || `Project ${i + 1}`,
            techStack: (item.techStack as string | string[]) || (item.technologies as string[]) || [],
            explanation: (item.explanation as string) || (item.description as string) || "",
            bullets: Array.isArray(item.bullets) ? (item.bullets as string[]) : [],
          });
        });
        return list;
      }
    } catch {
      // Not JSON, continue with line parsing
    }

    list.push({
      id: "extra-proj-1",
      title: "Candidate Project",
      explanation: extraProjectText,
      bullets: extraProjectText.split(/\n|;;/).filter(Boolean),
      techStack: [],
    });
  }

  return list;
}

function buildResumeTailorPrompt(params: {
  sections: ResumeSection[];
  companyRole: string;
  jd: string;
  factsWhitelistText: string;
}) {
  const sectionIndex = params.sections
    .map((section) => {
      const lines = section.lines
        .map((line) => {
          const metadata = [
            `lineId=${line.id}`,
            `kind=${line.kind ?? "text"}`,
            line.rightText ? `rightText=${line.rightText}` : "",
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
You are an expert Technical Recruiter, Senior Software Engineer, and Resume Strategist. Tailor the candidate's resume for the target company, role, and job description.

${params.factsWhitelistText}

=== CRITICAL FACT-GUARD VS LINE-DENSITY RULE ===
- Target line density: aim for 1 full line (~90-100 chars) or 2 full lines (~185-200 chars).
- **STRICT RESOLUTION RULE:** If a bullet cannot reach target length without adding unstated facts, KEEP IT SHORT rather than pad it with fluff or fabricated numbers. Truthfulness strictly overrides line density.
- Do NOT invent companies, dates, degrees, titles, metrics, or technologies not grounded in the resume.

=== TAILORING INSTRUCTIONS ===
- Tailor existing resume bullets and sections directly against the provided Job Description.
- Confine project and experience entries to 2-3 focused STAR bullets (Situation, Task, Action, Result).
- Reorder and prioritize skills and bullets to lead with JD must-have skills and technologies.
- If removing or replacing an obsolete skill or bullet, output an explicit "replace" suggestion for that line so the user can review and accept/decline it in the Diff UI. Never omit content silently.

=== CLASSIFICATION ENUMS ===
- companyTone MUST be one of: "startup" | "faang" | "ai_lab" | "enterprise" | "unknown"

Target company and role:
${params.companyRole}

Job description:
${params.jd}

Resume sections with stable IDs:
${sectionIndex}

Return valid JSON adhering to this exact shape:
{
  "companyTone": "startup" | "faang" | "ai_lab" | "enterprise" | "unknown",
  "suggestions": [
    {
      "id": "short-unique-id",
      "targetLineId": "existing line id",
      "sectionId": "existing section id",
      "action": "replace | insert_before | insert_after | delete",
      "originalText": "existing target line text when useful",
      "suggestedText": "new or replacement resume text. Plain text without LaTeX tags.",
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
`.trim();
}

const suggestionResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["companyTone", "suggestions", "sectionReviews"],
  properties: {
    companyTone: {
      type: "string",
      enum: ["startup", "faang", "ai_lab", "enterprise", "unknown"],
    },
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "targetLineId", "sectionId", "action", "suggestedText", "reason", "jdMatchReason"],
        properties: {
          id: { type: "string" },
          targetLineId: { type: "string" },
          sectionId: { type: "string" },
          action: { type: "string", enum: ["replace", "insert_before", "insert_after", "delete"] },
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
          status: { type: "string", enum: ["strong", "needs_changes", "missing_jd_keywords", "not_relevant"] },
          summary: { type: "string" },
        },
      },
    },
  },
};
