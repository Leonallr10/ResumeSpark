import { parse as parseLatexAst } from "@unified-latex/unified-latex-util-parse";
import type {
  ResumeDocumentModel,
  ExperienceEntry,
  EducationEntry,
  ProjectEntry,
  SkillCategory,
  ResumeExtraEntry,
  CustomSection,
  CustomSectionItem,
} from "./resume-document-model";
import { createEmptyResumeDocument, normalizeResumeDocument } from "./resume-document-model";

export interface LatexStructureAnalysis {
  model: ResumeDocumentModel;
  hasCustomStructure: boolean;
  structuralDiffs: string[];
}

/**
 * Parses raw LaTeX resume source into a structured ResumeDocumentModel.
 * Supports all 4 templates and general LaTeX resumes.
 */
export function parseLatexToDocumentModel(latex: string): ResumeDocumentModel {
  return analyzeLatexStructure(latex).model;
}

/**
 * Analyzes LaTeX source structure using unified-latex AST and extracts
 * structured ResumeDocumentModel, detecting any structural deviations.
 */
export function analyzeLatexStructure(latex: string): LatexStructureAnalysis {
  const model = createEmptyResumeDocument();
  const structuralDiffs: string[] = [];

  if (!latex || typeof latex !== "string") {
    return { model, hasCustomStructure: false, structuralDiffs };
  }

  // 1. Detect Template Type
  if (latex.includes("RTAI-TEMPLATE: classic-traditional") || latex.includes("template1-classic-traditional")) {
    model.templateId = "template-1";
  } else if (latex.includes("RTAI-TEMPLATE: modern-minimal") || latex.includes("template2-modern-minimal")) {
    model.templateId = "template-2";
  } else if (latex.includes("RTAI-TEMPLATE: technical-developer") || latex.includes("template3-technical-developer")) {
    model.templateId = "template-3";
  } else if (latex.includes("RTAI-TEMPLATE: elegant-formal") || latex.includes("template4-elegant-formal")) {
    model.templateId = "template-4";
  } else if (latex.includes("helvet") && latex.includes("\\renewcommand{\\familydefault}{\\sfdefault}")) {
    model.templateId = "template-2";
  } else if (latex.includes("\\dotfill") || latex.includes("// WORK_EXPERIENCE")) {
    model.templateId = "template-3";
  } else if (latex.includes("\\scshape") && latex.includes("\\titlerule")) {
    model.templateId = "template-4";
  } else {
    model.templateId = "template-1";
  }

  // Clean comment lines unless they hold structured info
  const cleanLines = latex
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => !l.startsWith("%") || l.includes("SUMMARY") || l.includes("Summary"));
  const fullText = cleanLines.join("\n");

  // 2. Extract Name & Contact
  parseContactHeader(latex, fullText, model);

  // 3. Extract Summary
  parseSummary(latex, model);

  // 4. Extract Sections
  parseExperience(latex, model);
  parseEducation(latex, model);
  parseSkills(latex, model);
  parseProjects(latex, model);
  parseExtras(latex, model);
  parseCustomSections(latex, model);

  // 5. AST Structural Diff Inspection
  try {
    const ast = parseLatexAst(latex);
    inspectAstStructure(ast, structuralDiffs);
  } catch (err) {
    structuralDiffs.push("LaTeX syntax failed initial AST parsing pass.");
  }

  const normalized = normalizeResumeDocument(model);
  normalized.metadata.lastModified = new Date().toISOString();
  normalized.metadata.lastFlow = "latex";

  return {
    model: normalized,
    hasCustomStructure: structuralDiffs.length > 0,
    structuralDiffs,
  };
}

/**
 * Inspects the unified-latex AST for foreign environments or custom macro declarations
 * that diverge from standard template architecture.
 */
