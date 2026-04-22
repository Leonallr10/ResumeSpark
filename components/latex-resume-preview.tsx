"use client";

import { forwardRef } from "react";

import type { ResumeLine, ResumeSection } from "@/types/resume";

const A4_PAGE_WIDTH_PX = 793.7;
const A4_PAGE_HEIGHT_PX = 1122.5;
const DEFAULT_A4_MARGIN_PX = 96;
const MIN_PREVIEW_MARGIN_PX = 28;
const MIN_PREVIEW_VERTICAL_MARGIN_PX = 20;
const PAGE_BREAK_TOLERANCE_PX = 28;

type ResumePreviewProps = {
  pages: PaginatedPreviewPage[];
  layout: PreviewLayoutProfile;
  zoom: number;
  onNavigateToSource?: (selection: ResumePreviewSelection) => void;
};

export type ResumePreviewSelection = {
  line?: ResumeLine;
  section: ResumeSection;
  page: number;
};

export const ResumePreview = forwardRef<HTMLDivElement, ResumePreviewProps>(
  function ResumePreviewInner({ pages, layout, zoom, onNavigateToSource }, ref) {
    const zoomScale = zoom / 100;

    return (
      <div ref={ref} className="w-max min-w-full">
        <div className="space-y-6 py-1">
          {pages.map((page, index) => (
            <div
              key={page.id}
              data-preview-page={index + 1}
              className="flex justify-start"
              style={{ height: `${layout.pageHeightPx * zoomScale}px` }}
            >
              <div
                className="resume-page resume-preview-page"
                style={{
                  width: `${layout.pageWidthPx}px`,
                  height: `${layout.pageHeightPx}px`,
                  transform: `scale(${zoomScale})`,
                  transformOrigin: "top left",
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
  onNavigateToSource,
}: {
  section: ResumeSection;
  showHeading?: boolean;
  pageNumber: number;
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
          <h1 className="text-[1.55rem] font-normal uppercase leading-none tracking-[0.18em]">
            {nameLine.text}
          </h1>
        ) : null}
        {locationLine ? (
          <p className="mt-0.5 text-[11px] leading-[1.15] text-slate-900">
            {locationLine.text}
          </p>
        ) : null}
        {contacts.length > 0 ? (
          <div className="mx-auto mt-0.5 flex max-w-[720px] flex-wrap justify-center gap-x-2 gap-y-0 text-[9px] leading-[1.1] text-slate-900">
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
        <div className="mb-1.5 flex items-center gap-2 border-b border-slate-900 pb-[2px]">
          {canNavigateToSection ? (
            <button
              type="button"
              className="rounded-sm text-[0.69rem] font-bold uppercase tracking-normal hover:text-slate-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-500"
              onClick={() =>
                onNavigateToSource?.({
                  line: firstLine,
                  section,
                  page: pageNumber,
                })
              }
              title="Jump to this section in LaTeX source"
            >
              {section.title}
            </button>
          ) : (
            <h2 className="text-[0.69rem] font-bold uppercase tracking-normal">
              {section.title}
            </h2>
          )}
        </div>
      ) : null}
      <div className="space-y-1">
        {section.lines.map((line) => (
          <PreviewLine
            key={line.id}
            line={line}
            section={section}
            pageNumber={pageNumber}
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
  onNavigateToSource,
}: {
  line: ResumeLine;
  section: ResumeSection;
  pageNumber: number;
  onNavigateToSource?: (selection: ResumePreviewSelection) => void;
}) {
  const labelValue = splitLabelValue(line.text);
  const canNavigate =
    Boolean(onNavigateToSource) &&
    (typeof line.sourceLine === "number" || typeof line.sourceEndLine === "number");
  const content =
    line.kind === "projectHeading" || line.kind === "subheading" ? (
      <div>
        <div className="flex items-start justify-between gap-4 text-[0.64rem]">
          <strong>{line.text}</strong>
          {line.rightText ? (
            <span className="shrink-0 text-right text-[10px] font-semibold text-slate-700">
              {line.rightText}
            </span>
          ) : null}
        </div>
        {line.secondaryText ? (
          <p className="text-[10px] italic leading-[1.2] text-slate-700">{line.secondaryText}</p>
        ) : null}
      </div>
    ) : line.kind === "bullet" ? (
      <div className="grid grid-cols-[12px_minmax(0,1fr)] gap-1 text-[11px] leading-[1.3]">
        <span className="pt-[1px]">-</span>
        <p>{line.text}</p>
      </div>
    ) : labelValue ? (
      <p className="text-[11px] leading-[1.3]">
        <strong>{labelValue.label}:</strong> {labelValue.value}
      </p>
    ) : (
      <p className="text-[11px] leading-[1.3]">{line.text}</p>
    );

  return (
    <div className="break-inside-avoid">
      {canNavigate ? (
        <button
          type="button"
          className="w-full rounded-sm text-left hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-500"
          onClick={() =>
            onNavigateToSource?.({
              line,
              section,
              page: pageNumber,
            })
          }
          title="Jump to this line in LaTeX source"
        >
          {content}
        </button>
      ) : (
        content
      )}
    </div>
  );
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
      const sectionHeight = estimateHeaderSectionHeight(section);

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

    const sectionHeadingHeight = 26;
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
      const lineHeight = estimatePreviewLineHeight(line, layout);
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

function estimateHeaderSectionHeight(section: ResumeSection) {
  const lineCount = section.lines.length;
  return 66 + Math.max(0, lineCount - 3) * 10;
}

function estimatePreviewLineHeight(line: ResumeLine, layout: PreviewLayoutProfile) {
  const bodyWidth = layout.contentWidthPx;
  const mainText = line.text ?? "";
  const wrappedRows = estimateWrappedRows(
    mainText,
    line.kind === "bullet" ? bodyWidth - 16 : bodyWidth,
  );

  if (line.kind === "bullet") {
    return wrappedRows * 15 + 4;
  }

  if (line.kind === "projectHeading" || line.kind === "subheading") {
    const secondaryRows = line.secondaryText
      ? estimateWrappedRows(line.secondaryText, bodyWidth - 10)
      : 0;
    return 18 + secondaryRows * 12 + 5;
  }

  return wrappedRows * 15 + 4;
}

function estimateWrappedRows(text: string, availableWidthPx: number) {
  const clean = text.trim();

  if (!clean) {
    return 1;
  }

  const charsPerRow = Math.max(20, Math.floor(availableWidthPx / 5.6));
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
