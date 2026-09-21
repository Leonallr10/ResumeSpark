import { executeLlmGeneration } from "@/server/llm/provider-router";
import { projectRankingResponseSchema, type ProjectRankingItem } from "@/lib/schemas";
import type { LlmProvider } from "@/types/resume";
import { extractJdKeywords, scoreAndRankProjects } from "@/server/scoring/project-scorer";

export interface LightweightProject {
  projectId: string;
  title: string;
  techStack: string | string[];
  summary: string;
}

export interface RawCandidateProject {
  id?: string;
  projectId?: string;
  title?: string;
  heading?: string;
  techStack?: string | string[];
  explanation?: string;
  description?: string;
  subtitle?: string;
  bullets?: string[];
  technologies?: string[];
}

export const PROJECT_RANKER_SYSTEM_PROMPT = `You are a resume-project relevance ranker. You will be given a job description
and a list of a candidate's existing projects (title, tech stack, and a short
one-line summary only — not full bullet points). Your only task is to rank
these projects by relevance to the job description.

Rules:
- Do not invent, modify, or infer any project details beyond what is given.
- Do not write resume bullets or rewrite any content — ranking only.
- Base relevance on: overlap between the job description's required/preferred
  skills and the project's tech stack, overlap in domain/problem type, and
  recency if provided.
- If a project has no meaningful overlap with the JD, still include it, but
  give it a low score rather than omitting it.
- Output ONLY valid JSON. No prose, no markdown fences, no explanation
  outside the JSON structure.

Output schema:
{
  "rankedProjects": [
    {
      "projectId": "string, exactly as given in input",
      "relevanceScore": "integer 0-100",
      "matchedSkills": ["array of skills/keywords from the JD that this project matches"],
      "reason": "one short phrase, under 12 words, e.g. 'Strong match on LLM orchestration and API design'"
    }
  ]
}
Sort rankedProjects descending by relevanceScore.`;

export const projectRankingJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["rankedProjects"],
  properties: {
    rankedProjects: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["projectId", "relevanceScore", "matchedSkills", "reason"],
        properties: {
          projectId: { type: "string" },
          relevanceScore: { type: "integer" },
          matchedSkills: { type: "array", items: { type: "string" } },
          reason: { type: "string" },
        },
      },
    },
  },
};

/**
 * Extracts a strictly single-line summary from raw text/bullets without bullet points.
 */
export function extractOneLineSummary(project: RawCandidateProject): string {
  if (project.subtitle?.trim()) {
    return project.subtitle.trim().replace(/\s+/g, " ");
  }
  if (project.description?.trim()) {
    const firstSentence = project.description.trim().split(/\n|\. |\? |! /)[0] || "";
    return firstSentence.replace(/^[-*•\d.]+\s*/, "").replace(/\s+/g, " ").trim();
  }
  if (project.explanation?.trim()) {
    const lines = project.explanation
      .split(/\n|;;/)
      .map((l) => l.trim())
      .filter(Boolean);
    const firstLine = lines[0] || "";
    const clean = firstLine.replace(/^[-*•\d.]+\s*/, "").trim();
    return clean.replace(/\s+/g, " ");
  }
  if (project.bullets && project.bullets.length > 0) {
    const first = project.bullets[0].trim();
    const clean = first.replace(/^[-*•\d.]+\s*/, "").trim();
    return clean.replace(/\s+/g, " ");
  }
  return project.title || project.heading || "Software project";
}

/**
 * Transforms any raw project inputs into the lightweight representation required for Call #1:
 * Title, techStack, and one-line summary only — NO bullets.
 */
export function toLightweightProjects(rawProjects: RawCandidateProject[]): LightweightProject[] {
  return rawProjects.map((p, index) => {
    const projectId = p.projectId || p.id || `proj-${index + 1}`;
    const title = p.title || p.heading || `Project ${index + 1}`;
    const techStack = p.techStack || p.technologies || [];
    const summary = extractOneLineSummary(p);

    return {
      projectId,
      title,
      techStack,
      summary,
    };
  });
}

/**
 * Call #1: Project Ranking Call.
 * Given JD text and a lightweight projects list, calls the LLM with the ranker prompt
 * and returns ranked project IDs sorted by relevanceScore descending.
 */
export async function rankProjectsWithLlm(params: {
  jd: string;
  projects: LightweightProject[];
  provider: LlmProvider;
  model?: string;
  apiKey?: string;
}): Promise<ProjectRankingItem[]> {
  const { jd, projects, provider, model, apiKey } = params;

  if (!projects || projects.length === 0) {
    return [];
  }

  const projectsJsonText = JSON.stringify(projects, null, 2);

  const userPrompt = `Job Description:
"""
${jd.trim()}
"""

Candidate's Projects:
${projectsJsonText}`;

  try {
    const rawResponse = await executeLlmGeneration({
      provider,
      prompt: userPrompt,
      apiKey,
      model,
      systemInstruction: PROJECT_RANKER_SYSTEM_PROMPT,
      jsonSchema: projectRankingJsonSchema,
    });

    let cleaned = rawResponse.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```\s*$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/i, "").replace(/```\s*$/, "");
    }

    const parsed = JSON.parse(cleaned);
    const validated = projectRankingResponseSchema.safeParse(parsed);

    if (validated.success && validated.data.rankedProjects.length > 0) {
      // Sort descending by relevance score
      return [...validated.data.rankedProjects].sort(
        (a, b) => b.relevanceScore - a.relevanceScore,
      );
    }
  } catch (err) {
    console.warn("LLM project ranker call failed, falling back to deterministic scorer:", err);
  }

  // Resilient fallback: use deterministic keyword scorer
  return fallbackDeterministicRanking(jd, projects);
}

/**
 * Fallback deterministic ranking if the LLM call fails or returns invalid schema.
 */
export function fallbackDeterministicRanking(
  jd: string,
  projects: LightweightProject[],
): ProjectRankingItem[] {
  const jdAnalysis = extractJdKeywords(jd);

  const candidateProjects = projects.map((p) => ({
    id: p.projectId,
    title: p.title,
    techStack: Array.isArray(p.techStack) ? p.techStack : [p.techStack],
    bullets: [p.summary],
  }));

  const scored = scoreAndRankProjects(candidateProjects, jdAnalysis);

  return scored.map((s) => ({
    projectId: s.projectId,
    relevanceScore: Math.min(100, Math.round((s.score / 15) * 100)),
    matchedSkills: [...s.matchedMustHaves, ...s.matchedGoodToHaves],
    reason: s.matchedMustHaves.length > 0
      ? `Matches ${s.matchedMustHaves.slice(0, 3).join(", ")}`
      : "General technical alignment",
  })).sort((a, b) => b.relevanceScore - a.relevanceScore);
}