function inspectAstStructure(node: any, diffs: string[], insideDocument = false) {
  if (!node || typeof node !== "object") return;

  let nowInsideDocument = insideDocument;
  if (node.type === "environment") {
    const envName = (node.env || "").toLowerCase();
    if (envName === "document") {
      nowInsideDocument = true;
    } else if (nowInsideDocument) {
      const standardEnvs = [
        "itemize", "enumerate", "center", "flushleft", "flushright",
        "tabular*", "tabular", "rsection", "rsubsection"
      ];
      if (envName && !standardEnvs.includes(envName)) {
        diffs.push(`Custom LaTeX environment detected: \\begin{${node.env}}`);
      }
    }
  }

  if (nowInsideDocument && node.type === "macro") {
    const macroName = node.content;
    const customDefinitionMacros = ["def", "newcommand", "renewcommand", "providecommand", "tikz", "input", "include"];
    if (customDefinitionMacros.includes(macroName)) {
      diffs.push(`Custom macro definition or external injection detected: \\${macroName}`);
    }
  }

  // Recurse children
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      inspectAstStructure(child, diffs, nowInsideDocument);
    }
  }
}

function parseContactHeader(latex: string, fullText: string, model: ResumeDocumentModel) {
  // Monospace name with underscores: ALEX_MORGAN
  const monoNameMatch = latex.match(/\\noindent\{\\ttfamily\\Large\\bfseries\s*([^}]+)\}/i);
  if (monoNameMatch) {
    model.personalInfo.fullName = monoNameMatch[1].replace(/_/g, " ").trim();
  }

  // Large bold colored name (Template 2)
  if (!model.personalInfo.fullName || model.personalInfo.fullName === "Your Name") {
    const modernNameMatch = latex.match(/\\noindent\{\\Large\\bfseries\\color\{accent\}\s*([^}]+)\}/i);
    if (modernNameMatch) {
      model.personalInfo.fullName = modernNameMatch[1].trim();
    }
  }

  // Small-caps formal name (Template 4)
  if (!model.personalInfo.fullName || model.personalInfo.fullName === "Your Name") {
    const formalNameMatch = latex.match(/\{\\Large\\scshape\\bfseries\s*([^}]+)\}/i);
    if (formalNameMatch) {
      model.personalInfo.fullName = formalNameMatch[1].trim();
    }
  }

  // Centered bold name (Template 1)
  if (!model.personalInfo.fullName || model.personalInfo.fullName === "Your Name") {
    const centerMatch = latex.match(/\\begin\{center\}([\s\S]*?)\\end\{center\}/i);
    if (centerMatch) {
      const centerContent = centerMatch[1];
      const boldNameMatch =
        centerContent.match(/\{\\Large\\textbf\{([^}]+)\}\}/i) ||
        centerContent.match(/\\textbf\{([^}]+)\}/i);
      if (boldNameMatch) {
        model.personalInfo.fullName = boldNameMatch[1].replace(/\\\[\d+pt\]/g, "").trim();
      }
    }
  }

  // Fallback name commands like \name{First Last}
  const nameCmdMatch = latex.match(/\\name\{([^}]+)\}/i);
  if (nameCmdMatch && (!model.personalInfo.fullName || model.personalInfo.fullName === "Your Name")) {
    model.personalInfo.fullName = nameCmdMatch[1].trim();
  }

  // Headline extraction (Template 2)
  const headlineMatch = latex.match(/\{\\small\s+([^\\{}]+)\}\\\\\\s*\[\d+pt\]/i);
  if (headlineMatch && !headlineMatch[1].includes("@") && !headlineMatch[1].includes("http")) {
    model.personalInfo.headline = cleanLatexText(headlineMatch[1]);
  }

  // Extract Email
  const emailMatch = latex.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    model.personalInfo.email = emailMatch[1];
  }

  // Extract Phone
  const phoneMatch = latex.match(/(\+?\d[\d\s-]{7,}\d)/);
  if (phoneMatch) {
    model.personalInfo.phone = phoneMatch[1].trim();
  }

  // Extract LinkedIn
  const linkedinMatch =
    latex.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i) ||
    latex.match(/href\{[^}]*linkedin\.com\/in\/([^}]+)\}/i);
  if (linkedinMatch) {
    model.personalInfo.linkedin = `linkedin.com/in/${linkedinMatch[1].replace(/\/$/, "")}`;
  }

  // Extract GitHub
  const githubMatch =
    latex.match(/github\.com\/([a-zA-Z0-9_-]+)/i) ||
    latex.match(/href\{[^}]*github\.com\/([^}]+)\}/i);
  if (githubMatch) {
    model.personalInfo.github = `github.com/${githubMatch[1].replace(/\/$/, "")}`;
  }

  // Extract Portfolio
  const portfolioMatch =
    latex.match(/href\{https?:\/\/([^}]+)\}\{(?:portfolio|website|[^}]+)\}/i) ||
    latex.match(/https?:\/\/([a-zA-Z0-9.-]+\.vercel\.app)/i);
  if (portfolioMatch) {
    model.personalInfo.portfolio = portfolioMatch[1].replace(/^https?:\/\//i, "");
  }

  // Extract Location
  const locationMatch =
    latex.match(/([A-Z][a-zA-Z\s]+,\s*[A-Z][a-zA-Z\s]+,\s*[A-Z][a-zA-Z\s]+)\s*\\?\s*\$?\|/i) ||
    latex.match(/([A-Z][a-zA-Z\s]+,\s*[A-Z][a-zA-Z\s]+)\s*\\?\s*\$?\|/i);
  if (locationMatch) {
    model.personalInfo.location = cleanLatexText(locationMatch[1]);
  }
}

