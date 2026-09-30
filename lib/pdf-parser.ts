"use client";

import type { ResumeDocumentModel } from "@/server/documents/resume-document-model";

/* ─────────────────────────── Constants ──────────────────────────── */

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Synonym dictionary: any of these strings (lower-cased, trimmed) map to a
 * canonical section key used in ResumeDocumentModel.
 */
const SECTION_SYNONYMS: Record<string, string> = {
  // summary
  summary: "summary",
  "professional summary": "summary",
  "career summary": "summary",
  profile: "summary",
  "career objective": "summary",
  objective: "summary",
  "about me": "summary",
  overview: "summary",
  "personal statement": "summary",
  // experience
  experience: "experience",
  "work experience": "experience",
  "professional experience": "experience",
  "employment history": "experience",
  "work history": "experience",
  career: "experience",
  "job history": "experience",
  internships: "experience",
  internship: "experience",
  // education
  education: "education",
  "educational background": "education",
  "academic background": "education",
  qualifications: "education",
  academics: "education",
  "academic history": "education",
  // skills
  skills: "skills",
  "technical skills": "skills",
  "core competencies": "skills",
  competencies: "skills",
  technologies: "skills",
  "key skills": "skills",
  expertise: "skills",
  "skills & technologies": "skills",
  // projects
  projects: "projects",
  "personal projects": "projects",
  "open source": "projects",
  "open-source projects": "projects",
  "side projects": "projects",
  portfolio: "projects",
  "notable projects": "projects",
  // certifications
  certifications: "certifications",
  certificates: "certifications",
  "licenses & certifications": "certifications",
  "professional certifications": "certifications",
  "licenses and certifications": "certifications",
  // achievements
  achievements: "achievements",
  "achievements & activities": "achievements",
  "honors & awards": "achievements",
  "awards & recognition": "achievements",
  "awards & honors": "achievements",
  "awards and honors": "achievements",
  awards: "achievements",
  honors: "achievements",
  recognition: "achievements",
  activities: "achievements",
  "volunteer experience": "achievements",
  publications: "achievements",
  "extracurricular activities": "achievements",
  // contact (header)
  contact: "header",
  "contact info": "header",
  "contact details": "header",
  "contact information": "header",
  // header (special)
  header: "header",
};

const DATE_PATTERN =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b|\b\d{1,2}\/\d{2,4}\b|\b(?:19|20)\d{2}\b|present|current/i;

const BULLET_RE = /^[\u2022\u2023\u25E6\u2043\u2219\u25CF\u25CB\u2013•\-*>●▸▷•]\s+/;

/* ─────────────────────────── Types ──────────────────────────── */

export type PdfParseError =
  | { kind: "FILE_TOO_LARGE"; maxMb: number }
  | { kind: "NOT_PDF" }
  | { kind: "NO_TEXT" }
  | { kind: "PARSE_FAILED"; message: string };

export type ParsedLine = {
  text: string;
  x: number;
  y: number;
  page: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: number;
  isBold: boolean;
  isAllCaps: boolean;
  isBullet: boolean;
  column: 0 | 1; // 0 = left column (or single-column), 1 = right column
};

export type ParsedSection = {
  canonicalKey: string;
  label: string;
  lines: ParsedLine[];
};

export type UploadParseResult = {
  model: ResumeDocumentModel;
  sections: ParsedSection[];
  unassigned: ParsedLine[];
  confidence: number;
  usedLlm: boolean;
  sourceText: string;
};

/* ─────────────────────────── Internal PDF types ─────────────────────────── */

type PdfTextStyle = { fontFamily?: string };
type PdfFontMeta = { name?: string; fallbackName?: string };
type PdfTextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
};

/* ─────────────────────────── Validation ──────────────────────────── */

export function validatePdfFile(file: File): PdfParseError | null {
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    return { kind: "NOT_PDF" };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { kind: "FILE_TOO_LARGE", maxMb: 5 };
  }
  return null;
}

/* ─────────────────────────── Main entry ──────────────────────────── */

