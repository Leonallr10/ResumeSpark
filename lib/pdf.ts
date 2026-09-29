"use client";

import { createId, detectSectionTitle } from "@/lib/resume";
import type { ResumeLine, ResumeLineLayout, ResumeSection } from "@/types/resume";

type PdfTextStyle = {
  fontFamily?: string;
};

type PdfFontMetadata = {
  name?: string;
  fallbackName?: string;
};

type PdfTextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
};

type PositionedTextItem = {
  text: string;
  x: number;
  baselineY: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  fontVariantCaps: "normal" | "small-caps";
};

type RawLine = {
  page: number;
  text: string;
  kind?: ResumeLine["kind"];
  secondaryText?: string;
  layout: ResumeLineLayout;
};

const SECTION_SYNONYM_MAP: Record<string, string> = {
  // summary
  summary: "Summary",
  "professional summary": "Summary",
  "career summary": "Summary",
  profile: "Summary",
  "career objective": "Summary",
  objective: "Summary",
  "about me": "Summary",
  overview: "Summary",
  "personal statement": "Summary",
  // experience
  experience: "Experience",
  "work experience": "Experience",
  "professional experience": "Experience",
  "employment history": "Experience",
  "work history": "Experience",
  career: "Experience",
  "job history": "Experience",
  internships: "Experience",
  internship: "Experience",
  // education
  education: "Education",
  "educational background": "Education",
  "academic background": "Education",
  qualifications: "Education",
  academics: "Education",
  "academic history": "Education",
  // skills
  skills: "Skills",
  "technical skills": "Skills",
  "core competencies": "Skills",
  competencies: "Skills",
  technologies: "Skills",
  "key skills": "Skills",
  expertise: "Skills",
  "skills & technologies": "Skills",
  "tools & technologies": "Skills",
  "languages & frameworks": "Skills",
  // projects
  projects: "Projects",
  "personal projects": "Projects",
  "open source": "Projects",
  "open-source projects": "Projects",
  "side projects": "Projects",
  portfolio: "Projects",
  "notable projects": "Projects",
  // certifications
  certifications: "Certifications",
  certificates: "Certifications",
  "licenses & certifications": "Certifications",
  "professional certifications": "Certifications",
  "licenses and certifications": "Certifications",
  // achievements
  achievements: "Achievements",
  "achievements & activities": "Achievements",
  "honors & awards": "Achievements",
  "awards & recognition": "Achievements",
  awards: "Achievements",
  honors: "Achievements",
  recognition: "Achievements",
  activities: "Achievements",
  "volunteer experience": "Achievements",
  publications: "Achievements",
  "extracurricular activities": "Achievements",
};

const BULLET_PATTERN = /^[\u2022\u2023\u25E6\u2043\u2219\u25CF\u25CB\u2013•\-*>●▸▷•]\s*/;

export async function extractResumeSectionsFromPdf(file: File) {
  const pdfjs = await import("pdfjs-dist");

  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const rawLines: RawLine[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const styles = content.styles as Record<string, PdfTextStyle>;
    await resolvePageFonts(page);
    const fontMetadata = getPageFontMetadata(page, Object.keys(styles));

    // 1. Extract link annotations via page.getAnnotations()
    type LinkAnnotation = { rect: number[]; url: string };
    const linkAnnotations: LinkAnnotation[] = [];
    try {
      if (typeof (page as unknown as { getAnnotations: () => Promise<unknown[]> }).getAnnotations === "function") {
        const rawAnnotations = await (page as unknown as { getAnnotations: () => Promise<Array<{
          annotationType?: number;
          subtype?: string;
          url?: string;
          unsafeUrl?: string;
          rect?: number[];
        }>> }).getAnnotations();

        for (const ann of rawAnnotations) {
          const url = ann.url || ann.unsafeUrl;
          if (url && Array.isArray(ann.rect) && ann.rect.length === 4) {
            linkAnnotations.push({ rect: ann.rect, url });
          }
        }
      }
    } catch {
      // annotations optional
    }

    const positionedItems = (content.items as unknown[])
      .filter(isPdfTextItem)
      .filter((item) => item.str.trim().length > 0)
      .map((item) => toPositionedTextItem(item, styles, fontMetadata));

    // 2. Handle multi-column layout detection and line grouping
    const pageLines = groupItemsIntoPositionedLines(positionedItems, {
      page: pageNumber,
      pageWidth: viewport.width,
      pageHeight: viewport.height,
    });

    // 3. Match annotations and detect bullets for each line
    const enrichedLines = pageLines.map((line, index) => {
      let secondaryText = line.secondaryText;
      let variant = line.layout.variant;

      // Check if line falls within any link annotation rectangle
      // In PDF coordinates: rect = [x1, y1, x2, y2] where y is from bottom
      const linePdfY = viewport.height - line.layout.y;
      for (const ann of linkAnnotations) {
        const [x1, y1, x2, y2] = ann.rect;
        const minX = Math.min(x1, x2) - 4;
        const maxX = Math.max(x1, x2) + 4;
        const minY = Math.min(y1, y2) - 4;
        const maxY = Math.max(y1, y2) + 4;

        if (
          line.layout.x + line.layout.width >= minX &&
          line.layout.x <= maxX &&
          linePdfY >= minY &&
          linePdfY <= maxY
        ) {
          secondaryText = ann.url;
          variant = "link";
          break;
        }
      }

      // Detect bullets
      const isBullet = BULLET_PATTERN.test(line.text.trim());
      const kind = isBullet ? ("bullet" as const) : line.kind;

      return {
        ...line,
        kind,
        secondaryText,
        layout: {
          ...line.layout,
          variant: variant || line.layout.variant,
          pageBackground: index === 0 ? line.layout.pageBackground : undefined,
        },
      };
    });

    rawLines.push(...enrichedLines);
  }

  return applyResumeLineTheming(groupLinesIntoSections(rawLines));
}

