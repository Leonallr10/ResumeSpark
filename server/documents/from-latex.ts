import type {
  ResumeDocumentModel,
  ExperienceEntry,
  EducationEntry,
  ProjectEntry,
  SkillCategory,
  AchievementEntry,
} from "./resume-document-model";
import { createEmptyResumeDocument } from "./resume-document-model";

/**
 * Parses raw LaTeX resume source into a structured ResumeDocumentModel.
 * Supports template1.tex, template2.tex (resume.cls), and general modern LaTeX resumes.
 */
export function parseLatexToDocumentModel(latex: string): ResumeDocumentModel {
  const model = createEmptyResumeDocument();
  if (!latex || typeof latex !== "string") return model;

  // Clean comment lines unless they hold structured info
  const cleanLines = latex
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => !l.startsWith("%") || l.includes("SUMMARY") || l.includes("Summary"));

  const fullText = cleanLines.join("\n");

  // 1. Detect Template Type
  if (latex.includes("resume.cls") || latex.includes("\\begin{rSection}")) {
    model.templateId = "template-2";
  } else {
    model.templateId = "template-1";
  }

  // 2. Extract Name & Contact
  parseContactHeader(latex, fullText, model);

  // 3. Extract Summary
  parseSummary(latex, model);

  // 4. Extract Sections
  parseExperience(latex, model);
  parseEducation(latex, model);
  parseProjects(latex, model);
  parseSkills(latex, model);
  parseAchievements(latex, model);

  model.metadata.lastModified = new Date().toISOString();
  model.metadata.lastFlow = "latex";

  return model;
}

function parseContactHeader(latex: string, fullText: string, model: ResumeDocumentModel) {
  // Try Template 2 format: \name{First Last} and \address{...}
  const nameCmdMatch = latex.match(/\\name\{([^}]+)\}/i);
  if (nameCmdMatch) {
    model.personalInfo.fullName = nameCmdMatch[1].trim();
  } else {
    // Template 1 format: \begin{center} ... \textbf{NAME} ... \end{center}
    const centerMatch = latex.match(/\\begin\{center\}([\s\S]*?)\\end\{center\}/i);
    if (centerMatch) {
      const centerContent = centerMatch[1];
      const boldNameMatch = centerContent.match(/\\textbf\{([^}]+)\}/i) || centerContent.match(/\\namesize\s*\\textbf\{([^}]+)\}/i);
      if (boldNameMatch) {
        model.personalInfo.fullName = boldNameMatch[1].replace(/\\\[\d+pt\]/g, "").trim();
      }
    }
  }

  // Fallback name lookup
  if (!model.personalInfo.fullName || model.personalInfo.fullName === "Your Name") {
    const fallbackName = latex.match(/\\textbf\{\\Huge\s*([^}]+)\}/i) || latex.match(/\\Huge\s*\\textbf\{([^}]+)\}/i);
    if (fallbackName) {
      model.personalInfo.fullName = fallbackName[1].trim();
    }
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
  const linkedinMatch = latex.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i) || latex.match(/href\{[^}]*linkedin\.com\/in\/([^}]+)\}/i);
  if (linkedinMatch) {
    model.personalInfo.linkedin = `linkedin.com/in/${linkedinMatch[1].replace(/\/$/, "")}`;
  }

  // Extract GitHub
  const githubMatch = latex.match(/github\.com\/([a-zA-Z0-9_-]+)/i) || latex.match(/href\{[^}]*github\.com\/([^}]+)\}/i);
  if (githubMatch) {
    model.personalInfo.github = `github.com/${githubMatch[1].replace(/\/$/, "")}`;
  }

  // Extract Portfolio / Website
  const portfolioMatch = latex.match(/href\{https?:\/\/([^}]+)\}\{(?:portfolio|website)\}/i) || latex.match(/https?:\/\/([a-zA-Z0-9.-]+\.vercel\.app)/i);
  if (portfolioMatch) {
    model.personalInfo.portfolio = portfolioMatch[1];
  }

  // Extract Location (e.g. "Bengaluru, Karnataka, India")
  const locationMatch = latex.match(/{\\fontsize\{9\}\{11\}\\selectfont\s*([^}]+)\}/i) || latex.match(/\\address\{[\s\S]*?\\\\([^\\}]+)\}/i);
  if (locationMatch && !locationMatch[1].includes("@") && !locationMatch[1].includes("http")) {
    model.personalInfo.location = locationMatch[1].replace(/\\\[\d+pt\]/g, "").trim();
  }
}