export async function extractParsedLines(
  file: File,
): Promise<{ lines: ParsedLine[]; sourceText: string; annotationUrls: Map<string, string> }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;

  const allLines: ParsedLine[] = [];
  const annotationUrls = new Map<string, string>();

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });

    try {
      await (page as unknown as { getOperatorList: () => Promise<unknown> }).getOperatorList();
    } catch { /* font metadata optional */ }

    const content = await page.getTextContent();
    const styles = content.styles as Record<string, PdfTextStyle>;
    const fontMeta = getFontMeta(page, Object.keys(styles));

    // Collect annotation URLs (real hyperlinks)
    try {
      type PdfAnnotation = { annotationType: number; url?: string; unsafeUrl?: string; rect: number[] };
      const annotations = await (page as unknown as { getAnnotations: () => Promise<PdfAnnotation[]> }).getAnnotations();
      for (const ann of annotations) {
        const url = ann.url || ann.unsafeUrl;
        if (ann.annotationType === 2 && url) {
          annotationUrls.set(ann.rect.map((v) => Math.round(v)).join(","), url);
        }
      }
    } catch { /* annotations optional */ }

    const items = (content.items as unknown[])
      .filter(isPdfTextItem)
      .filter((item) => item.str.trim().length > 0);

    if (items.length === 0) continue;

    const columnSplitX = detectColumnSplit(items, viewport.width);

    if (columnSplitX !== null) {
      // 1. Separate full-width header items in the top 12%
      const maxY = Math.max(...items.map((it) => it.transform[5]));
      const headerThreshold = maxY - 75;

      const headerItems = items.filter(
        (it) =>
          it.transform[5] >= headerThreshold &&
          it.transform[4] < columnSplitX &&
          it.transform[4] + it.width > columnSplitX + 15,
      );

      const leftItems = items.filter(
        (it) => !headerItems.includes(it) && it.transform[4] + it.width * 0.5 <= columnSplitX,
      );

      const rightItems = items.filter(
        (it) => !headerItems.includes(it) && it.transform[4] + it.width * 0.5 > columnSplitX,
      );

      // Build each column sequentially to prevent horizontal interleaving
      const headerLines = buildLinesFromGroup(headerItems, pageNum, viewport.height, styles, fontMeta, 0);
      const leftLines = buildLinesFromGroup(leftItems, pageNum, viewport.height, styles, fontMeta, 0);
      const rightLines = buildLinesFromGroup(rightItems, pageNum, viewport.height, styles, fontMeta, 1);

      allLines.push(...headerLines, ...leftLines, ...rightLines);
    } else {
      const pageLines = buildLinesFromGroup(items, pageNum, viewport.height, styles, fontMeta, 0);
      allLines.push(...pageLines);
    }
  }

  const sourceText = allLines.map((l) => l.text).join("\n");
  return { lines: allLines, sourceText, annotationUrls };
}

/* ─────────────────────────── Section grouping ──────────────────────────── */

