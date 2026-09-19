import type { ResumeSection } from "@/types/resume";
import type { ResumeDocumentModel } from "@/server/documents/resume-document-model";

export interface GroundTruthFacts {
  companies: string[];
  institutions: string[];
  projectTitles: string[];
  technologies: string[];
  metrics: string[];
  dates: string[];
}

/**
 * Programmatically extracts a structured Ground-Truth Facts Whitelist
 * from candidate data before LLM execution.
 */
export function extractGroundTruthFacts(
  sections: ResumeSection[],
  extraProjectText = "",
  model?: ResumeDocumentModel,
): GroundTruthFacts {
  const companies = new Set<string>();
  const institutions = new Set<string>();
  const projectTitles = new Set<string>();
  const technologies = new Set<string>();
  const metrics = new Set<string>();
  const dates = new Set<string>();

  // If structured model is provided, extract directly
  if (model) {
    model.experience.forEach((e) => {
      if (e.company) companies.add(e.company.trim());
      if (e.startDate || e.endDate) dates.add(`${e.startDate} - ${e.endDate}`.trim());
      e.technologies?.forEach((t) => technologies.add(t.trim()));
      e.bullets.forEach((b) => extractMetricsFromText(b, metrics));
    });

    model.education.forEach((edu) => {
      if (edu.institution) institutions.add(edu.institution.trim());
      if (edu.startDate || edu.endDate) dates.add(`${edu.startDate} - ${edu.endDate}`.trim());
    });

    model.projects.forEach((p) => {
      if (p.title) projectTitles.add(p.title.trim());
      p.technologies?.forEach((t) => technologies.add(t.trim()));
      p.bullets.forEach((b) => extractMetricsFromText(b, metrics));
    });

    model.skills.forEach((s) => {
      s.skills.forEach((sk) => technologies.add(sk.trim()));
    });
  }

  // Also parse raw section lines
  for (const section of sections) {
    for (const line of section.lines) {
      if (line.kind === "subheading" && line.text) {
        if (section.title.toLowerCase().includes("edu")) {
          institutions.add(line.text.trim());
        } else {
          companies.add(line.text.trim());
        }
      }
      if (line.kind === "projectHeading" && line.text) {
        projectTitles.add(line.text.trim());
      }
      if (line.rightText) {
        dates.add(line.rightText.trim());
      }
      extractMetricsFromText(line.text, metrics);
    }
  }

  // Parse extra project text
  if (extraProjectText) {
    extractMetricsFromText(extraProjectText, metrics);
  }

  return {
    companies: Array.from(companies).filter(Boolean),
    institutions: Array.from(institutions).filter(Boolean),
    projectTitles: Array.from(projectTitles).filter(Boolean),
    technologies: Array.from(technologies).filter(Boolean),
    metrics: Array.from(metrics).filter(Boolean),
    dates: Array.from(dates).filter(Boolean),
  };
}

function extractMetricsFromText(text: string, metricsSet: Set<string>) {
  if (!text) return;
  // Match percentages, multipliers, user counts, latency stats
  const matches = text.match(/\b\d+(?:\.\d+)?%|\b\d+x\b|\b\d+[\d,]*\+?\s*(?:users|queries|requests|files|players|teams|hours|ms|min|sec)\b|\b\d+[\d,]*\b/g);
  if (matches) {
    matches.forEach((m) => {
      const clean = m.trim();
      if (clean.length > 1 && !/^(19|20)\d{2}$/.test(clean)) { // skip 4-digit years from raw metrics list
        metricsSet.add(clean);
      }
    });
  }
}

/**
 * Formats the Ground Truth Facts into a prompt-ready whitelist string.
 */
export function formatFactsWhitelist(facts: GroundTruthFacts): string {
  return `=== GROUND-TRUTH FACTS WHITELIST (STRICT CONSTRAINT) ===
You may ONLY reference facts grounded in this candidate's verified record below. Do NOT introduce any new company name, institution, ungrounded metric, or fabricated number not in this list:
- VERIFIED EMPLOYERS: ${facts.companies.length > 0 ? facts.companies.join(", ") : "None stated"}
- VERIFIED INSTITUTIONS: ${facts.institutions.length > 0 ? facts.institutions.join(", ") : "None stated"}
- VERIFIED PROJECTS: ${facts.projectTitles.length > 0 ? facts.projectTitles.join(", ") : "None stated"}
- VERIFIED TECH STACK: ${facts.technologies.length > 0 ? facts.technologies.slice(0, 40).join(", ") : "None stated"}
- VERIFIED METRICS & SCALE: ${facts.metrics.length > 0 ? facts.metrics.join(", ") : "No explicit metrics present — phrase impact qualitatively (e.g. 'improving latency', 'accelerating workflow')"}
- VERIFIED DATES: ${facts.dates.length > 0 ? facts.dates.join(", ") : "Preserve original dates"}
==========================================================`;
}
