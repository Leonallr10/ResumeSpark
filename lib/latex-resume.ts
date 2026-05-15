import { createId, detectSectionTitle } from "@/lib/resume";
import type { AiSuggestion, ResumeLine, ResumeSection } from "@/types/resume";

export type ProjectDraft = {
  heading: string;
  explanation: string;
  techStack: string;
  link: string;
  fromDate: string;
  toDate: string;
};

export const DEFAULT_LATEX_RESUME = String.raw`\documentclass[letterpaper,11pt]{article}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}

\titleformat{\section}{\large\bfseries}{}{0em}{}[\titlerule]
\setlist[itemize]{leftmargin=0.18in,itemsep=2pt,topsep=2pt}

\newcommand{\resumeItem}[1]{\item\small{#1}}
\newcommand{\resumeProjectHeading}[2]{\item \textbf{#1} \hfill #2}
\newcommand{\resumeSubheading}[4]{\item \textbf{#1} \hfill #2 \\ \textit{#3} \hfill \textit{#4}}
\newcommand{\resumeItemListStart}{\begin{itemize}}
\newcommand{\resumeItemListEnd}{\end{itemize}}
\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0in,label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}

\begin{document}

\begin{center}
  \textbf{\Huge Your Name} \\
  your.email@example.com $|$ +91 98765 43210 $|$ LinkedIn $|$ GitHub
\end{center}

\section{Summary}
\resumeItemListStart
  \resumeItem{Software developer focused on building reliable, user-friendly web applications.}
\resumeItemListEnd

\section{Skills}
\resumeItemListStart
  \resumeItem{\textbf{Languages:} JavaScript, TypeScript, Python}
  \resumeItem{\textbf{Frameworks:} React, Next.js, Node.js}
  \resumeItem{\textbf{Tools:} Git, REST APIs, SQL}
\resumeItemListEnd

\section{Projects}
\resumeSubHeadingListStart
  \resumeProjectHeading{Resume Generator}{Jan 2026 -- Apr 2026}
  \resumeItemListStart
    \resumeItem{Built a resume tailoring app that keeps resume content editable in LaTeX and exports a polished PDF.}
    \resumeItem{\textbf{Tech Stack:} Next.js, TypeScript, Tailwind CSS, Gemini API}
  \resumeItemListEnd
\resumeSubHeadingListEnd

\section{Education}
\resumeSubHeadingListStart
  \resumeSubheading{Your College}{2022 -- 2026}{B.Tech in Computer Science}{City, Country}
\resumeSubHeadingListEnd

\end{document}
`;

type ParsedCommand = {
  args: string[];
};

const visibleCommandNames = [
  "resumeProjectHeading",
  "resumeSubheading",
  "resumeItemNoBullet",
  "resumeSubItem",
  "resumeItem",
  "achievementEntry",
] as const;

const visibleCommandArgCounts: Record<(typeof visibleCommandNames)[number], number> = {
  resumeProjectHeading: 2,
  resumeSubheading: 4,
  resumeItemNoBullet: 1,
  resumeSubItem: 2,
  resumeItem: 1,
  achievementEntry: 3,
};

export function parseLatexResume(latex: string): ResumeSection[] {
  const lines = latex.replace(/\r\n/g, "\n").split("\n");
  const sections: ResumeSection[] = [];
  let activeSection = createSection("Header");
  let isInsideDocument = !latex.includes("\\begin{document}");

  sections.push(activeSection);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed === "\\begin{document}") {
      isInsideDocument = true;
      continue;
    }

    if (trimmed === "\\end{document}") {
      isInsideDocument = false;
      continue;
    }

    if (!isInsideDocument) {
      continue;
    }

    if (!trimmed || isInvisibleLatexLine(trimmed)) {
      continue;
    }

    const sectionTitle = parseSectionTitle(trimmed);

    if (sectionTitle) {
      activeSection = createSection(sectionTitle);
      sections.push(activeSection);
      continue;
    }

    const commandBlock = readVisibleCommandBlock(lines, index);
    const sourceText = commandBlock?.text ?? trimmed;
    const sourceEndLine = commandBlock?.endLine ?? index;
    const parsedLine = parseVisibleLatexLine(
      sourceText,
      index,
      sourceEndLine,
      activeSection.id,
    );

    if (commandBlock) {
      index = commandBlock.endLine;
    }

    if (!parsedLine) {
      continue;
    }

    const detectedTitle = detectSectionTitle(parsedLine.text);

    if (
      activeSection.title === "Header" &&
      activeSection.lines.length > 0 &&
      detectedTitle
    ) {
      activeSection = createSection(detectedTitle);
      sections.push(activeSection);
      continue;
    }

    activeSection.lines.push(parsedLine);
  }

  return sections.filter((section) => section.lines.length > 0);
}

