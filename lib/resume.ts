import type { AiSuggestion, ResumeLine, ResumeLineLayout, ResumeSection } from "@/types/resume";

const SECTION_ALIASES = new Map<string, string>([
  ["summary", "Summary"],
  ["professional summary", "Summary"],
  ["objective", "Summary"],
  ["career objective", "Summary"],
  ["skills", "Skills"],
  ["skills summary", "Skills Summary"],
  ["technical skills", "Skills"],
  ["core skills", "Skills"],
  ["experience", "Experience"],
  ["work experience", "Experience"],
  ["professional experience", "Experience"],
  ["employment", "Experience"],
  ["projects", "Projects"],
  ["personal projects", "Projects"],
  ["education", "Education"],
  ["certifications", "Certifications"],
  ["certification", "Certifications"],
  ["awards", "Awards"],
  ["achievements", "Achievements"],
  ["achievements and activities", "Achievements and Activities"],
]);

export function createId(prefix: string) {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${prefix}-${suffix}`;
}

export function sanitizeFilename(input: string) {
  const sanitized = input
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized || "tailored-resume";
}

export function getDownloadFilename(companyRole: string) {
  return `${sanitizeFilename(companyRole)}-resume.pdf`;
}

export function detectSectionTitle(line: string) {
  const normalized = line.trim().replace(/[:\-]+$/g, "").toLowerCase();

  if (SECTION_ALIASES.has(normalized)) {
    return SECTION_ALIASES.get(normalized);
  }

  const words = line.trim().split(/\s+/);
  const looksLikeHeading =
    words.length <= 4 &&
    line.length <= 42 &&
    /^[A-Z0-9&/\-\s]+$/.test(line.trim()) &&
    /[A-Z]/.test(line);

  return looksLikeHeading ? titleCase(line.trim()) : undefined;
}

export function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function applySuggestionToSections(
  sections: ResumeSection[],
  suggestion: AiSuggestion,
) {
  const target = findSuggestionTarget(sections, suggestion);

  if (!target) {
    return sections;
  }

  const { sectionIndex, lineIndex, line: targetLine } = target;
  const wrappedLines =
    suggestion.action === "delete"
      ? []
      : createWrappedSuggestionLines(
          targetLine,
          suggestion,
          sections[sectionIndex].lines,
        );
  const insertedIds = new Set(wrappedLines.map((line) => line.id));
  const targetLineHeight =
    wrappedLines[0]?.layout?.lineHeight ?? targetLine.layout?.lineHeight ?? 14;
  const replacedLineHeight = targetLine.layout?.lineHeight ?? targetLineHeight;
  const targetY = targetLine.layout?.y ?? 0;
  const targetPage = targetLine.page;
  const nextSections = sections.map((section, index) => {
    if (index !== sectionIndex) {
      return {
        ...section,
        lines: section.lines.map((line) => ({ ...line })),
      };
    }

    const nextLines = [...section.lines];

    if (suggestion.action === "replace") {
      nextLines.splice(lineIndex, 1, ...wrappedLines);
    }

    if (suggestion.action === "delete") {
      nextLines.splice(lineIndex, 1);
    }

    if (suggestion.action === "insert_before") {
      nextLines.splice(lineIndex, 0, ...wrappedLines);
    }

    if (suggestion.action === "insert_after") {
      nextLines.splice(lineIndex + 1, 0, ...wrappedLines);
    }

    return {
      ...section,
      lines: nextLines,
    };
  });

  const shift =
    suggestion.action === "replace"
      ? wrappedLines.length * targetLineHeight - replacedLineHeight
      : suggestion.action === "delete"
        ? -replacedLineHeight
        : wrappedLines.length * targetLineHeight;
  const shiftStartY =
    suggestion.action === "insert_before" ? targetY : targetY + targetLineHeight / 2;

  return reflowPageAfterSuggestion(
    nextSections,
    targetPage,
    shiftStartY,
    shift,
    insertedIds,
  ).filter((section) => section.lines.length > 0 || section.title === "Header");
}

export function getResumeText(sections: ResumeSection[]) {
  return sections
    .map((section) => {
      const lines = section.lines.map((line) => line.text).join("\n");
      return `${section.title}\n${lines}`.trim();
    })
    .join("\n\n");
}

function findSuggestionTarget(sections: ResumeSection[], suggestion: AiSuggestion) {
  const sectionIndex = sections.findIndex((section) => section.id === suggestion.sectionId);

  if (sectionIndex === -1) {
    return undefined;
  }

  const lineIndex = sections[sectionIndex].lines.findIndex(
    (line) => line.id === suggestion.targetLineId,
  );

  if (lineIndex === -1) {
    return undefined;
  }

  return {
    sectionIndex,
    lineIndex,
    line: sections[sectionIndex].lines[lineIndex],
  };
}

function createWrappedSuggestionLines(
  targetLine: ResumeLine,
  suggestion: AiSuggestion,
  sectionLines: ResumeLine[],
): ResumeLine[] {
  const targetLayout = targetLine.layout;
  const styleLayout =
    getSectionStyleSourceLine(targetLine, suggestion, sectionLines)?.layout ??
    targetLayout;
  const baseLayout = targetLayout
    ? getSuggestionBaseLayout(targetLayout, styleLayout)
    : undefined;
  const text = normalizeSuggestedText(targetLine.text, suggestion.suggestedText);

  if (!baseLayout) {
    return [
      {
        id: suggestion.action === "replace" ? targetLine.id : createId("line"),
        page: targetLine.page,
        sectionId: targetLine.sectionId,
        text,
        replacedText:
          suggestion.action === "replace"
            ? suggestion.originalText || targetLine.text
            : undefined,
        changeKind: getSuggestionChangeKind(suggestion),
      },
    ];
  }

  const isInsertAfter = suggestion.action === "insert_after";
  const isInsertBefore = suggestion.action === "insert_before";
  const targetLineHeight = targetLayout?.lineHeight ?? baseLayout.lineHeight;
  const startY = isInsertAfter
    ? baseLayout.y + targetLineHeight
    : isInsertBefore
      ? baseLayout.y
      : baseLayout.y;
  const wrappedTextLines = wrapSuggestedText(text, baseLayout);

  return wrappedTextLines.map((wrappedLine, index) => {
    const layout = getWrappedLineLayout(
      baseLayout,
      wrappedLine.isContinuation,
      index,
      startY,
    );

    return {
      id:
        suggestion.action === "replace" && index === 0
          ? targetLine.id
          : createId("line"),
      page: targetLine.page,
      sectionId: targetLine.sectionId,
      text: wrappedLine.text,
      replacedText:
        suggestion.action === "replace" && index === 0
          ? suggestion.originalText || targetLine.text
          : undefined,
      changeKind: getSuggestionChangeKind(suggestion),
      layout,
    };
  });
}

function getSuggestionChangeKind(suggestion: AiSuggestion): ResumeLine["changeKind"] {
  if (suggestion.action === "replace") {
    return "replace";
  }

  if (suggestion.action === "insert_before" || suggestion.action === "insert_after") {
    return "insert";
  }

  return undefined;
}

function getSectionStyleSourceLine(
  targetLine: ResumeLine,
  suggestion: AiSuggestion,
  sectionLines: ResumeLine[],
) {
  if (suggestion.action === "replace") {
    return targetLine;
  }

  const targetY = targetLine.layout?.y ?? 0;
  const bodyLines = sectionLines.filter(
    (line) =>
      line.layout &&
      line.layout.variant !== "sectionHeading" &&
      line.layout.variant !== "headerName" &&
      line.layout.variant !== "headerSub",
  );

  if (
    targetLine.layout &&
    targetLine.layout.variant !== "sectionHeading" &&
    targetLine.layout.variant !== "headerName" &&
    targetLine.layout.variant !== "headerSub"
  ) {
    return targetLine;
  }

  return bodyLines.sort((a, b) => {
    const aY = a.layout?.y ?? 0;
    const bY = b.layout?.y ?? 0;
    const aAfter = aY >= targetY ? 0 : 1;
    const bAfter = bY >= targetY ? 0 : 1;
    return aAfter - bAfter || Math.abs(aY - targetY) - Math.abs(bY - targetY);
  })[0] ?? targetLine;
}

function normalizeSuggestedText(originalText: string, suggestedText: string) {
  const normalized = suggestedText
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
  const originalBullet = originalText.match(/^([•*-]\s*)/);

  if (originalBullet && normalized && !/^[•*-]\s*/.test(normalized)) {
    return `${originalBullet[1]}${normalized}`;
  }

  const bulletPrefix = originalText.match(/^((?:\u2022|[*-])\s*)/);

  if (bulletPrefix && normalized && !/^(?:\u2022|[*-])\s*/.test(normalized)) {
    return `${bulletPrefix[1]}${normalized}`;
  }

  return normalized;
}

function getSuggestionBaseLayout(
  layout: ResumeLineLayout,
  styleLayout = layout,
): ResumeLineLayout {
  const usableRight = getUsableRightEdge(layout);
  const usableWidth = Math.max(styleLayout.width, usableRight - styleLayout.x);

  return {
    ...layout,
    x: styleLayout.x,
    width: styleLayout.textAlign === "right" ? styleLayout.width : usableWidth,
    height: styleLayout.lineHeight,
    fontSize: styleLayout.fontSize,
    fontFamily: styleLayout.fontFamily,
    fontWeight: styleLayout.fontWeight,
    lineHeight: styleLayout.lineHeight,
    textAlign: styleLayout.textAlign,
    color: styleLayout.color,
    fontStyle: styleLayout.fontStyle,
    fontVariantCaps: styleLayout.fontVariantCaps,
    variant: styleLayout.variant === "sectionHeading" ? "body" : styleLayout.variant,
    renderedTextWidth: undefined,
    textScaleX: 1,
  };
}

function wrapSuggestedText(text: string, layout: ResumeLineLayout) {
  const paragraphs = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const lines: Array<{ text: string; isContinuation: boolean }> = [];

  for (const paragraph of paragraphs) {
    lines.push(...wrapParagraph(paragraph, layout));
  }

  return lines.length > 0 ? lines : [{ text: "", isContinuation: false }];
}

function wrapParagraph(text: string, layout: ResumeLineLayout) {
  const bulletMatch = text.match(/^([•*-]\s*)(.*)$/);
  const standardBulletMatch = text.match(/^((?:\u2022|[*-])\s*)(.*)$/);
  const bulletPrefix = standardBulletMatch?.[1] ?? bulletMatch?.[1] ?? "";
  const bodyText = standardBulletMatch?.[2] ?? bulletMatch?.[2] ?? text;
  const firstLineCapacity = getApproxLineCapacity(layout.width, layout);
  const continuationWidth = bulletPrefix
    ? Math.max(layout.width - getContinuationIndent(layout), layout.fontSize * 10)
    : layout.width;
  const continuationCapacity = getApproxLineCapacity(continuationWidth, layout);
  const words = bodyText.split(/\s+/).filter(Boolean);
  const lines: Array<{ text: string; isContinuation: boolean }> = [];
  let active = bulletPrefix;
  let capacity = firstLineCapacity;

  for (const word of words) {
    const separator = active.trim().length > 0 && !active.endsWith(" ") ? " " : "";
    const candidate = `${active}${separator}${word}`;

    if (candidate.length <= capacity || active.trim().length === 0) {
      active = candidate;
      continue;
    }

    lines.push({
      text: active.trimEnd(),
      isContinuation: bulletPrefix.length > 0 && lines.length > 0,
    });
    active = word;
    capacity = continuationCapacity;
  }

  if (active.trim().length > 0 || lines.length === 0) {
    lines.push({
      text: active.trimEnd(),
      isContinuation: bulletPrefix.length > 0 && lines.length > 0,
    });
  }

  return lines;
}

function getApproxLineCapacity(width: number, layout: ResumeLineLayout) {
  const averageCharacterWidth =
    layout.fontSize * (layout.fontWeight >= 700 ? 0.6 : 0.56);

  return Math.max(18, Math.floor(width / averageCharacterWidth));
}

function getWrappedLineLayout(
  baseLayout: ResumeLineLayout,
  isContinuation: boolean,
  index: number,
  startY: number,
): ResumeLineLayout {
  const indent = isContinuation ? getContinuationIndent(baseLayout) : 0;

  return {
    ...baseLayout,
    x: baseLayout.x + indent,
    y: startY + index * baseLayout.lineHeight,
    width: Math.max(baseLayout.width - indent, baseLayout.fontSize * 10),
    height: baseLayout.lineHeight,
    renderedTextWidth: undefined,
    textScaleX: 1,
  };
}

function getContinuationIndent(layout: ResumeLineLayout) {
  return Math.max(5, layout.fontSize * 0.55);
}

function getUsableRightEdge(layout: ResumeLineLayout) {
  const rightMargin = Math.max(28, layout.pageWidth * 0.047);

  return layout.pageWidth - rightMargin;
}

function reflowPageAfterSuggestion(
  sections: ResumeSection[],
  page: number,
  startY: number,
  shift: number,
  ignoredLineIds: Set<string>,
) {
  if (Math.abs(shift) < 0.1) {
    return sections;
  }

  return sections.map((section) => ({
    ...section,
    lines: section.lines.map((line) => {
      if (
        line.page !== page ||
        !line.layout ||
        ignoredLineIds.has(line.id) ||
        line.layout.y < startY
      ) {
        return line;
      }

      return {
        ...line,
        layout: {
          ...line.layout,
          y: Math.max(0, line.layout.y + shift),
        },
      };
    }),
  }));
}
