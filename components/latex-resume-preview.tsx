"use client";

import { forwardRef, type ReactNode } from "react";

import type { ResumeLine, ResumeSection } from "@/types/resume";

const A4_PAGE_WIDTH_PX = 793.7;
const A4_PAGE_HEIGHT_PX = 1122.5;
const DEFAULT_A4_MARGIN_PX = 96;
const MIN_PREVIEW_MARGIN_PX = 28;
const MIN_PREVIEW_VERTICAL_MARGIN_PX = 20;
/** Allow fitting a bit past the estimator so pagination matches tighter browser layout. */
const PAGE_BREAK_TOLERANCE_PX = 40;

export type PreviewFontSizes = {
  headerNamePt: number;
  sectionPt: number;
  subheadingPt: number;
  projectHeadingPt: number;
  bulletItemPt: number;
  normalTextPt: number;
};

export const DEFAULT_PREVIEW_FONT_SIZES: PreviewFontSizes = {
  headerNamePt: 25,
  sectionPt: 12,
  subheadingPt: 11,
  projectHeadingPt: 11,
  bulletItemPt: 10,
  normalTextPt: 11,
};

function ptToPx(pt: number): number {
  return pt;
}

type ResumePreviewProps = {
  pages: PaginatedPreviewPage[];
  layout: PreviewLayoutProfile;
  zoom: number;
  fontSizes?: PreviewFontSizes;
  onNavigateToSource?: (selection: ResumePreviewSelection) => void;
};

export type ResumePreviewSelection = {
  line?: ResumeLine;
  section: ResumeSection;
  page: number;
};