function parseSummary(latex: string, model: ResumeDocumentModel) {
  const summaryRegex = /\\section\*?\{(?:Summary|SUMMARY)\}([\s\S]*?)(?=\\section|\%-----------|\% %-----------|\\begin\{rSection\}|\\end\{document\})/i;
  const match = latex.match(summaryRegex);
  if (match) {
    const raw = match[1]
      .replace(/\\begin\{center\}/g, "")
      .replace(/\\end\{center\}/g, "")
      .replace(/\\itemtext/g, "")
      .replace(/\\resumeItemListStart/g, "")
      .replace(/\\resumeItemListEnd/g, "")
      .replace(/\\resumeItem\{([^}]+)\}/g, "$1")
      .replace(/\\begin\{itemize\}[\s\S]*?\\item/g, "")
      .replace(/\\end\{itemize\}/g, "")
      .trim();
    if (raw) {
      model.summary = cleanLatexText(raw);
    }
  }
}

function parseExperience(latex: string, model: ResumeDocumentModel) {
  const expEntries: ExperienceEntry[] = [];

  // Match standard \resumeSubheading{Company}{Dates}{Role}{Location}
  const subHeadingRegex = /\\resumeSubheading\s*\{([^}]+)\}\s*\{([^}]+)\}\s*\{([^}]+)\}\s*\{([^}]+)\}([\s\S]*?)(?=\\resumeSubheading|\\resumeSubHeadingListEnd|\\listEnd|\\section|$)/g;
  let match: RegExpExecArray | null;

  while ((match = subHeadingRegex.exec(latex)) !== null) {
    const company = cleanLatexText(match[1]);
    const dates = cleanLatexText(match[2]);
    const role = cleanLatexText(match[3]);
    const location = cleanLatexText(match[4]);
    const body = match[5] || "";

    // Ignore if clearly under education
    const lowerRole = role.toLowerCase();
    if (lowerRole.includes("bachelor") || lowerRole.includes("b.tech") || lowerRole.includes("b.s.") || lowerRole.includes("degree")) {
      continue;
    }

    const bullets: string[] = [];
    const itemRegex = /\\resumeItem\{([\s\S]*?)\}(?=\s*\\resumeItem|\s*\\itemListEnd|\s*\\resumeItemListEnd|$)/g;
    let itemMatch: RegExpExecArray | null;
    while ((itemMatch = itemRegex.exec(body)) !== null) {
      const bulletText = cleanLatexText(itemMatch[1]);
      if (bulletText) bullets.push(bulletText);
    }

    if (company && role) {
      const dateParts = dates.split(/--|-|–/);
      expEntries.push({
        id: `exp-${expEntries.length + 1}`,
        company,
        role,
        location,
        startDate: dateParts[0]?.trim() || dates,
        endDate: dateParts[1]?.trim() || "Present",
        bullets,
        technologies: [],
      });
    }
  }

  if (expEntries.length > 0) {
    model.experience = expEntries;
  }
}