function looksLinkishLine(text: string) {
  return (
    /https?:\/\//i.test(text) ||
    /\bwww\.[^\s]+/i.test(text) ||
    /\S+@\S+\.\S+/.test(text)
  );
}

function applyResumeLineTheming(sections: ResumeSection[]): ResumeSection[] {
  return sections.map((section) => ({
    ...section,
    lines: section.lines.map((line, index) => {
      if (!line.layout) {
        return line;
      }

      const detected = detectSectionTitle(line.text);
      const isFirst = index === 0;
      let variant: NonNullable<ResumeLineLayout["variant"]> = "body";

      if (section.title === "Header") {
        variant = isFirst ? "headerName" : looksLinkishLine(line.text) ? "link" : "headerSub";
      } else if (isFirst && detected === section.title) {
        variant = "sectionHeading";
      }

      return {
        ...line,
        layout: {
          ...line.layout,
          variant,
          color: line.layout.color ?? "#000000",
        },
      };
    }),
  }));
}

function toPositionedTextItem(
  item: PdfTextItem,
  styles: Record<string, PdfTextStyle>,
  fontMetadata: Record<string, PdfFontMetadata>,
): PositionedTextItem {
  const [, b, , d, x, baselineY] = item.transform;
  const fontSize = Math.max(Math.hypot(b, d), item.height || 0, 1);
  const styleFamily = styles[item.fontName]?.fontFamily;
  const metadata = fontMetadata[item.fontName];
  const fontDescriptor = `${item.fontName} ${metadata?.name ?? ""} ${
    metadata?.fallbackName ?? ""
  } ${styleFamily ?? ""}`.toLowerCase();
  const family = resolvePdfFontFamily(item.fontName, styleFamily, metadata);

  const fontStyle: "normal" | "italic" =
    fontDescriptor.includes("italic") ||
    fontDescriptor.includes("oblique") ||
    /\b(cmti|cmt|lmti|lmri|cmssi|cmsl|cmslo|lmslo|lmmlo|it\d|sl\d)\b/.test(fontDescriptor)
      ? "italic"
      : "normal";
  const fontWeight =
    fontDescriptor.includes("bold") ||
    /\b(cmbx|cmbsy|cmssbx|lmbx|lmssbx|bx\d|b\d)\b/.test(fontDescriptor)
      ? 700
      : 400;
  const fontVariantCaps: PositionedTextItem["fontVariantCaps"] =
    /\b(cmcsc|lmcsc|smallcaps|small-caps)\b/.test(fontDescriptor)
      ? "small-caps"
      : "normal";

  return {
    text: item.str.trim(),
    x,
    baselineY,
    width: Math.max(item.width, 1),
    height: Math.max(item.height, fontSize),
    fontSize,
    fontFamily: family,
    fontWeight,
    fontStyle,
    fontVariantCaps,
  };
}

async function resolvePageFonts(page: unknown) {
  const pageWithOperatorList = page as {
    getOperatorList?: () => Promise<unknown>;
  };

  if (typeof pageWithOperatorList.getOperatorList !== "function") {
    return;
  }

  try {
    await pageWithOperatorList.getOperatorList();
  } catch {
    // Font metadata is a fidelity optimization; extraction can continue without it.
  }
}