function parseSummary(latex: string, model: ResumeDocumentModel) {
  const summaryRegex = /\\section\*?\{SUMMARY\}[\s\S]*?(?=\\section|\%-----------|\% %-----------|\\begin\{rSection\}|\\end\{document\})/i;
  const match = latex.match(summaryRegex);
  if (match) {
    const raw = match[0]
      .replace(/\\section\*?\{SUMMARY\}/i, "")
      .replace(/\\itemtext/g, "")
      .replace(/\\resumeItemListStart/g, "")
      .replace(/\\resumeItemListEnd/g, "")
      .replace(/\\resumeItem\{([^}]+)\}/g, "$1")
      .replace(/\\begin\{itemize\}[\s\S]*?\\item/g, "")
      .replace(/\\end\{itemize\}/g, "")
      .replace(/%/g, "")
      .trim();
    if (raw) {
      model.summary = cleanLatexText(raw);
    }
  }
}

function parseExperience(latex: string, model: ResumeDocumentModel) {
  const expEntries: ExperienceEntry[] = [];

  // Template 1 Pattern: \resumeSubheading{Company}{Dates}{Role}{Location} \resumeItemListStart \resumeItem{...} \resumeItemListEnd
  const subHeadingRegex = /\\resumeSubheading\s*\{([^}]+)\}\s*\{([^}]+)\}\s*\{([^}]+)\}\s*\{([^}]+)\}([\s\S]*?)(?=\\resumeSubheading|\\resumeSubHeadingListEnd|\\section|$)/g;
  let match: RegExpExecArray | null;

  while ((match = subHeadingRegex.exec(latex)) !== null) {
    const company = cleanLatexText(match[1]);
    const dates = cleanLatexText(match[2]);
    const role = cleanLatexText(match[3]);
    const location = cleanLatexText(match[4]);
    const body = match[5] || "";

    const bullets: string[] = [];
    const itemRegex = /\\resumeItem\{([\s\S]*?)\}(?=\s*\\resumeItem|\s*\\resumeItemListEnd|$)/g;
    let itemMatch: RegExpExecArray | null;
    while ((itemMatch = itemRegex.exec(body)) !== null) {
      const bulletText = cleanLatexText(itemMatch[1]);
      if (bulletText) bullets.push(bulletText);
    }

    // Only add if it's not under Education section
    if (company && role && !role.toLowerCase().includes("bachelor") && !role.toLowerCase().includes("degree") && !role.toLowerCase().includes("master")) {
      expEntries.push({
        id: `exp-${expEntries.length + 1}`,
        company,
        role,
        location,
        startDate: dates.split(/--|-|–/)[0]?.trim() || dates,
        endDate: dates.split(/--|-|–/)[1]?.trim() || "Present",
        bullets,
        technologies: [],
      });
    }
  }

  // Template 2 Pattern: \begin{rSubsection}{Company}{Dates}{Role}{Location} \item ... \end{rSubsection}
  if (expEntries.length === 0) {
    const rSubsectionRegex = /\\begin\{rSubsection\}\{([^}]+)\}\{([^}]+)\}\{([^}]+)\}\{([^}]*)\}([\s\S]*?)\\end\{rSubsection\}/g;
    let rMatch: RegExpExecArray | null;
    while ((rMatch = rSubsectionRegex.exec(latex)) !== null) {
      const company = cleanLatexText(rMatch[1]);
      const dates = cleanLatexText(rMatch[2]);
      const role = cleanLatexText(rMatch[3]);
      const location = cleanLatexText(rMatch[4]);
      const body = rMatch[5] || "";

      const rawItems = body.split(/\\item\s+/).filter(Boolean);
      const bullets = rawItems.map((item) => cleanLatexText(item)).filter((b) => b.length > 5);

      if (company && !role.toLowerCase().includes("b.asc") && !role.toLowerCase().includes("bachelor") && !role.toLowerCase().includes("degree")) {
        expEntries.push({
          id: `exp-${expEntries.length + 1}`,
          company,
          role,
          location,
          startDate: dates.split(/--|-|–/)[0]?.trim() || dates,
          endDate: dates.split(/--|-|–/)[1]?.trim() || "Present",
          bullets,
          technologies: [],
        });
      }
    }
  }

  if (expEntries.length > 0) {
    model.experience = expEntries;
  }
}

