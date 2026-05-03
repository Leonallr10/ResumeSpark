"use client";

import {
  ChangeEvent,
  CSSProperties,
  DragEvent,
  forwardRef,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  Download,
  Loader2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { LatexSuggestionPanel } from "@/components/latex-suggestion-panel";
import {
  applySuggestionToSections,
  getDownloadFilename,
} from "@/lib/resume";
import type {
  AiSuggestion,
  ResumeLine,
  ResumeLineLayout,
  ResumeSection,
  SectionReview,
  SectionReviewStatus,
  SuggestionResponse,
} from "@/types/resume";

const sectionStatusCopy: Record<SectionReviewStatus, string> = {
  strong: "Strong",
  needs_changes: "Needs changes",
  missing_jd_keywords: "Missing JD keywords",
  not_relevant: "Not relevant",
};

const PROJECT_LIMIT = 12000;
const COMPANY_ROLE_LIMIT = 300;
const JD_LIMIT = 20000;

export function ResumeTailorApp() {
  const [resumeSections, setResumeSections] = useState<ResumeSection[]>([]);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [sectionReviews, setSectionReviews] = useState<SectionReview[]>([]);
  const [project, setProject] = useState("");
  const [companyRole, setCompanyRole] = useState("");
  const [jd, setJd] = useState("");
  const [uploading, setUploading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resumeRef = useRef<HTMLDivElement>(null);

  const canSubmit =
    resumeSections.length > 0 &&
    project.trim().length > 0 &&
    project.length <= PROJECT_LIMIT &&
    companyRole.trim().length > 0 &&
    companyRole.length <= COMPANY_ROLE_LIMIT &&
    jd.trim().length > 0 &&
    jd.length <= JD_LIMIT &&
    !suggesting;

  const suggestionsByLine = useMemo(() => {
    return suggestions.reduce<Record<string, AiSuggestion[]>>((acc, suggestion) => {
      acc[suggestion.targetLineId] = [
        ...(acc[suggestion.targetLineId] ?? []),
        suggestion,
      ];
      return acc;
    }, {});
  }, [suggestions]);

  const reviewsBySection = useMemo(() => {
    return sectionReviews.reduce<Record<string, SectionReview>>((acc, review) => {
      acc[review.sectionId] = review;
      return acc;
    }, {});
  }, [sectionReviews]);

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      setError("Upload a PDF resume.");
      return;
    }

    setError(null);
    setUploading(true);
    setSuggestions([]);
    setSectionReviews([]);

    try {
      const { extractResumeSectionsFromPdf } = await import("@/lib/pdf");
      const sections = await extractResumeSectionsFromPdf(file);
      setResumeSections(sections);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to read this PDF resume.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) {
      await handleFile(file);
    }

    event.target.value = "";
  }

  async function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];

    if (file) {
      await handleFile(file);
    }
  }

  function updateLine(sectionId: string, lineId: string, text: string) {
    setResumeSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? {
            ...section,
            lines: section.lines.map((line) =>
              line.id === lineId
                ? {
                  ...line,
                  text,
                  replacedText: undefined,
                  changeKind: undefined,
                }
                : line,
            ),
          }
          : section,
      ),
    );
  }

  async function requestSuggestions() {
    if (!canSubmit) {
      return;
    }

    setError(null);
    setSuggesting(true);

    try {
      const response = await fetch("/api/resume/suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resumeSections: stripLayoutForGemini(resumeSections),
          project,
          companyRole,
          jd,
        }),
      });

      const payload = (await response.json()) as SuggestionResponse & {
        error?: string;
        details?: unknown;
      };

      if (!response.ok) {
        throw new Error(formatApiError(payload));
      }

      setSuggestions(payload.suggestions);
      setSectionReviews(payload.sectionReviews);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to generate suggestions.",
      );
    } finally {
      setSuggesting(false);
    }
  }

  function acceptSuggestion(suggestion: AiSuggestion) {
    setResumeSections((current) => applySuggestionToSections(current, suggestion));
    setSuggestions((current) => current.filter((item) => item.id !== suggestion.id));
  }

  function declineSuggestion(suggestionId: string) {
    setSuggestions((current) => current.filter((item) => item.id !== suggestionId));
  }

  function acceptAllInSection(sectionId: string) {
    const sectionSuggestions = suggestions.filter(
      (suggestion) => suggestion.sectionId === sectionId,
    );

    setResumeSections((current) =>
      sectionSuggestions.reduce(
        (next, suggestion) => applySuggestionToSections(next, suggestion),
        current,
      ),
    );
    setSuggestions((current) =>
      current.filter((suggestion) => suggestion.sectionId !== sectionId),
    );
  }

  function declineAllInSection(sectionId: string) {
    setSuggestions((current) =>
      current.filter((suggestion) => suggestion.sectionId !== sectionId),
    );
  }

  async function downloadResume() {
    const element = resumeRef.current;

    if (!element) {
      return;
    }

    setDownloading(true);
    setError(null);

    try {
      const html2pdf = (await import("html2pdf.js")).default;
      element.classList.add("resume-export");

      await html2pdf()
        .set({
          filename: getDownloadFilename(companyRole),
          margin: [8, 8, 8, 8],
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            backgroundColor: "#ffffff",
            useCORS: true,
          },
          jsPDF: {
            unit: "mm",
            format: "a4",
            orientation: "portrait",
          },
          pagebreak: { mode: ["css", "legacy"] },
        })
        .from(element)
        .save();
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Unable to download the resume.",
      );
    } finally {
      element.classList.remove("resume-export");
      setDownloading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f4f8f8_0%,#eef2f1_48%,#f7f7f4_100%)]">
      <div className="mx-auto flex min-h-screen max-w-[1680px] flex-col gap-5 px-4 py-5 lg:flex-row">
        <section className="flex min-h-[72vh] flex-1 flex-col rounded-md border bg-white/80">
          <div className="no-print flex flex-col gap-3 border-b bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-normal">Resume Tailor</h1>
              <p className="text-sm text-muted-foreground">
                Edit the resume, review AI changes, download the final version.
              </p>
            </div>
            <Button
              type="button"
              onClick={downloadResume}
              disabled={resumeSections.length === 0 || downloading}
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download
            </Button>
          </div>

          {error ? (
            <div className="no-print px-4 pt-4">
              <Alert className="border-destructive/40 bg-destructive/5">
                <AlertTitle>Something needs attention</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          ) : null}

          <ScrollArea className="flex-1 px-3 py-4 sm:px-6">
            {resumeSections.length === 0 ? (
              <UploadResumeCard
                uploading={uploading}
                onFileChange={handleFileChange}
                onDrop={handleDrop}
              />
            ) : (
              <ResumeDocument
                sections={resumeSections}
                suggestionsByLine={suggestionsByLine}
                reviewsBySection={reviewsBySection}
                onLineChange={updateLine}
                onAcceptSuggestion={acceptSuggestion}
                onDeclineSuggestion={declineSuggestion}
                ref={resumeRef}
              />
            )}
          </ScrollArea>
        </section>

        <aside className="w-full lg:w-[430px]">
          <Card className="sticky top-5">

            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="project">Project</Label>
                <Textarea
                  id="project"
                  value={project}
                  onChange={(event) => setProject(event.target.value)}
                  placeholder="Paste extra projects Gemini can use when current projects do not fit the JD."
                  className="min-h-32"
                  maxLength={PROJECT_LIMIT}
                />
                <FieldCounter value={project.length} max={PROJECT_LIMIT} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyRole">Company name with role</Label>
                <Input
                  id="companyRole"
                  value={companyRole}
                  onChange={(event) => setCompanyRole(event.target.value)}
                  placeholder="Acme - Frontend Developer"
                  maxLength={COMPANY_ROLE_LIMIT}
                />
                <FieldCounter value={companyRole.length} max={COMPANY_ROLE_LIMIT} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="jd">JD</Label>
                <Textarea
                  id="jd"
                  value={jd}
                  onChange={(event) => setJd(event.target.value)}
                  placeholder="Paste the job description here."
                  className="min-h-56"
                  maxLength={JD_LIMIT}
                />
                <FieldCounter value={jd.length} max={JD_LIMIT} />
              </div>

              <Button
                type="button"
                className="w-full"
                disabled={!canSubmit}
                onClick={requestSuggestions}
              >
                {suggesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Suggest resume changes
              </Button>

              <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                Suggestions stay editable. Accept only the changes that are true for your
                experience.
              </div>

              <LatexSuggestionPanel
                sections={resumeSections}
                suggestions={suggestions}
                sectionReviews={sectionReviews}
                onAcceptSuggestion={acceptSuggestion}
                onDeclineSuggestion={declineSuggestion}
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}

function stripLayoutForGemini(sections: ResumeSection[]): ResumeSection[] {
  return sections.map((section) => ({
    ...section,
    lines: section.lines.map((line) => ({
      id: line.id,
      page: line.page,
      sectionId: line.sectionId,
      text: line.text,
    })),
  }));
}

function formatApiError(payload: { error?: string; details?: unknown }) {
  const detail =
    typeof payload.details === "string"
      ? payload.details
      : payload.details
        ? JSON.stringify(payload.details)
        : "";

  return [payload.error ?? "Unable to generate suggestions.", detail]
    .filter(Boolean)
    .join(" ");
}

function FieldCounter({ value, max }: { value: number; max: number }) {
  const isOver = value > max;

  return (
    <p
      className={`text-right text-xs ${isOver ? "text-destructive" : "text-muted-foreground"
        }`}
    >
      {value.toLocaleString()} / {max.toLocaleString()}
    </p>
  );
}

type UploadResumeCardProps = {
  uploading: boolean;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onDrop: (event: DragEvent<HTMLLabelElement>) => Promise<void>;
};

function UploadResumeCard({
  uploading,
  onFileChange,
  onDrop,
}: UploadResumeCardProps) {
  return (
    <label
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className="mx-auto flex min-h-[560px] w-full max-w-3xl cursor-pointer flex-col items-center justify-center gap-4 rounded-md border-2 border-dashed border-primary/40 bg-white px-6 text-center transition-colors hover:border-primary"
    >
      <input
        type="file"
        accept="application/pdf"
        className="sr-only"
        onChange={onFileChange}
      />
      <div className="flex h-14 w-14 items-center justify-center rounded-md bg-primary text-primary-foreground">
        {uploading ? (
          <Loader2 className="h-7 w-7 animate-spin" />
        ) : (
          <Upload className="h-7 w-7" />
        )}
      </div>
      <div className="space-y-2">
        <p className="text-lg font-semibold">Upload resume PDF</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Drop a PDF here or choose a file. The content will become editable resume
          sections.
        </p>
      </div>
    </label>
  );
}

type ResumeDocumentProps = {
  sections: ResumeSection[];
  suggestionsByLine: Record<string, AiSuggestion[]>;
  reviewsBySection: Record<string, SectionReview>;
  onLineChange: (sectionId: string, lineId: string, text: string) => void;
  onAcceptSuggestion: (suggestion: AiSuggestion) => void;
  onDeclineSuggestion: (suggestionId: string) => void;
};

const ResumeDocument = forwardRef<HTMLDivElement, ResumeDocumentProps>(
  function ResumeDocumentInner({
    sections,
    suggestionsByLine,
    reviewsBySection,
    onLineChange,
    onAcceptSuggestion,
    onDeclineSuggestion,
  }, ref) {
    const pages = getResumePages(sections);

    return (
      <div className="space-y-5" id="resume-export" ref={ref}>
        {pages.map((page) => (
          <div
            key={page.pageNumber}
            className="resume-page resume-page-positioned"
            style={{
              width: `${page.width}px`,
              height: `${page.height}px`,
            }}
          >
            {getSectionRules(page).map((rule) => (
              <div
                key={rule.key}
                aria-hidden="true"
                className="absolute bg-black"
                style={{
                  left: `${rule.x}px`,
                  top: `${rule.y}px`,
                  width: `${rule.width}px`,
                  height: `${rule.height}px`,
                }}
              />
            ))}

            {page.lines.map(({ line, section }) => (
              <ResumeLineEditor
                key={line.id}
                line={line}
                sectionTitle={section.title}
                styleSourceLine={getLineStyleSource(section.lines, line)}
                suggestions={[]}
                onLineChange={onLineChange}
                onAcceptSuggestion={onAcceptSuggestion}
                onDeclineSuggestion={onDeclineSuggestion}
              />
            ))}
          </div>
        ))}
      </div>
    );
  },
);

ResumeDocument.displayName = "ResumeDocument";

type ResumeLineEditorProps = {
  line: ResumeLine;
  sectionTitle: string;
  styleSourceLine?: ResumeLine;
  suggestions: AiSuggestion[];
  onLineChange: (sectionId: string, lineId: string, text: string) => void;
  onAcceptSuggestion: (suggestion: AiSuggestion) => void;
  onDeclineSuggestion: (suggestionId: string) => void;
};

function ResumeLineEditor({
  line,
  sectionTitle,
  styleSourceLine,
  suggestions,
  onLineChange,
  onAcceptSuggestion,
  onDeclineSuggestion,
}: ResumeLineEditorProps) {
  const layout = line.layout ?? fallbackLayout(line, sectionTitle);
  const activeSuggestion = suggestions[0];
  const isReplacePreview = activeSuggestion?.action === "replace";
  const isInsertPreview =
    activeSuggestion?.action === "insert_before" ||
    activeSuggestion?.action === "insert_after";
  const visibleLayout = isReplacePreview
    ? getInlineReplacementLayout(layout)
    : layout;
  const lineStyle = getPositionedLineStyle(visibleLayout);
  const visibleText = isReplacePreview
    ? getPreviewSuggestionText(line.text, activeSuggestion.suggestedText)
    : line.text;
  const replacedText = isReplacePreview
    ? line.text
    : line.replacedText;
  const lineChangeKind = isReplacePreview ? "replace" : line.changeKind;

  return (
    <div
      className="group absolute"
      style={{
        left: `${layout.x}px`,
        top: `${layout.y}px`,
        width: `${layout.width}px`,
        minHeight: `${layout.height}px`,
      }}
    >
      {isInsertPreview && activeSuggestion.action === "insert_before" ? (
        <InsertedSuggestionPreview
          layout={layout}
          styleLayout={styleSourceLine?.layout}
          suggestion={activeSuggestion}
          originalText={line.text}
          placement="before"
        />
      ) : null}

      <div
        className={`editable-line rounded-sm transition-colors hover:bg-teal-50 ${lineChangeKind ? `changed-line changed-line-${lineChangeKind}` : ""
          }`}
        style={lineStyle}
        contentEditable={!isReplacePreview}
        suppressContentEditableWarning
        onBlur={(event) =>
          onLineChange(line.sectionId, line.id, event.currentTarget.innerText.trim())
        }
      >
        {visibleText}
      </div>

      {replacedText ? (
        <ReplacementHover
          layout={visibleLayout}
          replacedText={replacedText}
        />
      ) : null}

      {isInsertPreview && activeSuggestion.action === "insert_after" ? (
        <InsertedSuggestionPreview
          layout={layout}
          styleLayout={styleSourceLine?.layout}
          suggestion={activeSuggestion}
          originalText={line.text}
          placement="after"
        />
      ) : null}

      {activeSuggestion ? (
        <InlineSuggestion
          suggestion={activeSuggestion}
          hiddenCount={Math.max(suggestions.length - 1, 0)}
          layout={layout}
          onAccept={onAcceptSuggestion}
          onDecline={onDeclineSuggestion}
        />
      ) : null}
    </div>
  );
}

type ResumePage = {
  pageNumber: number;
  width: number;
  height: number;
  background?: string;
  lines: Array<{ line: ResumeLine; section: ResumeSection }>;
};

type SectionRule = {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

function getSectionRules(page: ResumePage): SectionRule[] {
  return page.lines
    .filter(({ line }) => line.layout?.variant === "sectionHeading")
    .map(({ line }) => {
      const layout = line.layout ?? fallbackLayout(line, "");
      const x = Math.min(layout.x, 18.72);
      const right = Math.max(0, layout.pageWidth - 38.88);

      return {
        key: `${line.id}-rule`,
        x,
        y: layout.y + layout.fontSize + 3.4,
        width: Math.max(0, right - x),
        height: 0.4,
      };
    });
}

function getResumePages(sections: ResumeSection[]): ResumePage[] {
  const pageMap = new Map<number, ResumePage>();

  for (const section of sections) {
    for (const line of section.lines) {
      const layout = line.layout ?? fallbackLayout(line, section.title);
      const existingPage = pageMap.get(line.page);
      const page =
        existingPage ??
        {
          pageNumber: line.page,
          width: layout.pageWidth,
          height: layout.pageHeight,
          background: layout.pageBackground,
          lines: [],
        };

      page.lines.push({ line, section });
      pageMap.set(line.page, page);
    }
  }

  return [...pageMap.values()]
    .map((page) => {
      const lines = page.lines.sort((a, b) => {
        const aLayout = a.line.layout ?? fallbackLayout(a.line, a.section.title);
        const bLayout = b.line.layout ?? fallbackLayout(b.line, b.section.title);
        return aLayout.y - bLayout.y || aLayout.x - bLayout.x;
      });
      const contentBottom = lines.reduce((bottom, { line, section }) => {
        const layout = line.layout ?? fallbackLayout(line, section.title);
        return Math.max(bottom, layout.y + layout.height);
      }, 0);

      return {
        ...page,
        height: Math.max(page.height, contentBottom + 36),
        lines,
      };
    })
    .sort((a, b) => a.pageNumber - b.pageNumber);
}

function getLineStyleSource(sectionLines: ResumeLine[], targetLine: ResumeLine) {
  const targetLayout = targetLine.layout;

  if (
    targetLayout &&
    targetLayout.variant !== "sectionHeading" &&
    targetLayout.variant !== "headerName" &&
    targetLayout.variant !== "headerSub"
  ) {
    return targetLine;
  }

  return sectionLines
    .filter(
      (line) =>
        line.layout &&
        line.layout.variant !== "sectionHeading" &&
        line.layout.variant !== "headerName" &&
        line.layout.variant !== "headerSub",
    )
    .sort((a, b) => {
      const targetY = targetLayout?.y ?? 0;
      const aY = a.layout?.y ?? 0;
      const bY = b.layout?.y ?? 0;
      const aAfter = aY >= targetY ? 0 : 1;
      const bAfter = bY >= targetY ? 0 : 1;
      return aAfter - bAfter || Math.abs(aY - targetY) - Math.abs(bY - targetY);
    })[0];
}

function getPositionedLineStyle(layout: ResumeLineLayout): CSSProperties {
  const textScaleX = layout.textScaleX ?? 1;

  return {
    width: `${layout.renderedTextWidth ?? layout.width / textScaleX}px`,
    minHeight: `${layout.height}px`,
    color: layout.color ?? "#111827",
    fontFamily: layout.fontFamily,
    fontSize: `${layout.fontSize}px`,
    fontWeight: layout.fontWeight,
    fontStyle: layout.fontStyle ?? "normal",
    fontVariantCaps: layout.fontVariantCaps ?? "normal",
    lineHeight: `${layout.lineHeight}px`,
    textAlign: layout.textAlign,
    whiteSpace: "pre",
    overflow: "visible",
    backgroundColor: "#ffffff",
    transform: Math.abs(textScaleX - 1) > 0.01 ? `scaleX(${textScaleX})` : undefined,
    transformOrigin: "left top",
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
    textRendering: "geometricPrecision",
  };
}

function getInlineReplacementLayout(layout: ResumeLineLayout): ResumeLineLayout {
  const rightMargin = Math.max(28, layout.pageWidth * 0.047);
  const usableWidth = Math.max(layout.width, layout.pageWidth - rightMargin - layout.x);

  return {
    ...layout,
    width: layout.textAlign === "right" ? layout.width : usableWidth,
    renderedTextWidth: undefined,
    textScaleX: 1,
  };
}

function mergeInsertionLayout(
  targetLayout: ResumeLineLayout,
  styleLayout: ResumeLineLayout,
): ResumeLineLayout {
  return {
    ...targetLayout,
    x: styleLayout.x,
    width: styleLayout.width,
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

function getPreviewSuggestionText(originalText: string, suggestedText: string) {
  const normalized = suggestedText
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
  const originalBullet = originalText.match(/^((?:\u2022|[*-])\s*)/);

  if (originalBullet && normalized && !/^(?:\u2022|[*-])\s*/.test(normalized)) {
    return `${originalBullet[1]}${normalized}`;
  }

  return normalized;
}

function fallbackLayout(line: ResumeLine, sectionTitle: string): ResumeLineLayout {
  const isHeader = sectionTitle === "Header";
  const fontSize = isHeader ? 12 : 10.5;

  return {
    pageWidth: 612,
    pageHeight: 792,
    x: isHeader ? 72 : 54,
    y: 54 + line.page * 18,
    width: isHeader ? 468 : 504,
    height: fontSize * 1.4,
    fontSize,
    fontFamily: "Calibri, 'Segoe UI', Arial, Helvetica, sans-serif",
    fontWeight: isHeader ? 700 : 400,
    lineHeight: fontSize * 1.4,
    textAlign: isHeader ? "center" : "left",
  };
}

type SectionReviewSummaryProps = {
  sections: ResumeSection[];
  suggestionsByLine: Record<string, AiSuggestion[]>;
  reviewsBySection: Record<string, SectionReview>;
  onAcceptAllInSection: (sectionId: string) => void;
  onDeclineAllInSection: (sectionId: string) => void;
};

function SectionReviewSummary({
  sections,
  suggestionsByLine,
  reviewsBySection,
  onAcceptAllInSection,
  onDeclineAllInSection,
}: SectionReviewSummaryProps) {
  const visibleSections = sections
    .map((section) => ({
      section,
      review: reviewsBySection[section.id],
      suggestionCount: section.lines.reduce(
        (count, line) => count + (suggestionsByLine[line.id]?.length ?? 0),
        0,
      ),
    }))
    .filter((item) => item.review || item.suggestionCount > 0);

  if (visibleSections.length === 0) {
    return null;
  }

  return (
    <div className="no-print mx-auto grid w-full max-w-[900px] gap-2">
      {visibleSections.map(({ section, review, suggestionCount }) => (
        <div
          key={section.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-white px-3 py-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{section.title}</span>
            {review ? <SectionReviewBadge review={review} /> : null}
          </div>

          {suggestionCount > 0 ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onAcceptAllInSection(section.id)}
              >
                Accept all in section
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onDeclineAllInSection(section.id)}
              >
                Decline all in section
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

type ReplacementHoverProps = {
  layout: ResumeLineLayout;
  replacedText: string;
};

type InsertedSuggestionPreviewProps = {
  layout: ResumeLineLayout;
  styleLayout?: ResumeLineLayout;
  suggestion: AiSuggestion;
  originalText: string;
  placement: "before" | "after";
};

function InsertedSuggestionPreview({
  layout,
  styleLayout,
  suggestion,
  originalText,
  placement,
}: InsertedSuggestionPreviewProps) {
  const previewLayout = getInlineReplacementLayout(
    styleLayout ? mergeInsertionLayout(layout, styleLayout) : layout,
  );
  const previewStyle = getPositionedLineStyle(previewLayout);
  const previewText = getPreviewSuggestionText(originalText, suggestion.suggestedText);

  return (
    <div
      className="no-print pointer-events-none absolute z-10 changed-line changed-line-insert rounded-sm"
      style={{
        ...previewStyle,
        left: `${previewLayout.x - layout.x}px`,
        top:
          placement === "before"
            ? `-${previewLayout.lineHeight}px`
            : `${layout.lineHeight}px`,
      }}
      title={previewText}
    >
      {previewText}
    </div>
  );
}

function ReplacementHover({ layout, replacedText }: ReplacementHoverProps) {
  return (
    <div
      className="no-print pointer-events-none absolute left-0 z-30 hidden rounded-sm border border-slate-300 bg-white px-2 py-1.5 text-left shadow-md group-hover:block group-focus-within:block"
      style={{
        top: `${layout.height + 4}px`,
        width: `${Math.min(Math.max(layout.width, 260), 520)}px`,
      }}
    >
      <p
        className="truncate text-slate-500 line-through decoration-slate-500 decoration-1"
        style={{
          fontFamily: layout.fontFamily,
          fontSize: `${Math.max(layout.fontSize, 10)}px`,
          fontStyle: layout.fontStyle ?? "normal",
          fontWeight: layout.fontWeight,
          lineHeight: `${Math.max(layout.lineHeight, layout.fontSize * 1.25)}px`,
        }}
        title={replacedText}
      >
        {replacedText}
      </p>
    </div>
  );
}

type InlineSuggestionProps = {
  suggestion: AiSuggestion;
  hiddenCount: number;
  layout: ResumeLineLayout;
  onAccept: (suggestion: AiSuggestion) => void;
  onDecline: (suggestionId: string) => void;
};

function InlineSuggestion({
  suggestion,
  hiddenCount,
  layout,
  onAccept,
  onDecline,
}: InlineSuggestionProps) {
  const previewText =
    suggestion.action === "delete"
      ? "Delete this line."
      : suggestion.suggestedText;
  const actionLabel = suggestion.action.replace("_", " ");

  return (
    <div
      className="no-print absolute z-40 flex items-center gap-1 rounded-sm border border-teal-500/35 bg-white/95 px-1.5 py-1 text-left opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      style={{
        left: `${Math.max(
          0,
          Math.min(Math.max(layout.width + 6, 28), layout.pageWidth - layout.x - 88),
        )}px`,
        top: "-2px",
      }}
      title={`${actionLabel}: ${previewText}`}
    >
      <Badge variant="default" className="rounded-sm px-1.5 py-0 text-[10px]">
        {actionLabel}
      </Badge>
      {hiddenCount > 0 ? (
        <span className="text-[10px] font-medium text-teal-800">
          +{hiddenCount}
        </span>
      ) : null}
      <Button
        type="button"
        size="sm"
        className="h-6 rounded-sm px-2 text-[11px]"
        onClick={() => onAccept(suggestion)}
        title="Accept suggestion"
      >
        <Check className="h-3 w-3" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-6 rounded-sm px-2 text-[11px]"
        onClick={() => onDecline(suggestion.id)}
        title="Decline suggestion"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

function SectionReviewBadge({ review }: { review: SectionReview }) {
  const variant =
    review.status === "strong"
      ? "default"
      : review.status === "not_relevant"
        ? "muted"
        : review.status === "missing_jd_keywords"
          ? "secondary"
          : "outline";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-white px-2 py-1">
      <Badge variant={variant}>{sectionStatusCopy[review.status]}</Badge>
      <span className="max-w-[520px] text-xs text-muted-foreground">{review.summary}</span>
    </div>
  );
}