export function groupIntoSections(
  lines: ParsedLine[],
): { sections: ParsedSection[]; unassigned: ParsedLine[] } {
  const sections: ParsedSection[] = [];
  const unassigned: ParsedLine[] = [];

  let currentSection: ParsedSection | null = {
    canonicalKey: "header",
    label: "Header",
    lines: [],
  };

  const avgFontSize = lines.reduce((s, l) => s + l.fontSize, 0) / Math.max(lines.length, 1);

  for (const line of lines) {
    const canonical = detectSectionHeading(line, avgFontSize);
    if (canonical) {
      if (currentSection && currentSection.lines.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { canonicalKey: canonical, label: line.text.trim(), lines: [] };
    } else {
      if (currentSection) {
        currentSection.lines.push(line);
      } else {
        unassigned.push(line);
      }
    }
  }

  if (currentSection && currentSection.lines.length > 0) {
    sections.push(currentSection);
  }

  return { sections, unassigned };
}

/* ─────────────────────────── Model builder ──────────────────────────── */

export function buildDocumentModel(
  sections: ParsedSection[],
  annotationUrls: Map<string, string>,
): { model: ResumeDocumentModel; confidence: number } {
  const headerLines = sections.filter((s) => s.canonicalKey === "header").flatMap((s) => s.lines);
  const personalInfo = parseHeader(headerLines, annotationUrls);
  const summary = parseSummary(sections.find((s) => s.canonicalKey === "summary")?.lines || []);
  const experience = parseExperience(sections.find((s) => s.canonicalKey === "experience")?.lines || []);
  const education = parseEducation(sections.find((s) => s.canonicalKey === "education")?.lines || []);
  const skills = parseSkills(sections.find((s) => s.canonicalKey === "skills")?.lines || []);
  const projects = parseProjects(sections.find((s) => s.canonicalKey === "projects")?.lines || []);
  const certLines = sections.find((s) => s.canonicalKey === "certifications")?.lines || [];
  const achievements = parseAchievements([
    ...(sections.find((s) => s.canonicalKey === "achievements")?.lines || []),
    ...certLines,
  ]);

  const filled = [personalInfo.fullName, summary, experience.length, education.length, skills.length].filter(Boolean).length;
  const confidence = filled / 5;

  const now = new Date().toISOString();

  const model: ResumeDocumentModel = {
    version: "1.0.0",
    templateId: "template-1",
    personalInfo,
    sectionTitles: {
      summary: "Professional Summary",
      experience: "Work Experience",
      education: "Education",
      skills: "Skills",
      projects: "Projects",
      achievements: "Achievements and Activities",
      extras: "Achievements and Activities",
    },
    summary,
    experience,
    education,
    projects,
    skills,
    achievements,
    extras: achievements,
    extrasLabel: "Achievements and Activities",
    customSections: [],
    metadata: {
      targetRole: "",
      targetCompany: "",
      lastModified: now,
      lastFlow: "pdf",
    },
  };

  return { model, confidence };
}

/* ─────────────────────────── Section parsers ──────────────────────────── */

function parseHeader(
  lines: ParsedLine[],
  annotationUrls: Map<string, string>,
): ResumeDocumentModel["personalInfo"] {
  const info: ResumeDocumentModel["personalInfo"] = {
    fullName: "",
    headline: "",
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    github: "",
    portfolio: "",
    website: "",
  };

  for (let i = 0; i < lines.length; i++) {
    const text = lines[i].text.trim();
    if (!text || /^contact(?:\s+details|\s+info)?$/i.test(text)) continue;

    // 1. Full name extraction
    if (!info.fullName) {
      // Check if name is split over 2 lines (e.g. LEONAL on line 0, ROBIN on line 1)
      if (
        i + 1 < lines.length &&
        !text.includes("@") &&
        !text.includes("+") &&
        !DATE_PATTERN.test(text)
      ) {
        const nextText = lines[i + 1].text.trim();
        const isSingleWord = (s: string) => /^[A-Za-z]+$/.test(s);
        if (
          isSingleWord(text) &&
          isSingleWord(nextText) &&
          !nextText.includes("@") &&
          !nextText.includes("+") &&
          !DATE_PATTERN.test(nextText)
        ) {
          info.fullName = `${text} ${nextText}`;
          i++; // skip next line as it was last name
          continue;
        }
      }
      if (!text.includes("@") && !text.includes("+") && !DATE_PATTERN.test(text)) {
        info.fullName = text;
        continue;
      }
    }

    // 2. Headline (e.g. Full-Stack & AI Engineer)
    if (
      !info.headline &&
      !text.includes("@") &&
      !text.includes("+") &&
      !/linkedin|github|http/i.test(text)
    ) {
      if (
        /engineer|developer|architect|designer|scientist|manager|intern|specialist|student|consultant/i.test(
          text,
        )
      ) {
        info.headline = text;
        continue;
      }
    }

    // 3. Email
    const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
    if (emailMatch && !info.email) {
      info.email = emailMatch[0];
    }

    // 4. Phone
    const phoneMatch = text.match(/(?:\+?\d[\d\s\-().]{7,}\d)/);
    if (phoneMatch && !info.phone) {
      info.phone = phoneMatch[0].trim();
    }

    // 5. LinkedIn
    if (/linkedin\.com/i.test(text) && !info.linkedin) {
      const m = text.match(/linkedin\.com\/in\/[^\s|/\\,]+/i);
      if (m) info.linkedin = m[0];
    } else if (/^linkedin$/i.test(text) && !info.linkedin) {
      for (const [, url] of annotationUrls.entries()) {
        if (/linkedin/i.test(url)) {
          info.linkedin = url.replace(/^https?:\/\//i, "");
          break;
        }
      }
      if (!info.linkedin) info.linkedin = "linkedin.com";
    }

    // 6. GitHub
    if (/github\.com/i.test(text) && !info.github) {
      const m = text.match(/github\.com\/[^\s|/\\,]+/i);
      if (m) info.github = m[0];
    } else if (/^github$/i.test(text) && !info.github) {
      for (const [, url] of annotationUrls.entries()) {
        if (/github/i.test(url)) {
          info.github = url.replace(/^https?:\/\//i, "");
          break;
        }
      }
      if (!info.github) info.github = "github.com";
    }

    // 7. Portfolio
    if (/https?:\/\//i.test(text) && !info.portfolio) {
      const m = text.match(/https?:\/\/[^\s|,]+/i);
      if (m && !m[0].includes("linkedin") && !m[0].includes("github")) info.portfolio = m[0];
    } else if (/^portfolio$/i.test(text) && !info.portfolio) {
      for (const [, url] of annotationUrls.entries()) {
        if (!/linkedin|github/i.test(url)) {
          info.portfolio = url;
          break;
        }
      }
    }

    // 8. Location
    if (
      !info.location &&
      !emailMatch &&
      !phoneMatch &&
      !/linkedin|github|http/i.test(text) &&
      (/[A-Z][a-z]+,?\s+[A-Z]/.test(text) || /India|USA|UK|Remote/i.test(text)) &&
      text.length < 80
    ) {
      info.location = text;
    }
  }

  return info;
}

function parseSummary(lines: ParsedLine[]): string {
  return lines.map((l) => l.text.trim()).join(" ").trim();
}

function parseExperience(lines: ParsedLine[]): ResumeDocumentModel["experience"] {
  return groupEntriesByHeading(lines)
    .map((group) => {
      const { title, org, startDate, endDate, location, bullets } = parseGenericEntry(group);
      if (!org && !title) return null;

      const roleKeywords = /engineer|developer|intern|lead|architect|manager|consultant|analyst|specialist|designer/i;
      let company = org || title;
      let role = org ? title : "";

      if (title && org && roleKeywords.test(title) && !roleKeywords.test(org)) {
        role = title;
        company = org;
      } else if (title && org && roleKeywords.test(org) && !roleKeywords.test(title)) {
        role = org;
        company = title;
      }

      return {
        id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        company,
        role,
        location,
        startDate,
        endDate,
        bullets,
        technologies: extractTechnologies(bullets),
      };
    })
    .filter(Boolean) as ResumeDocumentModel["experience"];
}

function parseEducation(lines: ParsedLine[]): ResumeDocumentModel["education"] {
  // Try smart whole-section parse first when <= 6 lines (typical single education entry)
  if (lines.length <= 8) {
    const allText = lines.map((l) => l.text.trim());
    const dates = parseDateRange(allText.join(" "));
    const instLine = lines.find((l) =>
      /amrita|university|institute|college|school|vidya|technical|national/i.test(l.text),
    ) || lines[0];
    const degLine = lines.find((l) =>
      /b\.tech|bachelor|master|m\.tech|b\.s\.?|m\.s\.?|degree|diploma|ph\.?d/i.test(l.text),
    ) || (lines.length > 1 ? lines[1] : null);
    const locLine = lines.find(
      (l) =>
        l !== instLine &&
        l !== degLine &&
        !DATE_PATTERN.test(l.text) &&
        (/,/.test(l.text) || /India|USA|UK|Remote/i.test(l.text)),
    );

    let degree = degLine?.text || "";
    let field = "";
    if (degree.includes(",")) {
      const parts = degree.split(",").map((p) => p.trim());
      degree = parts[0];
      field = parts.slice(1).join(", ");
    }

    return [
      {
        id: `edu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        institution: instLine?.text?.trim() || "",
        degree,
        field,
        location: locLine?.text?.trim() || "",
        startDate: dates.startDate,
        endDate: dates.endDate,
        gpa: extractGpa(allText.join(" ")),
        bullets: [],
      },
    ].filter((e) => e.institution) as ResumeDocumentModel["education"];
  }

  return groupEntriesByHeading(lines)
    .map((group) => {
      const { title, org, startDate, endDate, location, bullets } = parseGenericEntry(group);
      if (!org && !title) return null;

      const institution = title;
      let degree = org;
      let field = "";

      if (degree && degree.includes(",")) {
        const parts = degree.split(",").map((p) => p.trim());
        degree = parts[0];
        field = parts.slice(1).join(", ");
      }

      return {
        id: `edu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        institution,
        degree,
        field,
        location,
        startDate,
        endDate,
        gpa: extractGpa(group.map((l) => l.text).join(" ")),
        bullets,
      };
    })
    .filter(Boolean) as ResumeDocumentModel["education"];
}

function parseSkills(lines: ParsedLine[]): ResumeDocumentModel["skills"] {
  const categories: ResumeDocumentModel["skills"] = [];
  let currentCat = "General";
  let currentList: string[] = [];

  const flush = () => {
    if (currentList.length > 0) {
      categories.push({
        id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        category: currentCat,
        skills: currentList,
      });
      currentList = [];
    }
  };

  // First pass: join hyphen-wrapped lines (e.g. "Python, React.js, Re-" + "act.js" → joined)
  const joinedLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let text = lines[i].text.trim();
    while (text.endsWith("-") && i + 1 < lines.length) {
      i++;
      text = text.slice(0, -1) + lines[i].text.trim();
    }
    if (text) joinedLines.push(text);
  }

  for (let i = 0; i < joinedLines.length; i++) {
    const text = joinedLines[i].trim();
    if (!text) continue;

    // Colon format: "Category: item1, item2"
    const colonIdx = text.indexOf(":");
    if (colonIdx > 0 && colonIdx < 35) {
      flush();
      currentCat = text.slice(0, colonIdx).trim();
      const skills = text.slice(colonIdx + 1).split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
      currentList.push(...skills);
      continue;
    }

    // Two-line heading format: e.g. "Languages & Frameworks" followed by comma-separated skills
    const isHeading =
      text.length < 40 &&
      !text.includes(",") &&
      (/languages|frameworks|tools|platforms|databases|technologies|libraries|cloud|ai\s*[\/\-]\s*ml|core/i.test(text) ||
        (i + 1 < joinedLines.length && joinedLines[i + 1].includes(",")));

    if (isHeading) {
      flush();
      currentCat = text;
      continue;
    }

    const skills = text.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
    currentList.push(...skills);
  }

  flush();
  return categories;
}

function parseProjects(lines: ParsedLine[]): ResumeDocumentModel["projects"] {
  return groupEntriesByHeading(lines)
    .map((group) => {
      const { title, org, startDate, endDate, bullets } = parseGenericEntry(group);
      if (!title) return null;

      const linkBullet = bullets.find((b) => /https?:\/\//i.test(b));
      const link = linkBullet ? linkBullet.match(/https?:\/\/[^\s)]+/i)?.[0] || "" : "";

      return {
        id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title,
        subtitle: org || "",
        startDate,
        endDate,
        link,
        technologies: extractTechnologies(bullets),
        bullets: bullets.filter((b) => !b.match(/^https?:\/\//i)),
      };
    })
    .filter(Boolean) as ResumeDocumentModel["projects"];
}

function parseAchievements(lines: ParsedLine[]): ResumeDocumentModel["achievements"] {
  // Group by date-bearing lines – each award/achievement starts with a line containing a date
  const groups: ParsedLine[][] = [];
  let current: ParsedLine[] = [];

  for (const line of lines) {
    const text = line.text.trim();
    if (!text) continue;
    if (DATE_PATTERN.test(text) && current.length > 0) {
      groups.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) groups.push(current);

  return groups
    .map((group) => {
      const fullText = group.map((l) => l.text.trim()).join(" ");
      const dates = parseDateRange(fullText);
      // Strip dates from title line
      const rawTitle = group[0].text.trim()
        .replace(/\(\s*\d{1,2}\/\d{2,4}\s*\)/g, "")
        .replace(/\b\d{1,2}\/\d{2,4}\b/g, "")
        .replace(/\b(?:19|20)\d{2}\b/g, "")
        .replace(/\s*[-–—]\s*/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const details = group
        .slice(1)
        .map((l) => l.text.trim())
        .filter(Boolean)
        .join(" ");

      if (!rawTitle) return null;

      return {
        id: `ach-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: rawTitle,
        subtitle: "",
        date: dates.startDate,
        description: details,
        bullets: details ? [details] : [],
      };
    })
    .filter(Boolean) as ResumeDocumentModel["achievements"];
}

/* ─────────────────────────── Generic entry parser ─────────────────────── */

type GenericEntry = {
  title: string;
  org: string;
  startDate: string;
  endDate: string;
  location: string;
  bullets: string[];
  raw: ParsedLine[];
};

function groupEntriesByHeading(lines: ParsedLine[]): ParsedLine[][] {
  const avgFs = lines.reduce((s, l) => s + l.fontSize, 0) / Math.max(lines.length, 1);
  const groups: ParsedLine[][] = [];
  let current: ParsedLine[] = [];

  for (const line of lines) {
    const text = line.text.trim();
    const hasDate = DATE_PATTERN.test(text);
    const isBullet = line.isBullet || BULLET_RE.test(text);

    // Entry boundary: line has date and is not a bullet, or is bold/prominent header
    const isEntryBreak =
      !isBullet &&
      text.length > 2 &&
      (hasDate || line.isBold || line.fontSize > avgFs * 1.05);

    if (isEntryBreak && current.length > 0) {
      groups.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

function parseGenericEntry(lines: ParsedLine[]): GenericEntry {
  const result: GenericEntry = {
    title: "",
    org: "",
    startDate: "",
    endDate: "",
    location: "",
    bullets: [],
    raw: lines,
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let text = line.text.trim();
    if (!text) continue;

    // Check if line contains a date range
    if (DATE_PATTERN.test(text) && !result.startDate) {
      const dates = parseDateRange(text);
      result.startDate = dates.startDate;
      result.endDate = dates.endDate;
      text = text
        .replace(/(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s*\d{2,4}/gi, "")
        .replace(/\b\d{1,2}\/\d{2,4}\b/g, "")
        .replace(/\b(?:19|20)\d{2}\b/g, "")
        .replace(/present|current/gi, "")
        .replace(/[-–—]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    if (i === 0) {
      if (text.includes("|")) {
        const parts = text.split("|").map((p) => p.trim());
        result.title = parts[0];
        result.org = parts.slice(1).join(" ");
      } else {
        result.title = text.replace(BULLET_RE, "").trim();
      }
      continue;
    }

    if (i === 1 && !result.org && !line.isBullet && !BULLET_RE.test(text)) {
      // Skip if line looks like a project/bullet description (starts with action verb)
      if (/^(?:built|designed|engineered|developed|created|led|implemented|architected|contributed|integrated|optimized|deployed|launched|managed)\b/i.test(text)) {
        result.bullets.push(text);
        continue;
      }
      // Pattern: "OrgName CityName, Country" — space before last word before comma
      const spaceCommaMatch = text.match(/^(.+?)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?,\s*(?:India|USA|UK|Remote|[A-Za-z ]+))$/);
      if (spaceCommaMatch) {
        result.org = spaceCommaMatch[1].trim();
        result.location = spaceCommaMatch[2].trim();
      } else {
        const locMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?,\s*(?:[A-Z][a-z]+|India|USA|UK|Remote|Karnataka|Tamil Nadu))/);
        if (locMatch) {
          result.location = locMatch[1].trim();
          const beforeLoc = text.replace(locMatch[0], "").trim();
          if (beforeLoc) result.org = beforeLoc;
        } else if (text.includes(",")) {
          const parts = text.split(",").map((p) => p.trim());
          result.org = parts[0];
          result.location = parts.slice(1).join(", ");
        } else {
          result.org = text.replace(BULLET_RE, "").trim();
        }
      }
      continue;
    }

    // Location fallback
    if (!result.location && !line.isBullet && !BULLET_RE.test(text) && /[A-Z][a-z]+,\s*[A-Z]/.test(text)) {
      result.location = text;
      continue;
    }

    // Bullet lines — also join hyphen-wrapped continuation from previous bullet
    const cleanText = text.replace(BULLET_RE, "").trim();
    if (line.isBullet || BULLET_RE.test(text)) {
      result.bullets.push(cleanText);
    } else if (result.bullets.length > 0 && result.bullets[result.bullets.length - 1].endsWith("-")) {
      // Join hyphen-wrapped continuation
      result.bullets[result.bullets.length - 1] =
        result.bullets[result.bullets.length - 1].slice(0, -1) + cleanText;
    } else {
      result.bullets.push(cleanText);
    }
  }

  return result;
}

/* ─────────────────────────── Utilities ──────────────────────────── */

function detectSectionHeading(line: ParsedLine, avgFontSize: number): string | null {
  const text = line.text.trim().toLowerCase().replace(/[:\-–—]+$/, "").trim();
  const canonical = SECTION_SYNONYMS[text];
  if (canonical && canonical !== "header") return canonical;

  if (!line.isBullet && text.length <= 45 && (line.isBold || line.isAllCaps || line.fontSize > avgFontSize * 1.05)) {
    for (const [key, val] of Object.entries(SECTION_SYNONYMS)) {
      if (val !== "header" && (text === key || text.startsWith(key + " ") || text.endsWith(" " + key))) {
        return val;
      }
    }
  }
  return null;
}

function groupByBaseline(items: PdfTextItem[]): Map<number, (PdfTextItem & { x: number })[]> {
  const grouped = new Map<number, (PdfTextItem & { x: number })[]>();
  for (const item of items) {
    const [, , , , x, baselineY] = item.transform as number[];
    const existingY = [...grouped.keys()].find((k) => Math.abs(k - baselineY) <= 3);
    const key = existingY ?? baselineY;
    grouped.set(key, [...(grouped.get(key) ?? []), { ...item, x }]);
  }
  return grouped;
}

function buildLinesFromGroup(
  items: PdfTextItem[],
  pageNum: number,
  viewportHeight: number,
  styles: Record<string, PdfTextStyle>,
  fontMeta: Record<string, PdfFontMeta>,
  column: 0 | 1,
): ParsedLine[] {
  const grouped = groupByBaseline(items);
  const lines: ParsedLine[] = [];

  for (const [, lineItems] of [...grouped.entries()].sort(([a], [b]) => b - a)) {
    const sorted = lineItems.sort((a, b) => a.x - b.x);
    const text = joinItems(sorted);
    if (!text.trim()) continue;

    const first = sorted[0];
    const [, b, , d] = first.transform as number[];
    const fontSize = Math.max(Math.hypot(b, d), first.height || 0, 1);
    const fontDesc = buildFontDescriptor(first.fontName, styles, fontMeta);
    const isBold = /bold|bx\d|cmbx|lmbx/i.test(fontDesc);
    const x = Math.min(...sorted.map((it) => it.x));
    const top = viewportHeight - first.transform[5] - fontSize * 0.92;

    lines.push({
      text: text.trim(),
      x,
      y: Math.max(top, 0),
      page: pageNum,
      width: Math.max(...sorted.map((it) => it.x + it.width)) - x,
      height: Math.max(fontSize * 1.2, ...sorted.map((it) => it.height)),
      fontSize,
      fontWeight: isBold ? 700 : 400,
      isBold,
      isAllCaps: text.trim() === text.trim().toUpperCase() && /[A-Z]{2,}/.test(text.trim()),
      isBullet: BULLET_RE.test(text.trim()),
      column,
    });
  }

  return lines;
}

function detectColumnSplit(items: PdfTextItem[], pageWidth: number): number | null {
  if (items.length < 12) return null;

  type Box = { x: number; right: number; width: number; baselineY: number };
  const boxes: Box[] = items.map((it) => {
    const x = it.transform[4];
    return {
      x,
      right: x + Math.max(it.width, 1),
      width: it.width,
      baselineY: it.transform[5],
    };
  });

  const maxBaselineY = Math.max(...boxes.map((b) => b.baselineY));
  // Filter out any full-width header items in the top 80pt
  const bodyBoxes = boxes.filter(
    (b) => !(b.baselineY > maxBaselineY - 80 && b.width > pageWidth * 0.45),
  );

  if (bodyBoxes.length < 10) return null;

  let bestSplitX: number | null = null;
  let minCrossing = Infinity;
  let maxSeparation = 0;

  // Scan potential gutter X positions from 20% to 75% of pageWidth
  const step = 4;
  const startX = Math.round(pageWidth * 0.20);
  const endX = Math.round(pageWidth * 0.75);

  for (let candX = startX; candX <= endX; candX += step) {
    let leftCount = 0;
    let rightCount = 0;
    let crossingCount = 0;
    let maxLeftEdge = 0;
    let minRightEdge = pageWidth;

    for (const b of bodyBoxes) {
      if (b.right <= candX + 4) {
        leftCount++;
        if (b.right > maxLeftEdge) maxLeftEdge = b.right;
      } else if (b.x >= candX - 4) {
        rightCount++;
        if (b.x < minRightEdge) minRightEdge = b.x;
      } else {
        crossingCount++;
      }
    }

    const total = bodyBoxes.length;
    // Both columns must contain at least 15% of body items
    if (leftCount / total >= 0.15 && rightCount / total >= 0.20) {
      const separation = Math.max(0, minRightEdge - maxLeftEdge);
      if (
        crossingCount < minCrossing ||
        (crossingCount === minCrossing && separation > maxSeparation)
      ) {
        minCrossing = crossingCount;
        maxSeparation = separation;
        bestSplitX = candX;
      }
    }
  }

  // A column split is valid if crossing is <= 2 or <= 3% of body items
  if (
    bestSplitX !== null &&
    (minCrossing <= 2 || minCrossing / bodyBoxes.length <= 0.03)
  ) {
    return bestSplitX;
  }

  return null;
}

function joinItems(items: (PdfTextItem & { x: number })[]): string {
  const fontSize = Math.max(...items.map((it) => { const [, b, , d] = it.transform; return Math.hypot(b, d) || it.height; }), 1);
  return items.reduce((acc, item, idx) => {
    if (idx === 0) return item.str;
    const prev = items[idx - 1];
    const gap = item.x - (prev.x + prev.width);
    return acc + (gap > fontSize * 0.24 ? " " : "") + item.str;
  }, "");
}

function getFontMeta(page: unknown, fontNames: string[]): Record<string, PdfFontMeta> {
  const objs = (page as { commonObjs?: { get?: (id: string) => unknown } }).commonObjs;
  const meta: Record<string, PdfFontMeta> = {};
  if (!objs?.get) return meta;
  for (const name of fontNames) {
    try { const f = objs.get(name) as PdfFontMeta | undefined; meta[name] = { name: f?.name, fallbackName: f?.fallbackName }; }
    catch { meta[name] = {}; }
  }
  return meta;
}

function buildFontDescriptor(fontName: string, _styles: Record<string, PdfTextStyle>, meta: Record<string, PdfFontMeta>): string {
  const m = meta[fontName] || {};
  return `${fontName} ${m.name ?? ""} ${m.fallbackName ?? ""}`.toLowerCase();
}

function isPdfTextItem(item: unknown): item is PdfTextItem {
  if (!item || typeof item !== "object") return false;
  const c = item as Partial<PdfTextItem>;
  return typeof c.str === "string" && Array.isArray(c.transform) && typeof c.width === "number" && typeof c.height === "number" && typeof c.fontName === "string";
}

function parseDateRange(text: string): { startDate: string; endDate: string } {
  const clean = text.replace(/\s+/g, " ").trim();
  const rangeMatch = clean.match(
    /(\d{1,2}\/\d{2,4}|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s*\d{2,4}|\b(?:19|20)\d{2}\b)\s*[-–—to]+\s*(\d{1,2}\/\d{2,4}|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s*\d{2,4}|\b(?:19|20)\d{2}\b|present|current)/i,
  );
  if (rangeMatch) return { startDate: rangeMatch[1].trim(), endDate: rangeMatch[2].trim() };
  const singleDate = clean.match(/(\d{1,2}\/\d{2,4}|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s*\d{2,4}|\b(?:19|20)\d{2}\b)/i);
  if (singleDate) return { startDate: singleDate[1].trim(), endDate: "" };
  if (/present|current/i.test(clean)) return { startDate: "", endDate: "Present" };
  return { startDate: "", endDate: "" };
}

function extractGpa(text: string): string {
  const m = text.match(/(?:gpa|cgpa|score)[:\s]*([0-9.]+(?:\s*\/\s*[0-9.]+)?)/i);
  return m ? m[1].trim() : "";
}

function extractTechnologies(bullets: string[]): string[] {
  const patterns = [
    /\b(?:React|Vue|Angular|Next\.js|TypeScript|JavaScript|Python|Go|Rust|Java|Kotlin|Swift|C\+\+|C#|PHP|Ruby|Scala|Node\.js|Express|FastAPI|Django|Flask|Spring|Svelte|Nuxt)\b/g,
    /\b(?:AWS|GCP|Azure|Docker|Kubernetes|Terraform|Jenkins|GitHub Actions|Vercel|Netlify|Supabase|Firebase|Heroku)\b/g,
    /\b(?:PostgreSQL|MySQL|MongoDB|Redis|SQLite|DynamoDB|Elasticsearch|Pinecone|FAISS|ChromaDB)\b/g,
    /\b(?:TensorFlow|PyTorch|scikit-learn|LangChain|OpenAI|Anthropic|Gemini|Groq|LLM|GPT|Claude|Mistral|RAG)\b/g,
  ];
  const found = new Set<string>();
  const all = bullets.join(" ");
  for (const pat of patterns) { const m = all.match(pat); if (m) m.forEach((v) => found.add(v)); }
  return [...found];
}

/**
 * Renders pages of a PDF to base64 JPEG images for OCR fallback
 * when pdfjs extracted text is empty or near-empty.
 */
export async function renderPdfToImages(file: File, maxPages = 3): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const images: string[] = [];

  const pagesToRender = Math.min(pdf.numPages, maxPages);
  for (let i = 1; i <= pagesToRender; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });

    if (typeof document === "undefined") continue;

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      // Cast canvasContext as any to avoid type issues across pdfjs versions
      await (page.render as unknown as (params: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> })({
        canvasContext: ctx,
        viewport,
      }).promise;
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const base64 = dataUrl.split(",")[1];
      if (base64) {
        images.push(base64);
      }
    }
  }

  return images;
}