function parseEducation(latex: string, model: ResumeDocumentModel) {
  const eduEntries: EducationEntry[] = [];

  // Template 1 & general \resumeSubheading under Education
  const eduSectionMatch = latex.match(/\\section\*?\{EDUCATION\}[\s\S]*?(?=\\section|\%-----------|\\end\{document\})/i);
  if (eduSectionMatch) {
    const eduText = eduSectionMatch[0];
    const subHeadingRegex = /\\resumeSubheading\s*\{([^}]+)\}\s*\{([^}]+)\}\s*\{([^}]+)\}\s*\{([^}]+)\}/g;
    let match: RegExpExecArray | null;
    while ((match = subHeadingRegex.exec(eduText)) !== null) {
      const institution = cleanLatexText(match[1]);
      const dates = cleanLatexText(match[2]);
      const degreeLine = cleanLatexText(match[3]);
      const location = cleanLatexText(match[4]);

      eduEntries.push({
        id: `edu-${eduEntries.length + 1}`,
        institution,
        degree: degreeLine,
        field: degreeLine.split(",")[1]?.trim() || "",
        location,
        startDate: dates.split(/--|-|–/)[0]?.trim() || dates,
        endDate: dates.split(/--|-|–/)[1]?.trim() || "",
        bullets: [],
      });
    }
  }

  // Template 2 \begin{rSection}{Education}
  if (eduEntries.length === 0) {
    const rEduMatch = latex.match(/\\begin\{rSection\}\{Education\}([\s\S]*?)\\end\{rSection\}/i);
    if (rEduMatch) {
      const rText = rEduMatch[1];
      const rSubsectionRegex = /\\begin\{rSubsection\}\{([^}]+)\}\{([^}]+)\}\{([^}]+)\}\{([^}]*)\}/g;
      let rMatch: RegExpExecArray | null;
      while ((rMatch = rSubsectionRegex.exec(rText)) !== null) {
        eduEntries.push({
          id: `edu-${eduEntries.length + 1}`,
          institution: cleanLatexText(rMatch[1]),
          degree: cleanLatexText(rMatch[3]),
          field: "",
          location: cleanLatexText(rMatch[4]),
          startDate: rMatch[2].split(/--|-|–/)[0]?.trim() || rMatch[2],
          endDate: rMatch[2].split(/--|-|–/)[1]?.trim() || "",
          bullets: [],
        });
      }
    }
  }

  if (eduEntries.length > 0) {
    model.education = eduEntries;
  }
}

function parseProjects(latex: string, model: ResumeDocumentModel) {
  const projEntries: ProjectEntry[] = [];

  // Template 1 Pattern: \resumeProjectHeading{\textbf{Project Name -- Description}}{Dates}
  const projHeadingRegex = /\\resumeProjectHeading\s*\{([\s\S]*?)\}\s*\{([^}]+)\}([\s\S]*?)(?=\\resumeProjectHeading|\\resumeSubHeadingListEnd|\\section|$)/g;
  let match: RegExpExecArray | null;

  while ((match = projHeadingRegex.exec(latex)) !== null) {
    const rawHeading = match[1];
    const dates = cleanLatexText(match[2]);
    const body = match[3] || "";

    const titleClean = cleanLatexText(rawHeading);
    const bullets: string[] = [];
    const itemRegex = /\\resumeItem\{([\s\S]*?)\}(?=\s*\\resumeItem|\s*\\resumeItemListEnd|$)/g;
    let itemMatch: RegExpExecArray | null;
    while ((itemMatch = itemRegex.exec(body)) !== null) {
      const bulletText = cleanLatexText(itemMatch[1]);
      if (bulletText) bullets.push(bulletText);
    }

    projEntries.push({
      id: `proj-${projEntries.length + 1}`,
      title: titleClean,
      subtitle: "",
      startDate: dates.split(/--|-|–/)[0]?.trim() || dates,
      endDate: dates.split(/--|-|–/)[1]?.trim() || "",
      link: "",
      technologies: [],
      bullets,
    });
  }

  // Template 2 Pattern: \begin{rSection}{Projects} -> \begin{rSubsection}{Title}{Dates}{Role}{Location}
  if (projEntries.length === 0) {
    const projSectionMatch = latex.match(/\\begin\{rSection\}\{Projects\}([\s\S]*?)\\end\{rSection\}/i);
    if (projSectionMatch) {
      const rSubsectionRegex = /\\begin\{rSubsection\}\{([^}]+)\}\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}([\s\S]*?)\\end\{rSubsection\}/g;
      let rMatch: RegExpExecArray | null;
      while ((rMatch = rSubsectionRegex.exec(projSectionMatch[1])) !== null) {
        const title = cleanLatexText(rMatch[1]);
        const dates = cleanLatexText(rMatch[2]);
        const role = cleanLatexText(rMatch[3]);
        const body = rMatch[5] || "";

        const rawItems = body.split(/\\item\s+/).filter(Boolean);
        const bullets = rawItems.map((item) => cleanLatexText(item)).filter((b) => b.length > 5);

        projEntries.push({
          id: `proj-${projEntries.length + 1}`,
          title,
          subtitle: role,
          startDate: dates.split(/--|-|–/)[0]?.trim() || dates,
          endDate: dates.split(/--|-|–/)[1]?.trim() || "",
          link: "",
          technologies: [],
          bullets,
        });
      }
    }
  }

  if (projEntries.length > 0) {
    model.projects = projEntries;
  }
}