function parseEducation(latex: string, model: ResumeDocumentModel) {
  const eduEntries: EducationEntry[] = [];

  const eduSectionMatch = latex.match(/\\section\*?\{(?:Education|EDUCATION)\}([\s\S]*?)(?=\\section|\%-----------|\\end\{document\})/i);
  if (eduSectionMatch) {
    const eduText = eduSectionMatch[1];
    const subHeadingRegex = /\\resumeSubheading\s*\{([^}]+)\}\s*\{([^}]+)\}\s*\{([^}]+)\}\s*\{([^}]+)\}/g;
    let match: RegExpExecArray | null;
    while ((match = subHeadingRegex.exec(eduText)) !== null) {
      const institution = cleanLatexText(match[1]);
      const dates = cleanLatexText(match[2]);
      const degreeLine = cleanLatexText(match[3]);
      const location = cleanLatexText(match[4]);

      const dateParts = dates.split(/--|-|–/);
      eduEntries.push({
        id: `edu-${eduEntries.length + 1}`,
        institution,
        degree: degreeLine,
        field: degreeLine.split(",")[1]?.trim() || "",
        location,
        startDate: dateParts[0]?.trim() || dates,
        endDate: dateParts[1]?.trim() || "",
        bullets: [],
      });
    }
  }

  if (eduEntries.length > 0) {
    model.education = eduEntries;
  }
}

function parseSkills(latex: string, model: ResumeDocumentModel) {
  const skillCategories: SkillCategory[] = [];

  // Match Categorized Bullets: \resumeItem{\textbf{Category:} Skill1, Skill2}
  const skillsSectionMatch = latex.match(/\\section\*?\{(?:Skills|SKILLS)\}([\s\S]*?)(?=\\section|\%-----------|\\end\{document\})/i);
  if (skillsSectionMatch) {
    const secBody = skillsSectionMatch[1];

    // Check for bracket tags: \texttt{[TypeScript]} \texttt{[React]}
    const tagMatches = secBody.matchAll(/\\texttt\{\[([^\]]+)\]\}/g);
    const tags: string[] = [];
    for (const t of tagMatches) {
      tags.push(cleanLatexText(t[1]));
    }
    if (tags.length > 0) {
      skillCategories.push({
        id: "skill-tags",
        category: "Technical Skills",
        skills: tags,
      });
    } else {
      // Categorized lists
      const itemMatches = secBody.matchAll(/\\resumeItem\{\\textbf\{([^}]+)\}:?\s*([\s\S]*?)\}/g);
      for (const m of itemMatches) {
        const category = cleanLatexText(m[1]).replace(/:$/, "");
        const rawSkills = cleanLatexText(m[2]);
        const items = rawSkills.split(/,\s*/).map((s) => cleanLatexText(s)).filter(Boolean);
        skillCategories.push({
          id: `skill-${skillCategories.length + 1}`,
          category,
          skills: items,
        });
      }

      // Template 4 Centered format: \textbf{Category:} Skill1, Skill2
      if (skillCategories.length === 0) {
        const centeredMatches = secBody.matchAll(/\\textbf\{([^}]+)\}:\s*([^\\]+)/g);
        for (const cm of centeredMatches) {
          const category = cleanLatexText(cm[1]).replace(/:$/, "");
          const items = cleanLatexText(cm[2]).split(/,\s*/).map((s) => cleanLatexText(s)).filter(Boolean);
          if (items.length > 0) {
            skillCategories.push({
              id: `skill-${skillCategories.length + 1}`,
              category,
              skills: items,
            });
          }
        }
      }
    }
  }

  if (skillCategories.length > 0) {
    model.skills = skillCategories;
  }
}

