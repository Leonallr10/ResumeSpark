import type { ProjectEntry } from "@/server/documents/resume-document-model";
import type { ProjectDraft } from "@/lib/latex-resume";

export interface ProjectScoreBreakdown {
  projectId: string;
  title: string;
  score: number;
  matchedMustHaves: string[];
  matchedGoodToHaves: string[];
  matchedDomainKeywords: string[];
  hasProvenMetrics: boolean;
  provenMetrics: string[];
  techStack: string[];
  bullets: string[];
}

export interface JdKeywordAnalysis {
  mustHaveSkills: string[];
  goodToHaveSkills: string[];
  domainKeywords: string[];
  actionVerbs: string[];
}

// Common tech keywords dictionary for deterministic token matching
const TECH_KEYWORDS = [
  "python", "javascript", "typescript", "react", "next.js", "node.js", "express", "django", "fastapi", "flask",
  "java", "spring boot", "c++", "c#", "go", "rust", "sql", "postgresql", "mysql", "mongodb", "redis",
  "docker", "kubernetes", "aws", "gcp", "azure", "graphql", "rest", "ci/cd", "git", "tailwind css",
  "llm", "langchain", "rag", "faiss", "pinecone", "openai", "groq", "claude", "three.js", "synctex",
  "ast", "mastra", "remotion", "playwright", "jest", "prisma", "supabase", "kafka", "microservices"
];

const DOMAIN_TERMS = [
  "scalable", "real-time", "distributed", "high-throughput", "low-latency", "microservices",
  "cloud-native", "concurrency", "vector search", "agent", "orchestration", "streaming", "pipeline",
  "caching", "ast parsing", "security", "authentication", "full-stack", "observability"
];

const ACTION_VERBS = [
  "architected", "engineered", "built", "designed", "developed", "optimized", "deployed",
  "integrated", "implemented", "spearheaded", "accelerated", "scaled", "automated"
];

/**
 * Deterministically extracts keywords from the Job Description text.
 */
export function extractJdKeywords(jdText: string): JdKeywordAnalysis {
  const normalized = jdText.toLowerCase();
  
  const mustHaveSkills: string[] = [];
  const goodToHaveSkills: string[] = [];
  const domainKeywords: string[] = [];
  const actionVerbs: string[] = [];

  // Match technical skills
  for (const tech of TECH_KEYWORDS) {
    const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    if (regex.test(normalized)) {
      // Check if near "required" / "must" or "preferred" / "bonus"
      const mustIndex = normalized.indexOf(tech);
      const surrounding = normalized.slice(Math.max(0, mustIndex - 100), Math.min(normalized.length, mustIndex + 100));
      if (surrounding.includes("plus") || surrounding.includes("nice to have") || surrounding.includes("preferred")) {
        goodToHaveSkills.push(tech);
      } else {
        mustHaveSkills.push(tech);
      }
    }
  }

  // Match domain concepts
  for (const domain of DOMAIN_TERMS) {
    const escaped = domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(normalized)) {
      domainKeywords.push(domain);
    }
  }

  // Match action verbs
  for (const verb of ACTION_VERBS) {
    if (new RegExp(`\\b${verb}\\b`, "i").test(normalized)) {
      actionVerbs.push(verb);
    }
  }

  return {
    mustHaveSkills: Array.from(new Set(mustHaveSkills)),
    goodToHaveSkills: Array.from(new Set(goodToHaveSkills)),
    domainKeywords: Array.from(new Set(domainKeywords)),
    actionVerbs: Array.from(new Set(actionVerbs)),
  };
}

/**
 * Deterministically scores and ranks candidate projects against extracted JD keywords.
 * Formula: Score = 2*(Must Haves) + 1*(Good to Haves) + 1*(Domain Keywords) + 2*(Proven Metrics)
 */
export type ScorableProject =
  | ProjectEntry
  | ProjectDraft
  | {
      id?: string;
      title?: string;
      heading?: string;
      bullets?: string[];
      explanation?: string;
      technologies?: string[];
      techStack?: string[] | string;
    };

export function scoreAndRankProjects(
  projects: ScorableProject[],
  jdAnalysis: JdKeywordAnalysis,
): ProjectScoreBreakdown[] {
  const breakdowns: ProjectScoreBreakdown[] = projects.map((proj, idx) => {
    const title = ("title" in proj && proj.title) || ("heading" in proj && proj.heading) || `Project ${idx + 1}`;
    const bullets =
      "bullets" in proj && Array.isArray(proj.bullets)
        ? proj.bullets
        : "explanation" in proj && typeof proj.explanation === "string"
          ? proj.explanation.split(/\n|;;/).filter(Boolean)
          : [];
    const techStack =
      "technologies" in proj && Array.isArray(proj.technologies)
        ? proj.technologies
        : "techStack" in proj && Array.isArray(proj.techStack)
          ? proj.techStack
          : "techStack" in proj && typeof proj.techStack === "string"
            ? proj.techStack.split(/,\s*|;\s*/).filter(Boolean)
            : [];

    const combinedProjectText = `${title} ${techStack.join(" ")} ${bullets.join(" ")}`.toLowerCase();

    // 1. Must Haves Match
    const matchedMustHaves = jdAnalysis.mustHaveSkills.filter((skill) =>
      combinedProjectText.includes(skill.toLowerCase())
    );

    // 2. Good To Haves Match
    const matchedGoodToHaves = jdAnalysis.goodToHaveSkills.filter((skill) =>
      combinedProjectText.includes(skill.toLowerCase())
    );

    // 3. Domain Keywords Match
    const matchedDomainKeywords = jdAnalysis.domainKeywords.filter((domain) =>
      combinedProjectText.includes(domain.toLowerCase())
    );

    // 4. Metrics Detection (e.g. "45%", "3-5x", "10k+", "sub-100ms", "36 hours")
    const metricsRegex = /\b\d+(?:\.\d+)?%|\b\d+x\b|\b\d+[kKmM]\b|\b\d+[\d,]*\+?\s*(?:users|queries|requests|files|players|teams|hours|ms|min|sec)\b/g;
    const matchedMetrics = Array.from(combinedProjectText.match(metricsRegex) || []);
    const hasProvenMetrics = matchedMetrics.length > 0;

    // Compute Deterministic Score
    const score =
      matchedMustHaves.length * 2 +
      matchedGoodToHaves.length * 1 +
      matchedDomainKeywords.length * 1 +
      (hasProvenMetrics ? 2 : 0);

    return {
      projectId: "id" in proj && typeof proj.id === "string" ? proj.id : `proj-ranked-${idx + 1}`,
      title,
      score,
      matchedMustHaves,
      matchedGoodToHaves,
      matchedDomainKeywords,
      hasProvenMetrics,
      provenMetrics: matchedMetrics,
      techStack,
      bullets,
    };
  });

  // Sort descending by score
  return breakdowns.sort((a, b) => b.score - a.score);
}