function parseSkills(latex: string, model: ResumeDocumentModel) {
  const skillCategories: SkillCategory[] = [];

  // Template 1 Pattern: \resumeItem{\textbf{Category}: Skill1, Skill2, ...}
  const skillsSectionMatch = latex.match(/\\section\*?\{SKILLS\}[\s\S]*?(?=\\section|\%-----------|\\end\{document\})/i);
  if (skillsSectionMatch) {
    const skillLines = skillsSectionMatch[0].match(/\\resumeItem\{([\s\S]*?)\}/g);
    if (skillLines) {
      skillLines.forEach((line, index) => {
        const inner = line.replace(/^\\resumeItem\{|\}$/g, "").trim();
        const boldCatMatch = inner.match(/\\textbf\{([^}]+)\}:\s*([\s\S]*)/);
        if (boldCatMatch) {
          const category = cleanLatexText(boldCatMatch[1]);
          const skillsList = boldCatMatch[2]
            .split(/,\s*|\s*\|\s*/)
            .map((s) => cleanLatexText(s))
            .filter(Boolean);
          skillCategories.push({
            id: `skill-${index + 1}`,
            category,
            skills: skillsList,
          });
        }
      });
    }
  }

  // Template 2 Pattern: Languages & Python, MATLAB ...
  if (skillCategories.length === 0) {
    const rSkillsMatch = latex.match(/\\begin\{rSection\}\{Technical Skills\}([\s\S]*?)\\end\{rSection\}/i);
    if (rSkillsMatch) {
      const rows = rSkillsMatch[1].split(/\\\\/).map((r) => r.trim()).filter(Boolean);
      rows.forEach((row, index) => {
        const [cat, items] = row.split(/&/);
        if (cat && items) {
          skillCategories.push({
            id: `skill-${index + 1}`,
            category: cleanLatexText(cat),
            skills: items.split(/,\s*/).map((s) => cleanLatexText(s)).filter(Boolean),
          });
        }
      });
    }
  }

  if (skillCategories.length > 0) {
    model.skills = skillCategories;
  }
}

function parseAchievements(latex: string, model: ResumeDocumentModel) {
  const achievements: AchievementEntry[] = [];
  const achSectionMatch = latex.match(/\\section\*?\{ACHIEVEMENTS[\s\S]*?\}[\s\S]*?(?=\\section|\%-----------|\\end\{document\})/i);
  if (achSectionMatch) {
    const achMatches = achSectionMatch[0].matchAll(/\\resumeAchievement\{([\s\S]*?)\}\{([^}]+)\}/g);
    for (const match of achMatches) {
      const fullText = cleanLatexText(match[1]);
      const date = cleanLatexText(match[2]);
      const parts = fullText.split(/--|-|–/);
      achievements.push({
        id: `ach-${achievements.length + 1}`,
        title: parts[0]?.trim() || fullText,
        subtitle: parts[1]?.trim() || "",
        date,
        description: "",
      });
    }
  }

  if (achievements.length > 0) {
    model.achievements = achievements;
  }
}

function cleanLatexText(input: string): string {
  if (!input) return "";
  return input
    .replace(/\\textbf\{([^}]+)\}/g, "$1")
    .replace(/\\textit\{([^}]+)\}/g, "$1")
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
    .replace(/\\vert/g, "|")
    .replace(/\\\[\d+pt\]/g, "")
    .replace(/\\\\/g, " ")
    .replace(/--/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}