export function formatProjectInput(project: ProjectDraft) {
  const parts = [
    project.heading.trim() ? `Heading: ${project.heading.trim()}` : "",
    project.explanation.trim()
      ? `Project explanation: ${project.explanation.trim()}`
      : "",
    project.techStack.trim() ? `Tech stack: ${project.techStack.trim()}` : "",
    project.link.trim() ? `Link: ${project.link.trim()}` : "",
    project.fromDate.trim() || project.toDate.trim()
      ? `Dates: ${formatProjectDateRange(project)}`
      : "",
  ].filter(Boolean);

  return parts.join("\n");
}

export function formatProjectsInput(projects: ProjectDraft[]) {
  return projects
    .filter(hasProjectDraftContent)
    .map((project, index) => {
      const projectText = formatProjectInput(project);

      return projectText ? `Project ${index + 1}\n${projectText}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

export function hasProjectDraftContent(project: ProjectDraft) {
  return Object.values(project).some((value) => value.trim().length > 0);
}

export function canInsertProject(project: ProjectDraft) {
  return (
    project.heading.trim().length > 0 &&
    project.explanation.trim().length > 0 &&
    project.techStack.trim().length > 0
  );
}

export function buildProjectLatexBlock(
  project: ProjectDraft,
  options?: { useTechStackCommand?: boolean; useProjectHeadingCommand?: boolean; useNoBulletItems?: boolean; hasXcolor?: boolean },
) {
  const heading = escapeLatexText(project.heading.trim());
  const bullets = splitExplanationIntoBullets(project.explanation.trim());
  const techStack = escapeLatexText(stripTechStackLabel(project.techStack));
  const dateRange = escapeLatexText(formatProjectDateRange(project));
  const link = normalizeProjectLink(project.link);
  const headingWithLink = buildHeadingWithLink(heading, link, { hasXcolor: options?.hasXcolor });
  const bulletCommand = options?.useNoBulletItems ? "\\resumeItemNoBullet" : "\\resumeItem";
  const techStackLine = options?.useTechStackCommand
    ? `\\techstack{${techStack}}`
    : `  ${bulletCommand}{\\textbf{Tech Stack:} ${techStack}}`;

  if (link) {
    const subheadingTechStack = options?.useTechStackCommand
      ? `\\techstack{${techStack}}`
      : `Tech Stack: ${techStack}`;

    return [
      `\\resumeSubheading{${headingWithLink}}{${dateRange}}{${subheadingTechStack}}{}`,
      "\\resumeItemListStart",
      ...bullets.map((b) => `  ${bulletCommand}{${escapeLatexText(b)}}`),
      "\\resumeItemListEnd",
    ].join("\n");
  }

  const headingLine = options?.useProjectHeadingCommand !== false
    ? `\\resumeProjectHeading{${heading}}{${dateRange}}`
    : `\\resumeSubheading{${heading}}{${dateRange}}{}{}`;

  return [
    headingLine,
    "\\resumeItemListStart",
    ...bullets.map((b) => `  ${bulletCommand}{${escapeLatexText(b)}}`),
    techStackLine,
    "\\resumeItemListEnd",
  ].join("\n");
}

function splitExplanationIntoBullets(explanation: string): string[] {
  if (explanation.includes(";;")) {
    return explanation.split(";;").map((b) => b.trim()).filter(Boolean);
  }

  const newlineSplit = explanation
    .split(/\n/)
    .map((line) => line.replace(/^[-•*]\s*/, "").replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean);

  if (newlineSplit.length > 1) {
    return newlineSplit;
  }

  return [explanation];
}

export function insertProjectIntoLatex(latex: string, project: ProjectDraft) {
  return insertProjectsIntoLatex(latex, [project]);
}

export function insertProjectsIntoLatex(latex: string, projects: ProjectDraft[]) {
  const useTechStackCommand = shouldUseTechStackCommand(latex);
  const useProjectHeadingCommand = hasProjectHeadingCommand(latex);
  const useNoBulletItems = usesNoBulletInProjects(latex);
  const hasXcolor = hasXcolorPackage(latex);
  const blocks = projects
    .filter(canInsertProject)
    .map((project) => buildProjectLatexBlock(project, { useTechStackCommand, useProjectHeadingCommand, useNoBulletItems, hasXcolor }));

  if (blocks.length === 0) {
    return latex;
  }

  const block = blocks.join("\n");
  const lines = latex.replace(/\r\n/g, "\n").split("\n");
  const projectsIndex = lines.findIndex((line) =>
    /^\\section\*?\{projects\}/i.test(line.trim()),
  );

  if (projectsIndex === -1) {
    const endDocumentIndex = lines.findIndex((line) => line.trim() === "\\end{document}");
    const insertion = [
      "",
      "\\section{Projects}",
      "\\resumeSubHeadingListStart",
      block,
      "\\resumeSubHeadingListEnd",
      "",
    ];
    const targetIndex = endDocumentIndex === -1 ? lines.length : endDocumentIndex;

    lines.splice(targetIndex, 0, ...insertion);
    return lines.join("\n");
  }

  const sectionEndIndex = findNextSectionIndex(lines, projectsIndex + 1);
  const projectListEndIndex = findLastIndexInRange(
    lines,
    projectsIndex + 1,
    sectionEndIndex,
    (line) => line.trim() === "\\resumeSubHeadingListEnd",
  );

  if (projectListEndIndex !== -1) {
    lines.splice(projectListEndIndex, 0, block);
    return lines.join("\n");
  }

  const insertionIndex = sectionEndIndex === -1 ? lines.length : sectionEndIndex;
  lines.splice(
    insertionIndex,
    0,
    "\\resumeSubHeadingListStart",
    block,
    "\\resumeSubHeadingListEnd",
  );

  return lines.join("\n");
}

export function applySuggestionToLatex(
  latex: string,
  sections: ResumeSection[],
  suggestion: AiSuggestion,
) {
  const targetLine = sections
    .flatMap((section) => section.lines)
    .find((line) => line.id === suggestion.targetLineId);

  if (typeof targetLine?.sourceLine !== "number") {
    return latex;
  }

  const lines = latex.replace(/\r\n/g, "\n").split("\n");
  const useTechStackCommand = shouldUseTechStackCommand(latex);
  const useProjectHeadingCommand = hasProjectHeadingCommand(latex);
  const useNoBulletItems = usesNoBulletInProjects(latex);
  const hasXcolor = hasXcolorPackage(latex);
  const targetIndex = targetLine.sourceLine;
  const targetEndIndex = targetLine.sourceEndLine ?? targetIndex;
  const targetLength = Math.max(1, targetEndIndex - targetIndex + 1);

  if (!lines[targetIndex]) {
    return latex;
  }

  if (suggestion.action === "delete") {
    lines.splice(targetIndex, targetLength);
    return lines.join("\n");
  }

  if (suggestion.action === "replace") {
    const targetSection = sections.find((section) =>
      section.lines.some((line) => line.id === suggestion.targetLineId),
    );
    const strippedText = stripSuggestionBullet(suggestion.suggestedText);
    const projectSuggestion = parseProjectSuggestion(strippedText);

    if (targetSection?.title.toLowerCase().includes("project") && projectSuggestion) {
      return replaceProjectBlockInLatex(lines, targetIndex, projectSuggestion, {
        useTechStackCommand,
        useProjectHeadingCommand,
        useNoBulletItems,
        hasXcolor,
      }).join("\n");
    }

    if (isProjectReplacementFormat(strippedText)) {
      return latex;
    }

    lines.splice(
      targetIndex,
      targetLength,
      replaceVisibleLatexLine(
        targetLine.sourceText ?? lines[targetIndex],
        suggestion.suggestedText,
        { useTechStackCommand },
      ),
    );
    return lines.join("\n");
  }

  const targetSection = sections.find((section) =>
    section.lines.some((line) => line.id === suggestion.targetLineId),
  );
  const insertedLine = createInsertedLatexLine(
    lines[targetIndex],
    suggestion.suggestedText,
    targetSection?.title,
    { useTechStackCommand, useProjectHeadingCommand, useNoBulletItems, hasXcolor },
  );
  const insertionIndex =
    targetSection?.title.toLowerCase().includes("project") &&
    parseProjectSuggestion(stripSuggestionBullet(suggestion.suggestedText))
      ? findProjectInsertionIndex(lines, targetIndex)
      : suggestion.action === "insert_before"
        ? targetIndex
        : targetIndex + 1;

  lines.splice(insertionIndex, 0, insertedLine);
  return lines.join("\n");
}

export function previewSuggestionLatexLine(
  source: string,
  suggestedText: string,
  action: AiSuggestion["action"],
  sectionTitle?: string,
) {
  if (action === "delete") {
    return "";
  }

  if (action === "replace") {
    return replaceVisibleLatexLine(source, suggestedText);
  }

  return createInsertedLatexLine(source, suggestedText, sectionTitle);
}

export function escapeLatexText(value: string) {
  return value
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function createSection(title: string): ResumeSection {
  return {
    id: `section-${slugify(title)}`,
    title,
    lines: [],
  };
}

function parseVisibleLatexLine(
  trimmed: string,
  sourceLine: number,
  sourceEndLine: number,
  sectionId: string,
): ResumeLine | undefined {
  const projectHeading = parseCommand(trimmed, "resumeProjectHeading");

  if (projectHeading?.args[0]) {
    return createLine({
      sectionId,
      sourceLine,
      sourceEndLine,
      sourceText: trimmed,
      text: cleanLatexText(projectHeading.args[0]),
      rightText: cleanLatexText(projectHeading.args[1] ?? ""),
      kind: "projectHeading",
    });
  }

  const subheading = parseCommand(trimmed, "resumeSubheading");

  if (subheading?.args[0]) {
    return createLine({
      sectionId,
      sourceLine,
      sourceEndLine,
      sourceText: trimmed,
      text: cleanLatexText(subheading.args[0]),
      rightText: cleanLatexText(subheading.args[1] ?? ""),
      secondaryText: [subheading.args[2], subheading.args[3]]
        .map((part) => cleanLatexText(part ?? ""))
        .filter(Boolean)
        .join(" | "),
      kind: "subheading",
    });
  }

  const achievementEntry = parseCommand(trimmed, "achievementEntry");

  if (achievementEntry?.args[0]) {
    return createLine({
      sectionId,
      sourceLine,
      sourceEndLine,
      sourceText: trimmed,
      text: cleanLatexText(achievementEntry.args[0]),
      rightText: cleanLatexText(achievementEntry.args[1] ?? ""),
      secondaryText: cleanLatexText(achievementEntry.args[2] ?? ""),
      kind: "subheading",
    });
  }

  const resumeSubItem = parseCommand(trimmed, "resumeSubItem");

  if (resumeSubItem?.args[0]) {
    return createLine({
      sectionId,
      sourceLine,
      sourceEndLine,
      sourceText: trimmed,
      text: [resumeSubItem.args[0], resumeSubItem.args[1]]
        .map((part) => cleanLatexText(part ?? ""))
        .filter(Boolean)
        .join(": "),
      kind: "text",
    });
  }

  const resumeItemNoBullet = parseCommand(trimmed, "resumeItemNoBullet");

  if (resumeItemNoBullet?.args[0]) {
    return createLine({
      sectionId,
      sourceLine,
      sourceEndLine,
      sourceText: trimmed,
      text: cleanLatexText(resumeItemNoBullet.args[0]),
      kind: sectionId === "section-summary" ? "text" : "bullet",
    });
  }

  const resumeItem = parseCommand(trimmed, "resumeItem");

  if (resumeItem?.args[0]) {
    return createLine({
      sectionId,
      sourceLine,
      sourceEndLine,
      sourceText: trimmed,
      text: cleanLatexText(resumeItem.args[0]),
      kind: "bullet",
    });
  }

  if (/^\\item\b/.test(trimmed)) {
    return createLine({
      sectionId,
      sourceLine,
      sourceEndLine,
      sourceText: trimmed,
      text: cleanLatexText(trimmed.replace(/^\\item\s*/, "")),
      kind: "bullet",
    });
  }

  const text = cleanLatexText(trimmed);

  if (!text || isLikelyDefinitionText(trimmed)) {
    return undefined;
  }

  return createLine({
    sectionId,
    sourceLine,
    sourceEndLine,
    sourceText: trimmed,
    text,
    kind: sectionId === "section-header" ? "header" : "text",
  });
}

function createLine(input: Omit<ResumeLine, "id" | "page">): ResumeLine {
  return {
    ...input,
    id: `line-${input.sourceLine ?? createId("line")}`,
    page: 1,
  };
}

function parseSectionTitle(line: string) {
  const match = line.match(/^\\section\*?\{(.+)\}/);
  return match ? cleanLatexText(match[1]) : undefined;
}

function readVisibleCommandBlock(lines: string[], startIndex: number) {
  const firstLine = lines[startIndex].trim();
  const command = visibleCommandNames.find((name) =>
    firstLine.startsWith(`\\${name}`),
  );

  if (!command) {
    return undefined;
  }

  let text = firstLine;
  let endLine = startIndex;

  while (
    (parseCommand(text, command)?.args.length ?? 0) <
      visibleCommandArgCounts[command] &&
    endLine + 1 < lines.length
  ) {
    const nextLine = lines[endLine + 1].trim();

    if (
      !nextLine ||
      nextLine.startsWith("%") ||
      /^\\(?:section|begin|end)\b/.test(nextLine)
    ) {
      break;
    }

    text = `${text} ${nextLine}`;
    endLine += 1;
  }

  return { text, endLine };
}

function parseCommand(line: string, command: string): ParsedCommand | undefined {
  const commandStart = line.indexOf(`\\${command}`);

  if (commandStart === -1) {
    return undefined;
  }

  let cursor = commandStart + command.length + 1;
  const args: string[] = [];

  while (cursor < line.length) {
    while (/\s/.test(line[cursor] ?? "")) {
      cursor += 1;
    }

    if (line[cursor] !== "{") {
      break;
    }

    const parsedArg = readBalancedArgument(line, cursor);

    if (!parsedArg) {
      break;
    }

    args.push(parsedArg.value);
    cursor = parsedArg.nextIndex;
  }

  return args.length > 0 ? { args } : undefined;
}

function readBalancedArgument(line: string, startIndex: number) {
  let depth = 0;
  let value = "";

  for (let index = startIndex; index < line.length; index += 1) {
    const char = line[index];
    const previous = line[index - 1];

    if (char === "{" && previous !== "\\") {
      if (depth > 0) {
        value += char;
      }

      depth += 1;
      continue;
    }

    if (char === "}" && previous !== "\\") {
      depth -= 1;

      if (depth === 0) {
        return {
          value,
          nextIndex: index + 1,
        };
      }
    }

    if (depth > 0) {
      value += char;
    }
  }

  return undefined;
}

function cleanLatexText(value: string) {
  return value
    .replace(/(?<!\\)%.*/g, "")
    .replace(/\\\\\s*\\(?:vspace|hspace)\*?(?:\[[^\]]*\])?\{[^{}]*\}/g, " ")
    .replace(/\\(?:vspace|hspace|addtolength|setlength)\*?(?:\[[^\]]*\])?\{[^{}]*\}(?:\{[^{}]*\})?/g, " ")
    .replace(/\\(?:quad|qquad|hfill|fill|raggedright|raggedbottom|scshape|urlstyle)\b(?:\{[^{}]*\})?/g, " ")
    .replace(/\\(?:textbar)\{\}/g, "|")
    .replace(/\\\\/g, " | ")
    .replace(/\$?\s*\|\s*\$?/g, " | ")
    .replace(/\\textcolor\{[^{}]*\}/g, "")
    .replace(/\\href(?:\[[^\]]*\])?\{(?:[^{}]|\{[^{}]*\})*\}\{((?:[^{}]|\{[^{}]*\})*)\}/g, "$1")
    .replace(/\\(?:textbf|textit|emph|small|large|Large|LARGE|huge|Huge|techstack)\{((?:[^{}]|\{[^{}]*\})*)\}/g, "$1")
    .replace(/\\(?:textbackslash|textasciitilde|textasciicircum)\{\}/g, "")
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?/g, "")
    .replace(/\\([&%$#_{}])/g, "$1")
    .replace(/\\\s+/g, " ")
    .replace(/[{}]/g, "")
    .replace(/\s+([:,.])/g, "$1")
    .replace(/\s*\|\s*/g, " | ")
    .replace(/\s+/g, " ")
    .replace(/\s+\|\s+/g, " | ")
    .replace(/(?:^|\s)\|(?:\s*$|$)/g, " ")
    .trim();
}

function isInvisibleLatexLine(line: string) {
  return (
    line.startsWith("%") ||
    /^\\(?:documentclass|usepackage|titleformat|titlespacing|setlist|newcommand|renewcommand|input|pagestyle|fancyhf|urlstyle|raggedbottom|raggedright|setlength|addtolength)\b/.test(
      line,
    ) ||
    /^\\(?:color|vspace|hspace)\b/.test(line) ||
    /^\\(?:begin|end)\{(?:document|itemize|center)\}/.test(line) ||
    /^\\resume(?:ItemList|SubHeadingList|AchievementList)(?:Start|End)/.test(line)
  );
}

function isLikelyDefinitionText(line: string) {
  return /^\\[a-zA-Z]+/.test(line) && cleanLatexText(line).length === 0;
}

function replaceVisibleLatexLine(
  source: string,
  suggestedText: string,
  options?: { useTechStackCommand?: boolean },
) {
  const indent = source.match(/^\s*/)?.[0] ?? "";
  const trimmed = source.trim();
  const cleanSuggestion = stripLatexCommandWrapper(stripSuggestionBullet(suggestedText));
  const text = escapeLatexText(cleanSuggestion);
  const normalizedTechStack = escapeLatexText(stripTechStackLabel(cleanSuggestion));
  const projectHeading = parseCommand(trimmed, "resumeProjectHeading");

  if (projectHeading) {
    return `${indent}\\resumeProjectHeading{${escapeLatexText(
      stripLabelPrefix(cleanSuggestion),
    )}}{${escapeLatexText(
      projectHeading.args[1] ?? "",
    )}}`;
  }

  const subheading = parseCommand(trimmed, "resumeSubheading");

  if (subheading) {
    const headingOnly = extractSubheadingName(cleanSuggestion, subheading.args);
    return `${indent}\\resumeSubheading{${escapeLatexText(
      headingOnly,
    )}}{${escapeLatexText(
      subheading.args[1] ?? "",
    )}}{${escapeLatexText(subheading.args[2] ?? "")}}{${escapeLatexText(
      subheading.args[3] ?? "",
    )}}`;
  }

  const subItem = parseCommand(trimmed, "resumeSubItem");

  if (subItem) {
    const labelValue = splitSuggestedLabelValue(cleanSuggestion);
    const originalLabel = cleanLatexText(subItem.args[0] ?? "");
    const nextLabel = labelValue?.label || originalLabel;
    const nextValue = labelValue?.value || cleanSuggestion;

    return `${indent}\\resumeSubItem{${escapeLatexText(nextLabel)}}{${escapeLatexText(nextValue)}}`;
  }

  if (parseCommand(trimmed, "resumeItemNoBullet")) {
    return `${indent}\\resumeItemNoBullet{${text}}`;
  }

  if (parseCommand(trimmed, "techstack")) {
    return `${indent}\\techstack{${normalizedTechStack}}`;
  }

  if (parseCommand(trimmed, "resumeItem")) {
    const resumeItem = parseCommand(trimmed, "resumeItem");
    const isTechStackLine = (resumeItem?.args[0] ?? "")
      .replace(/\\textbf\{([^{}]*)\}/g, "$1")
      .toLowerCase()
      .includes("tech stack");

    if (isTechStackLine && options?.useTechStackCommand) {
      return `${indent}\\techstack{${normalizedTechStack}}`;
    }

    if (isTechStackLine) {
      return `${indent}\\resumeItem{\\textbf{Tech Stack:} ${normalizedTechStack}}`;
    }

    return `${indent}\\resumeItem{${text}}`;
  }

  if (/^\\item\b/.test(trimmed)) {
    return `${indent}\\item ${text}`;
  }

  return `${indent}${text}`;
}

function createInsertedLatexLine(
  source: string,
  suggestedText: string,
  sectionTitle?: string,
  options?: { useTechStackCommand?: boolean; useProjectHeadingCommand?: boolean; useNoBulletItems?: boolean; hasXcolor?: boolean },
) {
  const indent = source.match(/^\s*/)?.[0] ?? "";
  const trimmed = source.trim();
  const strippedText = stripLatexCommandWrapper(stripSuggestionBullet(suggestedText));
  const projectSuggestion = parseProjectSuggestion(strippedText);

  if (sectionTitle?.toLowerCase().includes("project") && projectSuggestion) {
    return buildProjectLatexBlock({
      heading: projectSuggestion.heading,
      explanation: projectSuggestion.detail,
      techStack: projectSuggestion.tech,
      link: projectSuggestion.link,
      fromDate: projectSuggestion.dates,
      toDate: "",
    }, options);
  }

  if (options?.useTechStackCommand && /^tech stack\s*:/i.test(strippedText)) {
    return `${indent}\\techstack{${escapeLatexText(stripTechStackLabel(strippedText))}}`;
  }

  const text = escapeLatexText(strippedText);

  if (
    /^\\item\b/.test(trimmed) ||
    parseCommand(trimmed, "resumeItem") ||
    parseCommand(trimmed, "resumeSubheading") ||
    parseCommand(trimmed, "resumeProjectHeading")
  ) {
    return `${indent}\\resumeItem{${text}}`;
  }

  if (parseCommand(trimmed, "resumeItemNoBullet")) {
    return `${indent}\\resumeItemNoBullet{${text}}`;
  }

  return `${indent}${text}`;
}

function stripSuggestionBullet(value: string) {
  return value.replace(/^(?:[-*]|\u2022)\s*/, "").trim();
}

function stripLatexCommandWrapper(value: string): string {
  const trimmed = value.trim();

  for (const command of visibleCommandNames) {
    const parsed = parseCommand(trimmed, command);
    if (!parsed) continue;

    const expectedArgCount = visibleCommandArgCounts[command];
    const args = parsed.args.map((arg) => cleanLatexText(arg));

    if (command === "resumeSubItem" && args.length >= 2) {
      return `${args[0]}: ${args[1]}`;
    }
    if (command === "resumeSubheading" && args.length >= 1) {
      return args[0];
    }
    if (command === "resumeProjectHeading" && args.length >= 1) {
      return args[0];
    }
    if (expectedArgCount === 1 && args.length >= 1) {
      return args[0];
    }
    if (args.length >= 1) {
      return args[0];
    }
  }

  return value;
}

function extractSubheadingName(suggestion: string, originalArgs: string[]): string {
  const originalRight = cleanLatexText(originalArgs[1] ?? "");
  const originalSub = cleanLatexText(originalArgs[2] ?? "");
  const originalDate = cleanLatexText(originalArgs[3] ?? "");

  let result = suggestion;

  for (const fragment of [originalRight, originalSub, originalDate]) {
    if (!fragment) continue;
    const escaped = fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`\\s*[-|,]?\\s*${escaped}\\s*`, "gi"), " ");
  }

  result = result
    .replace(/\s*\([^)]*\)\s*$/g, " ")
    .replace(/\s*[-|]+\s*(?:[\w,.\s]+\s*[-|]+\s*)*$/g, "")
    .replace(/\s*[-|]+\s*$/, "")
    .trim();

  return result || stripLabelPrefix(suggestion);
}

function stripLabelPrefix(value: string) {
  return value.replace(/^[^:]{2,48}:\s+/, "").trim();
}

function splitSuggestedLabelValue(value: string) {
  const match = value.match(/^([^:]{2,64}):\s*(.+)$/);

  if (!match) {
    return undefined;
  }

  return {
    label: match[1].trim(),
    value: match[2].trim(),
  };
}

function parseProjectSuggestion(value: string) {
  if (!/^project\s*\|/i.test(value.trim())) {
    return undefined;
  }

  const afterPrefix = value.trim().replace(/^project\s*\|\s*/i, "");
  const parts = afterPrefix.split("|");
  const fields: Record<string, string> = {};

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    const separatorIndex = part.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const key = part.slice(0, separatorIndex).trim().toLowerCase();

    if (key === "detail") {
      // detail is always the last field and may contain | characters in bullet text
      const detailValue = [
        part.slice(separatorIndex + 1),
        ...parts.slice(i + 1),
      ].join("|").trim();
      fields.detail = detailValue;
      break;
    }

    const fieldValue = part.slice(separatorIndex + 1).trim();

    if (key && fieldValue) {
      fields[key] = fieldValue;
    }
  }

  if (!fields.heading || !fields.detail || !fields.tech) {
    return undefined;
  }

  return {
    heading: fields.heading,
    dates: fields.dates ?? "",
    tech: fields.tech,
    detail: fields.detail,
    link: fields.link ?? "",
  };
}

function isProjectReplacementFormat(text: string) {
  const normalized = text.trim().toLowerCase();
  return (
    /^project\s*\|/.test(normalized) &&
    normalized.includes("heading:") &&
    normalized.includes("detail:")
  );
}

function stripTechStackLabel(value: string) {
  return value.replace(/^tech stack\s*:\s*/i, "").trim();
}

function normalizeProjectLink(value: string) {
  const normalized = value.trim().replace(/\s+/g, "");
  return normalized;
}

function buildHeadingWithLink(heading: string, link: string, options?: { hasXcolor?: boolean }) {
  if (!link) {
    return heading;
  }

  const escapedUrl = escapeLatexHref(link);
  const linkText = inferLinkText(link);

  if (options?.hasXcolor !== false) {
    return `${heading}\\hspace{0.1cm} \\textcolor{blue}{\\href{${escapedUrl}}{\\textit{\\small ${linkText}}}}`;
  }

  return `${heading}\\hspace{0.1cm} \\href{${escapedUrl}}{\\textit{\\small ${linkText}}}`;
}

function inferLinkText(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("github.com") || lower.includes("github.io")) return "GitHub";
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "Video";
  if (lower.includes("drive.google.com")) return "Certificate";
  if (lower.includes("vercel.app") || lower.includes("netlify.app") || lower.includes("herokuapp.com")) return "Live";
  if (lower.includes("canva.com") || lower.includes("figma.com")) return "Demo";
  return "Link";
}

function escapeLatexHref(value: string) {
  return value.replace(/\\/g, "/").replace(/([%#{}])/g, "\\$1");
}

function shouldUseTechStackCommand(latex: string) {
  return /\\(?:re)?newcommand\{\\techstack\}/.test(latex) || /\\techstack\{/.test(latex);
}

function hasProjectHeadingCommand(latex: string) {
  return (
    /\\(?:re)?newcommand\{\\resumeProjectHeading\}/.test(latex) ||
    /\\resumeProjectHeading\{/.test(latex)
  );
}

function usesNoBulletInProjects(latex: string) {
  return /\\(?:re)?newcommand\{\\resumeItemNoBullet\}/.test(latex);
}

function hasXcolorPackage(latex: string) {
  return /\\usepackage(?:\[.*?\])?\{xcolor\}/.test(latex) || /\\textcolor\{/.test(latex);
}

function formatProjectDateRange(project: ProjectDraft) {
  const fromDate = project.fromDate.trim();
  const toDate = project.toDate.trim();

  if (fromDate && toDate) {
    return `${fromDate} -- ${toDate}`;
  }

  return fromDate || toDate || "Present";
}

function findNextSectionIndex(lines: string[], startIndex: number) {
  const index = lines.findIndex(
    (line, currentIndex) =>
      currentIndex >= startIndex && /^\\section\*?\{/.test(line.trim()),
  );

  return index === -1 ? lines.length : index;
}

function findLastIndexInRange(
  lines: string[],
  startIndex: number,
  endIndex: number,
  predicate: (line: string) => boolean,
) {
  for (let index = endIndex - 1; index >= startIndex; index -= 1) {
    if (predicate(lines[index])) {
      return index;
    }
  }

  return -1;
}

function findProjectInsertionIndex(lines: string[], targetIndex: number) {
  const sectionEndIndex = findNextSectionIndex(lines, targetIndex + 1);

  for (let index = targetIndex + 1; index < sectionEndIndex; index += 1) {
    if (lines[index].trim() === "\\resumeItemListEnd") {
      return index + 1;
    }
  }

  return targetIndex + 1;
}

function replaceProjectBlockInLatex(
  lines: string[],
  targetIndex: number,
  projectSuggestion: NonNullable<ReturnType<typeof parseProjectSuggestion>>,
  options?: { useTechStackCommand?: boolean; useProjectHeadingCommand?: boolean; useNoBulletItems?: boolean; hasXcolor?: boolean },
) {
  const projectStartIndex = findProjectBlockStart(lines, targetIndex);

  if (projectStartIndex === -1) {
    lines.splice(
      targetIndex,
      1,
      buildProjectLatexBlock(
        {
          heading: projectSuggestion.heading,
          explanation: projectSuggestion.detail,
          techStack: projectSuggestion.tech,
          link: projectSuggestion.link,
          fromDate: projectSuggestion.dates,
          toDate: "",
        },
        options,
      ),
    );
    return lines;
  }

  const projectEndIndex = findProjectBlockEnd(lines, projectStartIndex);
  const replacementBlock = buildProjectLatexBlock(
    {
      heading: projectSuggestion.heading,
      explanation: projectSuggestion.detail,
      techStack: projectSuggestion.tech,
      link: projectSuggestion.link,
      fromDate: projectSuggestion.dates,
      toDate: "",
    },
    options,
  );

  lines.splice(
    projectStartIndex,
    Math.max(1, projectEndIndex - projectStartIndex),
    replacementBlock,
  );

  return lines;
}

function findProjectBlockStart(lines: string[], targetIndex: number) {
  for (let index = targetIndex; index >= 0; index -= 1) {
    const trimmed = lines[index].trim();

    if (/^\\section\*?\{/.test(trimmed)) {
      return -1;
    }

    if (/^\\(?:resumeSubheading|resumeProjectHeading)\b/.test(trimmed)) {
      return index;
    }
  }

  return -1;
}

function findProjectBlockEnd(lines: string[], projectStartIndex: number) {
  for (let index = projectStartIndex + 1; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();

    if (
      /^\\(?:resumeSubheading|resumeProjectHeading)\b/.test(trimmed) ||
      /^\\section\*?\{/.test(trimmed) ||
      trimmed === "\\resumeSubHeadingListEnd"
    ) {
      return index;
    }
  }

  return lines.length;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