function getPageFontMetadata(page: unknown, fontNames: string[]) {
  const commonObjs = (page as {
    commonObjs?: {
      get?: (id: string) => unknown;
    };
  }).commonObjs;
  const metadata: Record<string, PdfFontMetadata> = {};

  if (!commonObjs || typeof commonObjs.get !== "function") {
    return metadata;
  }

  for (const fontName of fontNames) {
    try {
      const font = commonObjs.get(fontName) as
        | {
            name?: string;
            fallbackName?: string;
          }
        | undefined;

      metadata[fontName] = {
        name: font?.name,
        fallbackName: font?.fallbackName,
      };
    } catch {
      metadata[fontName] = {};
    }
  }

  return metadata;
}

function detectPageColumnSplit(items: PositionedTextItem[], pageWidth: number): number | null {
  if (items.length < 12) return null;

  const maxBaselineY = Math.max(...items.map((it) => it.baselineY));
  // Filter out any full-width header items in the top 80pt
  const bodyBoxes = items.filter(
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
      const right = b.x + Math.max(b.width, 1);
      if (right <= candX + 4) {
        leftCount++;
        if (right > maxLeftEdge) maxLeftEdge = right;
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

function groupItemsIntoPositionedLines(
  items: PositionedTextItem[],
  pageInfo: {
    page: number;
    pageWidth: number;
    pageHeight: number;
    pageBackground?: string;
  },
): RawLine[] {
  const splitX = detectPageColumnSplit(items, pageInfo.pageWidth);

  // If multi-column detected, group header items first, then left column, then right column
  if (splitX !== null) {
    // Only items that genuinely span across the split gutter in the top portion
    const maxY = Math.max(...items.map((it) => it.baselineY));
    const headerThreshold = maxY - 75;
    const headerItems = items.filter(
      (it) =>
        it.baselineY >= headerThreshold &&
        it.x < splitX &&
        it.x + it.width > splitX + 15,
    );
    const leftColItems = items.filter(
      (it) => !headerItems.includes(it) && it.x + it.width * 0.5 <= splitX,
    );
    const rightColItems = items.filter(
      (it) => !headerItems.includes(it) && it.x + it.width * 0.5 > splitX,
    );

    const groupItems = (subset: PositionedTextItem[]) => {
      const grouped = new Map<number, PositionedTextItem[]>();
      for (const item of subset) {
        const existingY = [...grouped.keys()].find(
          (baselineY) => Math.abs(baselineY - item.baselineY) <= 3,
        );
        const key = existingY ?? item.baselineY;
        grouped.set(key, [...(grouped.get(key) ?? []), item]);
      }
      return [...grouped.entries()]
        .sort(([a], [b]) => b - a)
        .flatMap(([, lineItems]) => {
          const sortedItems = lineItems.sort((a, b) => a.x - b.x);
          return splitIntoPositionedLineSegments(sortedItems, pageInfo).map((segment) =>
            toRawLine(segment, pageInfo),
          );
        })
        .filter((line) => line.text.length > 0);
    };

    return [...groupItems(headerItems), ...groupItems(leftColItems), ...groupItems(rightColItems)];
  }

  const grouped = new Map<number, PositionedTextItem[]>();

  for (const item of items) {
    const existingY = [...grouped.keys()].find(
      (baselineY) => Math.abs(baselineY - item.baselineY) <= 3,
    );
    const key = existingY ?? item.baselineY;
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => b - a)
    .flatMap(([, lineItems]) => {
      const sortedItems = lineItems.sort((a, b) => a.x - b.x);
      return splitIntoPositionedLineSegments(sortedItems, pageInfo).map((segment) =>
        toRawLine(segment, pageInfo),
      );
    })
    .filter((line) => line.text.length > 0);
}

function splitIntoPositionedLineSegments(
  sortedItems: PositionedTextItem[],
  pageInfo: { pageWidth: number },
) {
  const segments: PositionedTextItem[][] = [];
  let active: PositionedTextItem[] = [];

  for (const item of sortedItems) {
    const previous = active[active.length - 1];
    const fontSize = previous
      ? Math.max(previous.fontSize, item.fontSize)
      : item.fontSize;
    const gap = previous ? item.x - (previous.x + previous.width) : 0;
    const isColumnGap =
      previous && gap > Math.max(fontSize * 8, pageInfo.pageWidth * 0.12);

    if (isColumnGap) {
      segments.push(active);
      active = [item];
    } else {
      active.push(item);
    }
  }

  if (active.length > 0) {
    segments.push(active);
  }

  return segments;
}

function toRawLine(
  sortedItems: PositionedTextItem[],
  pageInfo: {
    page: number;
    pageWidth: number;
    pageHeight: number;
    pageBackground?: string;
  },
): RawLine {
  const first = sortedItems[0];
  const fontSize = Math.max(...sortedItems.map((item) => item.fontSize));
  const height = Math.max(...sortedItems.map((item) => item.height), fontSize);
  const x = Math.min(...sortedItems.map((item) => item.x));
  const lastRight = Math.max(...sortedItems.map((item) => item.x + item.width));
  const text = joinLineItems(sortedItems, fontSize);
  const top = pageInfo.pageHeight - first.baselineY - fontSize * 0.92;
  const lineWidth = Math.max(lastRight - x, 1);
  const fontFamily = dominantValue(sortedItems.map((item) => item.fontFamily));
  const fontWeight = Math.max(...sortedItems.map((item) => item.fontWeight));
  const fontStyle = sortedItems.every((item) => item.fontStyle === "italic")
    ? ("italic" as const)
    : ("normal" as const);
  const fontVariantCaps = dominantValue(
    sortedItems.map((item) => item.fontVariantCaps),
  );
  const renderedTextWidth = measureBrowserTextWidth(text, {
    fontFamily,
    fontSize,
    fontStyle,
    fontVariantCaps,
    fontWeight,
  });
  const textScaleX =
    renderedTextWidth > 0 ? clamp(lineWidth / renderedTextWidth, 0.45, 1.25) : 1;

  return {
    page: pageInfo.page,
    text,
    layout: {
      pageWidth: pageInfo.pageWidth,
      pageHeight: pageInfo.pageHeight,
      pageBackground: pageInfo.pageBackground,
      x,
      y: Math.max(top, 0),
      width: Math.min(lineWidth + 2, pageInfo.pageWidth - x),
      height: Math.max(height * 1.2, fontSize * 1.3),
      fontSize,
      fontFamily,
      fontWeight,
      lineHeight: Math.max(height * 1.2, fontSize * 1.3),
      renderedTextWidth,
      textScaleX,
      textAlign: getTextAlign(x, lastRight, pageInfo.pageWidth),
      fontStyle,
      fontVariantCaps,
    },
  };
}

function joinLineItems(items: PositionedTextItem[], fontSize: number) {
  return items.reduce((line, item, index) => {
    if (index === 0) {
      return item.text;
    }

    const previous = items[index - 1];
    const gap = item.x - (previous.x + previous.width);
    const separator =
      gap > fontSize * 0.24
        ? " ".repeat(Math.min(Math.max(1, Math.round(gap / (fontSize * 0.32))), 80))
        : "";

    return `${line}${separator}${item.text}`;
  }, "");
}

function isPdfTextItem(item: unknown): item is PdfTextItem {
  if (!item || typeof item !== "object") {
    return false;
  }

  const candidate = item as Partial<PdfTextItem>;

  return (
    typeof candidate.str === "string" &&
    Array.isArray(candidate.transform) &&
    typeof candidate.width === "number" &&
    typeof candidate.height === "number" &&
    typeof candidate.fontName === "string"
  );
}

function groupLinesIntoSections(rawLines: RawLine[]): ResumeSection[] {
  const sections: ResumeSection[] = [];
  let activeSection: ResumeSection = {
    id: createId("section"),
    title: "Header",
    lines: [],
  };

  sections.push(activeSection);

  for (const rawLine of rawLines) {
    const rawTrimmed = rawLine.text.trim().replace(/[:\-]+$/g, "").toLowerCase();
    const synonymTitle = SECTION_SYNONYM_MAP[rawTrimmed];
    const sectionTitle = synonymTitle || detectSectionTitle(rawLine.text);

    if (sectionTitle && activeSection.lines.length > 0) {
      activeSection = {
        id: createId("section"),
        title: sectionTitle,
        lines: [],
      };
      sections.push(activeSection);
    }

    activeSection.lines.push({
      id: createId("line"),
      page: rawLine.page,
      sectionId: activeSection.id,
      text: rawLine.text,
      kind: rawLine.kind,
      secondaryText: rawLine.secondaryText,
      layout: rawLine.layout,
    });
  }

  return sections.filter((section) => section.lines.length > 0);
}

/**
 * Map PDF font names / pdf.js style hints to web font stacks. Unknown or internal
 * names (e.g. subset prefixes, g_d0_f1) default to a common resume sans stack so
 * the HTML overlay matches typical PDF resumes instead of falling back to monospace.
 */
function stripPdfFontSubsetPrefix(fontName: string) {
  return fontName.replace(/^[^+,]+[+]/, "").trim();
}

function resolvePdfFontFamily(
  fontName: string,
  styleFontFamily?: string,
  metadata?: PdfFontMetadata,
): string {
  const stripped = stripPdfFontSubsetPrefix(fontName);
  const metadataName = stripPdfFontSubsetPrefix(metadata?.name ?? "");
  const combined = `${stripped} ${metadataName} ${metadata?.fallbackName ?? ""} ${
    styleFontFamily ?? ""
  }`.toLowerCase();

  if (
    /\b(courier|monaco|consolas|menlo|source code|liberation mono|andale mono|ubuntu mono|fira code|jetbrains)\b/i.test(
      combined,
    )
  ) {
    return '"Courier New", Courier, monospace';
  }

  // Overleaf / TeX Live fonts often arrive as subset names such as CMR9,
  // CMBX10, CMTI10, or CMCSC10. Keep Computer Modern roman faces serif.
  if (
    /\b(cmtt|lmtt|lmmono|lmmtt)\b/i.test(combined)
  ) {
    return '"Courier New", Courier, monospace';
  }

  if (
    /\b(cmss|cmssi|cmssbx|lmss|lmsans|lmmbss|texgyreheros|tgheros|\bqhv\b|phv|nimbus sans|opensans)\b/i.test(
      combined,
    )
  ) {
    return '"Helvetica Neue", Helvetica, "Nimbus Sans", Arial, sans-serif';
  }

  if (
    /\b(cmr|cmbx|cmti|cmcsc|cmsy|cmbsy|lmr|lmroman|lmri|lmbx|lmcsc)\d*\b/i.test(
      combined,
    ) ||
    /\bcomputer modern|latin modern|cm-super\b/i.test(combined)
  ) {
    return '"Computer Modern Serif", "Latin Modern Roman", "CMU Serif", "Times New Roman", Times, serif';
  }

  const looksSerif =
    /times new|timesnr|times_roman|times-roman|\btimes\b|minion|georgia|garamond|palatino|book antiqua|baskerville|didot|bodoni|caslon|cambria|merriweather|pt serif|noto serif|charter|schoolbook|century schoolbook/i.test(
      combined,
    );

  if (looksSerif && !/\bsans\b/i.test(combined)) {
    return "Times New Roman, Times, serif";
  }

  const looksSans =
    /\b(arial|helvetica|helv|calibri|verdana|tahoma|segoe ui|segoe|roboto|lato|nunito|inter|ubuntu|open sans|fira sans|poppins|montserrat|gotham|myriad|proxima|avenir|franklin|univers|optima|san francisco|system-ui|noto sans|quicksand|raleway|work sans|ibm plex sans|karla|rubik|dejavu sans|liberation sans|aptos|century gothic|futura|neue helvetica|arialmt|helveticaneue|arial narrow|sourcesans|source sans)\b/i.test(
      combined,
    ) || /\bsans-serif\b/i.test(combined);

  if (looksSans || /\bsans\b/i.test(combined)) {
    return "Calibri, 'Segoe UI', Arial, Helvetica, sans-serif";
  }

  if (/\bserif\b/i.test(combined) && !/\bsans/i.test(combined)) {
    return "Times New Roman, Times, serif";
  }

  return "Calibri, 'Segoe UI', Arial, Helvetica, sans-serif";
}

function dominantValue<T extends string>(values: T[]): T {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return ([...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    values[0]) as T;
}

function getTextAlign(
  x: number,
  right: number,
  pageWidth: number,
): ResumeLineLayout["textAlign"] {
  const center = (x + right) / 2;
  const startsNearLeftMargin = x < pageWidth * 0.1;

  if (!startsNearLeftMargin && Math.abs(center - pageWidth / 2) < pageWidth * 0.04) {
    return "center";
  }

  if (pageWidth - right < Math.max(24, pageWidth * 0.08) && x > pageWidth * 0.45) {
    return "right";
  }

  return "left";
}

function measureFallbackWidth(text: string, fontSize: number) {
  return text.length * fontSize * 0.48;
}

function measureBrowserTextWidth(
  text: string,
  style: {
    fontFamily: string;
    fontSize: number;
    fontStyle: "normal" | "italic";
    fontVariantCaps: "normal" | "small-caps";
    fontWeight: number;
  },
) {
  if (typeof document === "undefined") {
    return measureFallbackWidth(text, style.fontSize);
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return measureFallbackWidth(text, style.fontSize);
  }

  const caps = style.fontVariantCaps === "small-caps" ? "small-caps" : "normal";
  context.font = `${style.fontStyle} ${caps} ${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;

  return context.measureText(text).width;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