export const ResumePreview = forwardRef<HTMLDivElement, ResumePreviewProps>(
  function ResumePreviewInner({ pages, layout, zoom, fontSizes, onNavigateToSource }, ref) {
    const zoomScale = zoom / 100;
    const fs = fontSizes ?? DEFAULT_PREVIEW_FONT_SIZES;

    return (
      <div ref={ref} className="w-max min-w-full">
        <div className="space-y-6 py-1">
          {pages.map((page, index) => (
            <div
              key={page.id}
              data-preview-page={index + 1}
              className="flex justify-center"
              style={{ height: `${layout.pageHeightPx * zoomScale}px` }}
            >
              <div
                className="resume-page resume-preview-page"
                style={{
                  width: `${layout.pageWidthPx}px`,
                  height: `${layout.pageHeightPx}px`,
                  transform: `scale(${zoomScale})`,
                  transformOrigin: "top center",
                }}
              >
                <div
                  style={{
                    paddingTop: `${layout.marginTopPx}px`,
                    paddingBottom: `${layout.marginBottomPx}px`,
                    paddingLeft: `${layout.marginXpx}px`,
                    paddingRight: `${layout.marginXpx}px`,
                  }}
                >
                  {page.sections.map((section) => (
                    <PreviewSection
                      key={section.id}
                      section={section}
                      showHeading={section.showHeading}
                      pageNumber={index + 1}
                      fontSizes={fs}
                      onNavigateToSource={onNavigateToSource}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
);

ResumePreview.displayName = "ResumePreview";

function PreviewSection({
  section,
  showHeading = true,
  pageNumber,
  fontSizes,
  onNavigateToSource,
}: {
  section: ResumeSection;
  showHeading?: boolean;
  pageNumber: number;
  fontSizes: PreviewFontSizes;
  onNavigateToSource?: (selection: ResumePreviewSelection) => void;
}) {
  const firstLine = section.lines[0];
  const canNavigateToSection =
    Boolean(onNavigateToSource) &&
    Boolean(firstLine) &&
    (typeof firstLine?.sourceLine === "number" || typeof firstLine?.sourceEndLine === "number");

  if (section.title === "Header") {
    const [nameLine, locationLine, ...contactLines] = section.lines;
    const contacts = contactLines
      .map((line) => formatHeaderContact(line.text))
      .filter(Boolean);

    return (
      <header className="mb-2 text-center">
        {nameLine ? (
          <h1
            className="font-normal uppercase leading-none tracking-[0.18em]"
            style={{ fontSize: `${ptToPx(fontSizes.headerNamePt)}px` }}
          >
            {nameLine.text}
          </h1>
        ) : null}
        {locationLine ? (
          <p
            className="mt-0.5 leading-[1.15] text-slate-900"
            style={{ fontSize: `${ptToPx(fontSizes.normalTextPt)}px` }}
          >
            {locationLine.text}
          </p>
        ) : null}
        {contacts.length > 0 ? (
          <div
            className="mx-auto mt-0.5 flex max-w-[720px] flex-wrap justify-center gap-x-2 gap-y-0 leading-[1.1] text-slate-900"
            style={{ fontSize: `${ptToPx(fontSizes.normalTextPt) - 2}px` }}
          >
            {contacts.map((contact, index) => (
              <span key={`${contact}-${index}`} className="break-all">
                {index > 0 ? " | " : ""}
                {contact}
              </span>
            ))}
          </div>
        ) : null}
      </header>
    );
  }

  return (
    <section className="mb-3 break-inside-avoid">
      {showHeading ? (
        <div className="mb-1.5 flex items-center gap-3 pb-[2px]">
          <h2
            className={`shrink-0 font-bold uppercase leading-none tracking-normal ${
              canNavigateToSection ? "cursor-pointer" : ""
            }`}
            style={{ fontSize: `${ptToPx(fontSizes.sectionPt)}px` }}
            onClick={() =>
              canNavigateToSection
                ? onNavigateToSource?.({
                    line: firstLine,
                    section,
                    page: pageNumber,
                  })
                : undefined
            }
            onKeyDown={(event) => {
              if (!canNavigateToSection) {
                return;
              }

              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onNavigateToSource?.({
                  line: firstLine,
                  section,
                  page: pageNumber,
                });
              }
            }}
            tabIndex={canNavigateToSection ? 0 : undefined}
            role={canNavigateToSection ? "button" : undefined}
            title={canNavigateToSection ? "Jump to this section in LaTeX source" : undefined}
          >
            {section.title}
          </h2>
          <span className="h-px min-w-6 flex-1 bg-slate-900" aria-hidden />
        </div>
      ) : null}
      <div className="space-y-1">
        {section.lines.map((line) => (
          <PreviewLine
            key={line.id}
            line={line}
            section={section}
            pageNumber={pageNumber}
            fontSizes={fontSizes}
            onNavigateToSource={onNavigateToSource}
          />
        ))}
      </div>
    </section>
  );
}

function PreviewLine({
  line,
  section,
  pageNumber,
  fontSizes,
  onNavigateToSource,
}: {
  line: ResumeLine;
  section: ResumeSection;
  pageNumber: number;
  fontSizes: PreviewFontSizes;
  onNavigateToSource?: (selection: ResumePreviewSelection) => void;
}) {
  const labelValue = splitLabelValue(line.text);
  const canNavigate =
    Boolean(onNavigateToSource) &&
    (typeof line.sourceLine === "number" || typeof line.sourceEndLine === "number");
  const renderedText = renderLineText(line);

  const headingPx = line.kind === "projectHeading"
    ? ptToPx(fontSizes.projectHeadingPt)
    : ptToPx(fontSizes.subheadingPt);
  const bulletPx = ptToPx(fontSizes.bulletItemPt);

  const content =
    line.kind === "projectHeading" || line.kind === "subheading" ? (
      <div>
        <div className="flex items-start justify-between gap-4" style={{ fontSize: `${headingPx}px` }}>
          <strong>{renderedText}</strong>
          {line.rightText ? (
            <span className="shrink-0 text-right font-semibold text-slate-700" style={{ fontSize: `${headingPx - 1}px` }}>
              {line.rightText}
            </span>
          ) : null}
        </div>
        {line.secondaryText ? (
          <p className="italic leading-[1.2] text-slate-700" style={{ fontSize: `${headingPx - 1}px` }}>{line.secondaryText}</p>
        ) : null}
      </div>
    ) : line.kind === "bullet" ? (
      <div className="grid grid-cols-[12px_minmax(0,1fr)] gap-1 leading-[1.3]" style={{ fontSize: `${bulletPx}px` }}>
        <span className="pt-[1px]">-</span>
        <p>{renderedText}</p>
      </div>
    ) : labelValue ? (
      <p className="leading-[1.3]" style={{ fontSize: `${bulletPx}px` }}>
        <strong>{labelValue.label}:</strong> {labelValue.value}
      </p>
    ) : (
      <p className="leading-[1.3]" style={{ fontSize: `${bulletPx}px` }}>{renderedText}</p>
    );

  return (
    <div
      className={`break-inside-avoid ${canNavigate ? "cursor-pointer" : ""}`}
      onClick={() =>
        canNavigate
          ? onNavigateToSource?.({
              line,
              section,
              page: pageNumber,
            })
          : undefined
      }
      onKeyDown={(event) => {
        if (!canNavigate) {
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onNavigateToSource?.({
            line,
            section,
            page: pageNumber,
          });
        }
      }}
      tabIndex={canNavigate ? 0 : undefined}
      role={canNavigate ? "button" : undefined}
      title={canNavigate ? "Jump to this line in LaTeX source" : undefined}
    >
      {content}
    </div>
  );
}

const HREF_PATTERN =
  /\\textcolor\{blue\}\{\\href\{([^{}]*)\}\{((?:[^{}]|\{[^{}]*\})*)\}\}|\\href\{([^{}]*)\}\{((?:[^{}]|\{[^{}]*\})*)\}/g;

type LinkInfo = { label: string; url: string; isBlue: boolean };

function extractLinks(sourceText: string): LinkInfo[] {
  const links: LinkInfo[] = [];
  const regex = new RegExp(HREF_PATTERN.source, "g");
  let match: RegExpExecArray | null;

  while ((match = regex.exec(sourceText)) !== null) {
    const url = match[1] ?? match[3] ?? "";
    const rawLabel = match[2] ?? match[4] ?? "";
    const label = cleanInlineLatex(rawLabel);
    const isBlue = Boolean(match[1]);
    if (label) links.push({ label, url, isBlue });
  }

  return links;
}

function renderLineText(line: ResumeLine): ReactNode {
  const source = line.sourceText;
  if (!source) return line.text;

  const links = extractLinks(source);
  if (links.length === 0) return line.text;

  const text = line.text;
  const parts: ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  for (const link of links) {
    const idx = remaining.indexOf(link.label);
    if (idx === -1) continue;

    if (idx > 0) {
      parts.push(remaining.slice(0, idx));
    } else if (parts.length > 0) {
      parts.push(" ");
    }

    parts.push(
      <a
        key={keyIndex++}
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`italic underline ${link.isBlue ? "text-blue-600" : ""}`}
        style={{ marginLeft: 4, marginRight: 4 }}
        onClick={(e) => e.stopPropagation()}
      >
        {link.label}
      </a>,
    );

    remaining = remaining.slice(idx + link.label.length);
  }

  if (remaining) {
    parts.push(remaining);
  }

  return parts.length > 0 ? <>{parts}</> : line.text;
}

function cleanInlineLatex(text: string): string {
  return text
    .replace(/\\(?:textit|textbf|emph|small|large|Large|LARGE|techstack)\{((?:[^{}]|\{[^{}]*\})*)\}/g, "$1")
    .replace(/\\(?:hspace|vspace)\*?(?:\[[^\]]*\])?\{[^{}]*\}/g, " ")
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?/g, "")
    .replace(/\\([&%$#_{}])/g, "$1")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitLabelValue(text: string) {
  const match = text.match(/^([^:]{2,48}):\s+(.+)$/);

  if (!match) {
    return undefined;
  }

  return {
    label: match[1],
    value: match[2],
  };
}

type PaginatedPreviewSection = ResumeSection & {
  showHeading: boolean;
};

export type PaginatedPreviewPage = {
  id: string;
  sections: PaginatedPreviewSection[];
};

export type PreviewLayoutProfile = {
  pageWidthPx: number;
  pageHeightPx: number;
  marginXpx: number;
  marginTopPx: number;
  marginBottomPx: number;
  contentWidthPx: number;
  contentHeightPx: number;
};

export function paginateResumeSections(
  sections: ResumeSection[],
  layout: PreviewLayoutProfile,
  fontSizes: PreviewFontSizes = DEFAULT_PREVIEW_FONT_SIZES,
): PaginatedPreviewPage[] {
  const pages: PaginatedPreviewPage[] = [];
  let pageIndex = 1;
  let remainingHeight = layout.contentHeightPx;
  let currentPageSections: PaginatedPreviewSection[] = [];

  const pushPage = () => {
    if (currentPageSections.length === 0) {
      return;
    }

    pages.push({
      id: `preview-page-${pageIndex}`,
      sections: currentPageSections,
    });
    pageIndex += 1;
    currentPageSections = [];
    remainingHeight = layout.contentHeightPx;
  };

  sections.forEach((section) => {
    if (section.lines.length === 0) {
      return;
    }

    if (section.title === "Header") {
      const sectionHeight = estimateHeaderSectionHeight(section, fontSizes);

      if (sectionHeight > remainingHeight && currentPageSections.length > 0) {
        pushPage();
      }

      currentPageSections.push({
        ...section,
        showHeading: true,
      });
      remainingHeight -= Math.min(sectionHeight, remainingHeight);
      return;
    }

    const sectionHeadingHeight = ptToPx(fontSizes.sectionPt) + 12;
    let headingRendered = false;
    let chunkLines: ResumeLine[] = [];

    const flushChunk = () => {
      if (chunkLines.length === 0) {
        return;
      }

      currentPageSections.push({
        id: `${section.id}-p${pageIndex}-${currentPageSections.length}`,
        title: section.title,
        lines: chunkLines,
        showHeading: !headingRendered,
      });
      headingRendered = true;
      chunkLines = [];
    };

    section.lines.forEach((line) => {
      const lineHeight = estimatePreviewLineHeight(line, layout, fontSizes);
      const needsHeading = !headingRendered && chunkLines.length === 0;
      const requiredHeight = lineHeight + (needsHeading ? sectionHeadingHeight : 0);

      if (
        requiredHeight > remainingHeight + PAGE_BREAK_TOLERANCE_PX &&
        (currentPageSections.length > 0 || chunkLines.length > 0)
      ) {
        flushChunk();
        pushPage();
      }

      chunkLines.push(line);
      remainingHeight -= Math.min(requiredHeight, remainingHeight);
    });

    flushChunk();
  });

  pushPage();

  if (pages.length === 0) {
    return [{ id: "preview-page-1", sections: [] }];
  }

  return pages;
}

function estimateHeaderSectionHeight(section: ResumeSection, fontSizes: PreviewFontSizes) {
  const lineCount = section.lines.length;
  const nameHeight = ptToPx(fontSizes.headerNamePt) + 4;
  const contactLineHeight = ptToPx(fontSizes.normalTextPt) + 2;
  return nameHeight + Math.max(0, lineCount - 1) * contactLineHeight + 8;
}

function estimatePreviewLineHeight(line: ResumeLine, layout: PreviewLayoutProfile, fontSizes: PreviewFontSizes) {
  const bodyWidth = layout.contentWidthPx;
  const mainText = line.text ?? "";
  const bulletPx = ptToPx(fontSizes.bulletItemPt);
  const avgCharWidth = bulletPx * 0.56;
  const wrappedRows = estimateWrappedRows(
    mainText,
    line.kind === "bullet" ? bodyWidth - 16 : bodyWidth,
    avgCharWidth,
  );

  if (line.kind === "bullet") {
    const rowHeight = bulletPx * 1.3;
    return wrappedRows * rowHeight + 2;
  }

  if (line.kind === "projectHeading" || line.kind === "subheading") {
    const headingPx = line.kind === "projectHeading"
      ? ptToPx(fontSizes.projectHeadingPt)
      : ptToPx(fontSizes.subheadingPt);
    const secondaryRows = line.secondaryText
      ? estimateWrappedRows(line.secondaryText, bodyWidth - 10, headingPx * 0.48)
      : 0;
    return headingPx + 4 + secondaryRows * (headingPx - 1) + 3;
  }

  return wrappedRows * (bulletPx * 1.3) + 2;
}

function estimateWrappedRows(
  text: string,
  availableWidthPx: number,
  avgCharWidthPx: number = 6.2,
) {
  const clean = text.trim();

  if (!clean) {
    return 1;
  }

  const charsPerRow = Math.max(20, Math.floor(availableWidthPx / avgCharWidthPx));
  return Math.max(1, Math.ceil(clean.length / charsPerRow));
}

function formatHeaderContact(contact: string) {
  const value = contact.trim();

  if (!value) {
    return "";
  }

  const normalized = value.toLowerCase();

  if (normalized.includes("linkedin.com")) {
    return "LinkedIn";
  }

  if (normalized.includes("github.com")) {
    return "GitHub";
  }

  if (
    normalized.includes("vercel.app") ||
    normalized.includes("portfolio") ||
    normalized.includes("website")
  ) {
    return "Portfolio";
  }

  return value.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

export function derivePreviewLayoutFromLatex(latexSource: string): PreviewLayoutProfile {
  const textWidthAddInches = readAddToLengthInches(latexSource, "textwidth");
  const textHeightAddInches = readAddToLengthInches(latexSource, "textheight");
  const topMarginAddInches = readAddToLengthInches(latexSource, "topmargin");

  const marginXpx =
    textWidthAddInches > 0
      ? Math.max(
          MIN_PREVIEW_MARGIN_PX,
          Math.round(DEFAULT_A4_MARGIN_PX - textWidthAddInches * 52),
        )
      : DEFAULT_A4_MARGIN_PX;

  const baseVerticalMarginPx =
    textHeightAddInches > 0
      ? Math.max(
          MIN_PREVIEW_VERTICAL_MARGIN_PX,
          Math.round(DEFAULT_A4_MARGIN_PX - textHeightAddInches * 44),
        )
      : DEFAULT_A4_MARGIN_PX;

  const marginTopPx = Math.max(
    MIN_PREVIEW_VERTICAL_MARGIN_PX,
    Math.round(baseVerticalMarginPx + topMarginAddInches * 40),
  );
  const marginBottomPx = Math.max(MIN_PREVIEW_VERTICAL_MARGIN_PX, baseVerticalMarginPx);

  const contentWidthPx = A4_PAGE_WIDTH_PX - marginXpx * 2;
  const contentHeightPx = A4_PAGE_HEIGHT_PX - marginTopPx - marginBottomPx;

  return {
    pageWidthPx: A4_PAGE_WIDTH_PX,
    pageHeightPx: A4_PAGE_HEIGHT_PX,
    marginXpx,
    marginTopPx,
    marginBottomPx,
    contentWidthPx,
    contentHeightPx,
  };
}

function readAddToLengthInches(
  latexSource: string,
  name: "textwidth" | "textheight" | "topmargin",
) {
  const expression = new RegExp(`\\\\addtolength\\{\\\\${name}\\}\\{([^}]*)\\}`, "i");
  const match = latexSource.match(expression);

  if (!match?.[1]) {
    return 0;
  }

  const value = match[1].replace(/\s+/g, "");
  const parsed = Number.parseFloat(value.replace("in", ""));

  if (!Number.isFinite(parsed) || !value.includes("in")) {
    return 0;
  }

  return parsed;
}