function parseProjects(latex: string, model: ResumeDocumentModel) {
  const projEntries: ProjectEntry[] = [];

  const projSectionMatch = latex.match(/\\section\*?\{(?:Projects|PROJECTS)\}([\s\S]*?)(?=\\section|\%-----------|\\end\{document\})/i);
  if (projSectionMatch) {
    const projText = projSectionMatch[1];
    const projHeadingRegex = /\\resumeProjectHeading\s*\{([\s\S]*?)\}\s*\{([^}]+)\}([\s\S]*?)(?=\\resumeProjectHeading|\\listEnd|\\section|$)/g;
    let match: RegExpExecArray | null;

    while ((match = projHeadingRegex.exec(projText)) !== null) {
      const rawHeading = match[1];
      const dates = cleanLatexText(match[2]);
      const body = match[3] || "";

      let title = cleanLatexText(rawHeading);
      let subtitle = "";
      if (title.includes(" -- ")) {
        const parts = title.split(" -- ");
        title = parts[0].trim();
        subtitle = parts[1].trim();
      } else if (title.includes(" - ")) {
        const parts = title.split(" - ");
        title = parts[0].trim();
        subtitle = parts[1].trim();
      }

      const bullets: string[] = [];
      const itemRegex = /\\resumeItem\{([\s\S]*?)\}(?=\s*\\resumeItem|\s*\\itemListEnd|$)/g;
      let itemMatch: RegExpExecArray | null;
      while ((itemMatch = itemRegex.exec(body)) !== null) {
        const bulletText = cleanLatexText(itemMatch[1]);
        if (bulletText) bullets.push(bulletText);
      }

      const dateParts = dates.split(/--|-|–/);
      projEntries.push({
        id: `proj-${projEntries.length + 1}`,
        title,
        subtitle,
        startDate: dateParts[0]?.trim() || dates,
        endDate: dateParts[1]?.trim() || "",
        link: "",
        technologies: [],
        bullets,
      });
    }
  }

  if (projEntries.length > 0) {
    model.projects = projEntries;
  }
}

function parseExtras(latex: string, model: ResumeDocumentModel) {
  const extras: ResumeExtraEntry[] = [];

  // Match Achievements or Certifications section
  const extrasMatch =
    latex.match(/\\section\*?\{(?:ACHIEVEMENTS|Achievements|CERTIFICATIONS|Certifications|AWARDS|Awards|HONORS|Honors)\}([\s\S]*?)(?=\\section|\%-----------|\\end\{document\})/i);

  if (extrasMatch) {
    const headingLabelMatch = latex.match(/\\section\*?\{((?:ACHIEVEMENTS|Achievements|CERTIFICATIONS|Certifications|AWARDS|Awards|HONORS|Honors))\}/i);
    if (headingLabelMatch) {
      model.extrasLabel = headingLabelMatch[1].trim();
      model.sectionTitles.extras = model.extrasLabel;
    }

    const secBody = extrasMatch[1];
    const projHeadingRegex = /\\resumeProjectHeading\s*\{([\s\S]*?)\}\s*\{([^}]+)\}([\s\S]*?)(?=\\resumeProjectHeading|\\listEnd|\\section|$)/g;
    let match: RegExpExecArray | null;

    while ((match = projHeadingRegex.exec(secBody)) !== null) {
      const rawHeading = match[1];
      const date = cleanLatexText(match[2]);
      const body = match[3] || "";

      let title = cleanLatexText(rawHeading);
      let subtitle = "";
      if (title.includes(" -- ")) {
        const parts = title.split(" -- ");
        title = parts[0].trim();
        subtitle = parts[1].trim();
      }

      const bullets: string[] = [];
      const itemRegex = /\\resumeItem\{([\s\S]*?)\}(?=\s*\\resumeItem|\s*\\itemListEnd|$)/g;
      let itemMatch: RegExpExecArray | null;
      while ((itemMatch = itemRegex.exec(body)) !== null) {
        const bulletText = cleanLatexText(itemMatch[1]);
        if (bulletText) bullets.push(bulletText);
      }

      extras.push({
        id: `extra-${extras.length + 1}`,
        title,
        subtitle,
        date,
        description: "",
        bullets,
      });
    }
  }

  if (extras.length > 0) {
    model.extras = extras;
    model.achievements = [...extras];
  }
}

