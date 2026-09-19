import { Guardrails } from "@/server/guardrails";
import { executeLlmGeneration } from "@/server/llm/provider-router";
import { suggestionResponseSchema } from "@/lib/schemas";
import { getResumeText } from "@/lib/resume";
import type { ResumeSection, SuggestionResponse, LlmProvider } from "@/types/resume";
import type { ResumeDocumentModel } from "@/server/documents/resume-document-model";
import { documentModelToSections } from "@/server/documents/from-template";
import { extractJdKeywords, scoreAndRankProjects, type ProjectScoreBreakdown } from "@/server/scoring/project-scorer";
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

  // 3. DETERMINISTIC PRE-FLIGHT ANALYSIS (OUTSIDE LLM)
  // 3a. Extract JD Keywords & Requirements
  const jdAnalysis = extractJdKeywords(jd);

  // 3b. Extract Projects and Score/Rank Deterministically
  const candidateProjects = input.documentModel?.projects || extractProjectsFromSections(sections, project);
  const rankedProjects = scoreAndRankProjects(candidateProjects, jdAnalysis);

  // 3c. Extract Ground-Truth Facts Whitelist
  const groundTruthFacts = extractGroundTruthFacts(sections, project, input.documentModel);
  const factsWhitelistText = formatFactsWhitelist(groundTruthFacts);

  // 4. BUILD PROMPT WITH PRE-RANKED PROJECTS AND FACTS WHITELIST
  const prompt = buildDeterministicTailorPrompt({
    sections,
    companyRole,
    jd,
    project,
    resumeText,
    jdAnalysis,
    rankedProjects,
    factsWhitelistText,
  });

  // 5. PROVIDER ROUTER -> LLM
  const rawResponse = await executeLlmGeneration({
    provider: input.provider,
    prompt,
    apiKey: input.apiKey,
    model: input.model,
    jsonSchema: suggestionResponseJsonSchema,
  });

  // 6. OUTPUT GUARD (Zod Schema & Structure Recovery)
  const outputCheck = Guardrails.runOutputGuard(
    rawResponse,
    suggestionResponseSchema,
    ip,
  );

  if (!outputCheck.ok || !outputCheck.data) {
    throw new Error(outputCheck.error || "Output guardrail validation failed.");
  }

  // 7. FACT GUARD (Outright Rejection of Hallucinations with Audit Logging)
  const factCheck = Guardrails.runFactGuard(
    outputCheck.data.suggestions,
    resumeText,
    project || "",
    ip,
  );

  return {
    companyTone: outputCheck.data.companyTone,
    suggestions: factCheck.filteredSuggestions,
    sectionReviews: outputCheck.data.sectionReviews,
  };
}

function extractProjectsFromSections(sections: ResumeSection[], extraProjectText: string) {
  const list: { id: string; title: string; bullets: string[]; techStack: string[] }[] = [];
  const projSection = sections.find((s) => s.title.toLowerCase().includes("project"));

  if (projSection) {
    let currentProj: { id: string; title: string; bullets: string[]; techStack: string[] } | null = null;
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
        currentProj.bullets.push(line.text);
      }
    }
    if (currentProj) list.push(currentProj);
  }

  if (extraProjectText) {
    list.push({
      id: "extra-proj-1",
      title: "Extra Project Input",
      bullets: extraProjectText.split(/\n|;;/).filter(Boolean),
      techStack: [],
    });
  }

  return list;
}

function buildDeterministicTailorPrompt(params: {
  sections: ResumeSection[];
  companyRole: string;
  jd: string;
  project: string;
  resumeText: string;
  jdAnalysis: ReturnType<typeof extractJdKeywords>;
  rankedProjects: ProjectScoreBreakdown[];
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

  const rankedProjectsSummary = params.rankedProjects
    .map((p, i) => {
      return `Rank #${i + 1}: "${p.title}" (Score: ${p.score})
- Matched Must-Haves: [${p.matchedMustHaves.join(", ") || "none"}]
- Matched Good-To-Haves: [${p.matchedGoodToHaves.join(", ") || "none"}]
- Matched Domain: [${p.matchedDomainKeywords.join(", ") || "none"}]
- Proven Metrics: [${p.provenMetrics.join(", ") || "none"}]`;
    })
    .join("\n\n");

  return `
You are an expert Technical Recruiter, Senior Software Engineer, and Resume Strategist. Tailor the resume for the target company, role, and job description using the PRE-COMPUTED keyword matches and PRE-RANKED projects below.

${params.factsWhitelistText}

=== DETERMINISTIC PRE-RANKED PROJECTS (DO NOT RE-SCORE) ===
The backend code has already scored and ranked the candidate's projects against the JD keywords:
${rankedProjectsSummary}

TASK INSTRUCTIONS FOR PROJECTS:
- Write or improve STAR bullets for the Top Ranked projects above.
- Do NOT recalculate scores or alter the ranking.
- Keep the highest scoring project FIRST.
- Confine each project to 2-3 focused STAR bullets.

=== CRITICAL FACT-GUARD VS LINE-DENSITY RULE ===
- Target line density: aim for 1 full line (~90-100 chars) or 2 full lines (~185-200 chars).
- **STRICT RESOLUTION RULE:** If a bullet cannot reach target length without adding unstated facts, KEEP IT SHORT rather than pad it with fluff or fabricated numbers. Truthfulness strictly overrides line density.

=== SKILLS PRUNING & REORDERING (NO SILENT OMISSIONS) ===
- Reorder skills to lead with JD must-have skills in each category row.
- If removing or replacing an obsolete skill, output an explicit "replace" suggestion for that skill line so the user can review and accept/decline it in the Diff UI. Never omit content silently.

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