function parseCustomSections(latex: string, model: ResumeDocumentModel) {
  const customSections: CustomSection[] = [];
  const standardKeywords = [
    "SUMMARY", "WORK_EXPERIENCE", "WORK EXPERIENCE", "EXPERIENCE",
    "EDUCATION", "SKILLS", "TECHNICAL SKILLS", "PROJECTS",
    "ACHIEVEMENTS", "CERTIFICATIONS", "AWARDS", "HONORS"
  ];

  const sectionRegex = /\\section\*?\{([^}]+)\}([\s\S]*?)(?=\\section|\%-----------|\\end\{document\}|$)/g;
  let secMatch: RegExpExecArray | null;

  while ((secMatch = sectionRegex.exec(latex)) !== null) {
    const rawTitle = secMatch[1].trim();
    const cleanTitle = cleanLatexText(rawTitle);
    const upper = cleanTitle.toUpperCase().replace(/\s+/g, "_");

    if (standardKeywords.some((k) => upper.includes(k))) {
      continue;
    }

    const body = secMatch[2] || "";
    const items: CustomSectionItem[] = [];

    const itemHeadingRegex = /\\resumeProjectHeading\s*\{([\s\S]*?)\}\s*\{([^}]+)\}/g;
    let itemMatch: RegExpExecArray | null;
    while ((itemMatch = itemHeadingRegex.exec(body)) !== null) {
      items.push({
        id: `custom-item-${items.length + 1}`,
        title: cleanLatexText(itemMatch[1]),
        subtitle: "",
        date: cleanLatexText(itemMatch[2]),
        bullets: [],
      });
    }

    if (cleanTitle) {
      customSections.push({
        id: `custom-${customSections.length + 1}`,
        title: cleanTitle,
        items,
        bullets: [],
      });
    }
  }

  if (customSections.length > 0) {
    model.customSections = customSections;
  }
}

function cleanLatexText(input: string): string {
  if (!input) return "";
  return input
    .replace(/\\textbf\{([^}]+)\}/g, "$1")
    .replace(/\\textit\{([^}]+)\}/g, "$1")
    .replace(/\\texttt\{([^}]+)\}/g, "$1")
    .replace(/\\scshape\s*/g, "")
    .replace(/\\ttfamily\s*/g, "")
    .replace(/\\normalfont\s*/g, "")
    .replace(/\\small\{([^}]+)\}/g, "$1")
    .replace(/\\subtext\s*/g, "")
    .replace(/\\itemtext\s*/g, "")
    .replace(/\\fontsize\{[^}]+\}\{[^}]+\}\\selectfont\s*/g, "")
    .replace(/\\href\{[^}]*\}\{([^}]+)\}/g, "$1")
    .replace(/\\parbox\[t\]\{[^}]*\}\{([^}]+)\}/g, "$1")
    .replace(/\\raggedright/g, "")
    .replace(/\\\&/g, "&")
    .replace(/\\\$/g, "$")
    .replace(/\\%/g, "%")
    .replace(/\\#/g, "#")
    .replace(/\\_/g, "_")
    .replace(/\\vert/g, "|")
    .replace(/\\quad--\\quad/g, " -- ")
    .replace(/\\dotfill/g, "")
    .replace(/\\hfill/g, "")
    .replace(/\\\[\d+pt\]/g, "")
    .replace(/\\\\/g, " ")
    .replace(/--/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}
