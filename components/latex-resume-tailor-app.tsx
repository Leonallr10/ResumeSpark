"use client";

import { StreamLanguage } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { RangeSetBuilder, StateField, type Extension, type Text } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import {
  type ChangeEvent,
  type CSSProperties,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Code2,
  Download,
  Eye,
  FileText,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
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
import { Textarea } from "@/components/ui/textarea";
import {
  applySuggestionToLatex,
  canInsertProject,
  DEFAULT_LATEX_RESUME,
  formatProjectsInput,
  hasProjectDraftContent,
  insertProjectsIntoLatex,
  parseLatexResume,
  previewSuggestionLatexLine,
  type ProjectDraft,
} from "@/lib/latex-resume";
import { getDownloadFilename, sanitizeFilename } from "@/lib/resume";
import type {
  AiSuggestion,
  ResumeLine,
  ResumeSection,
  SectionReview,
  SuggestionResponse,
} from "@/types/resume";

const PROJECT_LIMIT = 12000;
const COMPANY_ROLE_LIMIT = 300;
const JD_LIMIT = 20000;
const WORKSPACE_PANE_HEIGHT = "clamp(560px, calc(100vh - 190px), 820px)";
const MIN_EDITOR_PANE_WIDTH = 34;
const MAX_EDITOR_PANE_WIDTH = 68;
const MIN_PDF_ZOOM = 50;
const MAX_PDF_ZOOM = 200;
const PDF_ZOOM_STEP = 10;
const A4_PAGE_WIDTH_PX = 793.7;
const A4_PAGE_HEIGHT_PX = 1122.5;
const DEFAULT_A4_MARGIN_PX = 96;
const MIN_PREVIEW_MARGIN_PX = 28;
const MIN_PREVIEW_VERTICAL_MARGIN_PX = 20;
const PAGE_BREAK_TOLERANCE_PX = 28;
const latexLanguage = StreamLanguage.define(stex);
type ProjectInputMode = "form" | "json";

const emptyProjectDraft: ProjectDraft = {
  heading: "",
  explanation: "",
  techStack: "",
  fromDate: "",
  toDate: "",
};

type ViewMode = "preview" | "pdf";
type InputSidebarTab = "project" | "jd";
type CompilerStatus = {
  available: boolean;
  compiler: string | null;
  message: string;
};

export function LatexResumeTailorApp() {
  const [latexCode, setLatexCode] = useState(DEFAULT_LATEX_RESUME);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [sectionReviews, setSectionReviews] = useState<SectionReview[]>([]);
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>(emptyProjectDraft);
  const [projectDrafts, setProjectDrafts] = useState<ProjectDraft[]>([]);
  const [companyRole, setCompanyRole] = useState("");
  const [jd, setJd] = useState("");
  const [loadingFile, setLoadingFile] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [renderingPdf, setRenderingPdf] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFullscreen, setPdfFullscreen] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageInput, setPreviewPageInput] = useState("1");
  const [isInputPanelOpen, setIsInputPanelOpen] = useState(true);
  const [inputSidebarTab, setInputSidebarTab] = useState<InputSidebarTab>("project");
  const [compilerStatus, setCompilerStatus] = useState<CompilerStatus | null>(null);
  const [checkingCompiler, setCheckingCompiler] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const previewPaneRef = useRef<HTMLDivElement>(null);
  const paneGridRef = useRef<HTMLDivElement>(null);
  const [editorPaneWidth, setEditorPaneWidth] = useState(54);
  const [isPaneResizing, setIsPaneResizing] = useState(false);

  const resumeSections = useMemo(() => parseLatexResume(latexCode), [latexCode]);
  const previewLayout = useMemo(() => derivePreviewLayoutFromLatex(latexCode), [latexCode]);
  const previewPages = useMemo(
    () => paginateResumeSections(resumeSections, previewLayout),
    [resumeSections, previewLayout],
  );
  const previewPageCount = previewPages.length;
  const activeProjectDrafts = useMemo(
    () =>
      projectDrafts.length > 0
        ? projectDrafts
        : hasProjectDraftContent(projectDraft)
          ? [projectDraft]
          : [],
    [projectDraft, projectDrafts],
  );
  const projectInput = useMemo(
    () => formatProjectsInput(activeProjectDrafts),
    [activeProjectDrafts],
  );
  const projectForPrompt = projectInput || "No extra project input was provided.";

  useEffect(() => {
    const maxPage = Math.max(1, previewPageCount);

    setPreviewPage((current) => {
      const next = Math.min(Math.max(current, 1), maxPage);
      setPreviewPageInput(String(next));
      return next;
    });
  }, [previewPageCount]);

  const scrollToPreviewPage = useCallback((page: number) => {
    const pageElement = previewPaneRef.current?.querySelector<HTMLElement>(
      `[data-preview-page="${page}"]`,
    );

    pageElement?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const goToPreviewPage = useCallback(
    (page: number) => {
      const maxPage = Math.max(1, previewPageCount);
      const nextPage = Math.min(Math.max(page, 1), maxPage);
      setPreviewPage(nextPage);
      setPreviewPageInput(String(nextPage));
      scrollToPreviewPage(nextPage);
    },
    [previewPageCount, scrollToPreviewPage],
  );

  const canSubmit =
    resumeSections.length > 0 &&
    latexCode.trim().length > 0 &&
    companyRole.trim().length > 0 &&
    companyRole.length <= COMPANY_ROLE_LIMIT &&
    jd.trim().length > 0 &&
    jd.length <= JD_LIMIT &&
    projectForPrompt.length <= PROJECT_LIMIT &&
    !suggesting;
  const canCompilePdf = resumeSections.length > 0 && latexCode.trim().length > 0;

  const suggestionsByLine = useMemo(() => {
    return suggestions.reduce<Record<string, AiSuggestion[]>>((acc, suggestion) => {
      acc[suggestion.targetLineId] = [
        ...(acc[suggestion.targetLineId] ?? []),
        suggestion,
      ];
      return acc;
    }, {});
  }, [suggestions]);

  const latexSuggestionExtension = useMemo(
    () =>
      createLatexSuggestionExtension({
        sections: resumeSections,
        suggestionsByLine,
        onAcceptSuggestion: acceptSuggestion,
        onDeclineSuggestion: declineSuggestion,
      }),
    [resumeSections, suggestionsByLine],
  );

  const revokePdfPreview = useCallback(() => {
    setPdfFullscreen(false);
    setPdfUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }

      return null;
    });
  }, []);

  useEffect(() => revokePdfPreview, [revokePdfPreview]);

  useEffect(() => {
    let ignore = false;

    async function checkCompiler() {
      setCheckingCompiler(true);

      try {
        const response = await fetch("/api/resume/compile-latex", {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await response.json()) as CompilerStatus;

        if (!ignore) {
          setCompilerStatus({
            available: response.ok && payload.available,
            compiler: payload.compiler ?? null,
            message: payload.message,
          });
        }
      } catch {
        if (!ignore) {
          setCompilerStatus({
            available: false,
            compiler: null,
            message:
              "Unable to check the LaTeX compiler. Make sure the Next.js dev server is running.",
          });
        }
      } finally {
        if (!ignore) {
          setCheckingCompiler(false);
        }
      }
    }

    void checkCompiler();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!isPaneResizing) {
      return;
    }

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    function resizePane(event: PointerEvent) {
      const container = paneGridRef.current;

      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const nextWidth = ((event.clientX - rect.left) / rect.width) * 100;

      setEditorPaneWidth(clampPaneWidth(nextWidth));
    }

    function stopResizing() {
      setIsPaneResizing(false);
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", resizePane);
    window.addEventListener("pointerup", stopResizing);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", resizePane);
      window.removeEventListener("pointerup", stopResizing);
    };
  }, [isPaneResizing]);

  function updateLatex(value: string) {
    setLatexCode(value);
    setSuggestions([]);
    setSectionReviews([]);
    revokePdfPreview();
  }

  async function handleTexFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".tex")) {
      setError("Upload a .tex resume file.");
      return;
    }

    setError(null);
    setLoadingFile(true);

    try {
      updateLatex(await file.text());
      setViewMode("preview");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to read this .tex file.",
      );
    } finally {
      setLoadingFile(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) {
      await handleTexFile(file);
    }

    event.target.value = "";
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
          resumeSections: stripMetadataForGemini(resumeSections),
          project: projectForPrompt,
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
      setViewMode("preview");
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
    setLatexCode((current) =>
      applySuggestionToLatex(current, resumeSections, suggestion),
    );
    setSuggestions((current) => current.filter((item) => item.id !== suggestion.id));
    revokePdfPreview();
  }

  function declineSuggestion(suggestionId: string) {
    setSuggestions((current) => current.filter((item) => item.id !== suggestionId));
  }

  function acceptAllInSection(sectionId: string) {
    const sectionSuggestions = suggestions.filter(
      (suggestion) => suggestion.sectionId === sectionId,
    );

    setLatexCode((current) =>
      sectionSuggestions.reduce(
        (nextLatex, suggestion) =>
          applySuggestionToLatex(nextLatex, parseLatexResume(nextLatex), suggestion),
        current,
      ),
    );
    setSuggestions((current) =>
      current.filter((suggestion) => suggestion.sectionId !== sectionId),
    );
    revokePdfPreview();
  }

  function declineAllInSection(sectionId: string) {
    setSuggestions((current) =>
      current.filter((suggestion) => suggestion.sectionId !== sectionId),
    );
  }

  function updateProjectDraft(project: ProjectDraft) {
    setProjectDraft(project);
    setProjectDrafts([]);
  }

  function applyProjectDrafts(projects: ProjectDraft[]) {
    setProjectDraft(projects[0] ?? emptyProjectDraft);
    setProjectDrafts(projects);
  }

  function insertProject() {
    const insertableProjects = activeProjectDrafts.filter(canInsertProject);

    if (insertableProjects.length === 0) {
      setError("Add at least one project with heading, explanation, and tech stack first.");
      return;
    }

    updateLatex(insertProjectsIntoLatex(latexCode, insertableProjects));
    setProjectDraft(emptyProjectDraft);
    setProjectDrafts([]);
    setError(null);
  }

  async function createPdfBlob() {
    const response = await fetch("/api/resume/compile-latex", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ latex: latexCode }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as {
        error?: string;
        details?: string;
      };

      throw new Error([payload.error, payload.details].filter(Boolean).join(" "));
    }

    const blob = await response.blob();

    if (blob.type !== "application/pdf") {
      throw new Error("Expected a PDF response from the compiler.");
    }

    return blob;
  }

  async function downloadPreviewPdfFallback() {
    const element = previewRef.current;

    if (!element) {
      throw new Error("Preview is not available for fallback export.");
    }

    const html2pdf = (await import("html2pdf.js")).default;
    const exportRoot = element.cloneNode(true) as HTMLDivElement;
    const pagesContainer = exportRoot.firstElementChild as HTMLDivElement | null;
    const pageWrappers = Array.from(
      exportRoot.querySelectorAll<HTMLDivElement>("[data-preview-page]"),
    );
    const pageCards = Array.from(exportRoot.querySelectorAll<HTMLDivElement>(".resume-preview-page"));

    // Remove preview layout classes so export sizing stays deterministic.
    exportRoot.className = "";
    exportRoot.classList.add("resume-export");
    exportRoot.style.width = `${previewLayout.pageWidthPx}px`;
    exportRoot.style.minWidth = `${previewLayout.pageWidthPx}px`;
    exportRoot.style.maxWidth = `${previewLayout.pageWidthPx}px`;
    exportRoot.style.margin = "0 auto";
    exportRoot.style.padding = "0";
    exportRoot.style.background = "#ffffff";
    exportRoot.style.boxSizing = "border-box";

    if (pagesContainer) {
      pagesContainer.classList.remove("space-y-6", "py-1");
      pagesContainer.style.display = "flex";
      pagesContainer.style.flexDirection = "column";
      pagesContainer.style.gap = "0";
      pagesContainer.style.padding = "0";
    }

    pageWrappers.forEach((page, index) => {
      page.style.width = `${previewLayout.pageWidthPx}px`;
      page.style.height = `${previewLayout.pageHeightPx}px`;
      page.style.margin = "0";
      page.style.padding = "0";
      page.style.overflow = "hidden";
      page.style.pageBreakInside = "avoid";
      page.style.breakInside = "avoid";
      page.style.pageBreakAfter = index === pageWrappers.length - 1 ? "auto" : "always";
      page.style.breakAfter = index === pageWrappers.length - 1 ? "auto" : "page";
    });

    pageCards.forEach((page) => {
      page.style.transform = "none";
      page.style.transformOrigin = "top center";
      page.style.width = `${previewLayout.pageWidthPx}px`;
      page.style.height = `${previewLayout.pageHeightPx}px`;
      page.style.boxShadow = "none";
      page.style.margin = "0";
      page.style.background = "#ffffff";
    });

    document.body.appendChild(exportRoot);

    try {
      await html2pdf()
        .set({
          filename: getDownloadFilename(companyRole),
          margin: [0, 0, 0, 0],
          image: { type: "jpeg", quality: 0.98 },
          enableLinks: true,
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
          pagebreak: { mode: ["css"] },
        })
        .from(exportRoot)
        .save();
    } finally {
      exportRoot.remove();
    }
  }

  async function downloadResumePdf() {
    setDownloading(true);
    setError(null);

    try {
      const blob = await createPdfBlob();
      downloadBlob(blob, getDownloadFilename(companyRole));
    } catch (compileError) {
      try {
        await downloadPreviewPdfFallback();
      } catch (fallbackError) {
        const compileMessage =
          compileError instanceof Error ? compileError.message : "LaTeX PDF compile failed.";
        const fallbackMessage =
          fallbackError instanceof Error
            ? fallbackError.message
            : "Fallback PDF export also failed.";

        setError([compileMessage, fallbackMessage].join(" "));
      }
    } finally {
      setDownloading(false);
    }
  }

  function downloadLatexSource() {
    downloadBlob(
      new Blob([latexCode], { type: "application/x-tex;charset=utf-8" }),
      `${sanitizeFilename(companyRole || "resume")}.tex`,
    );
  }

  async function renderPdfPreview() {
    setViewMode("pdf");
    setPdfFullscreen(true);

    if (pdfUrl) {
      return;
    }

    setRenderingPdf(true);
    setError(null);

    try {
      const blob = await createPdfBlob();
      setPdfUrl(URL.createObjectURL(blob));
    } catch (previewError) {
      setViewMode("preview");
      setError(
        previewError instanceof Error
          ? previewError.message
          : "Unable to create the PDF preview.",
      );
    } finally {
      setRenderingPdf(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f8f8]">
      {pdfFullscreen ? (
        <PdfFullscreenPreview
          pdfUrl={pdfUrl}
          rendering={renderingPdf}
          zoom={previewZoom}
          onZoomIn={() => setPreviewZoom((current) => clampPdfZoom(current + PDF_ZOOM_STEP))}
          onZoomOut={() => setPreviewZoom((current) => clampPdfZoom(current - PDF_ZOOM_STEP))}
          onZoomReset={() => setPreviewZoom(100)}
          onClose={() => setPdfFullscreen(false)}
        />
      ) : null}
      <div className="mx-auto flex min-h-screen max-w-[1760px] flex-col items-start gap-5 px-4 py-5 xl:flex-row xl:items-stretch">
        <section className="flex w-full flex-1 flex-col rounded-md border bg-white">
          <div className="flex flex-col gap-3 border-b bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-normal">Resume Tailor</h1>
              <p className="text-sm text-muted-foreground">
                Edit LaTeX source, review AI edits, preview the resume, export PDF.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-muted">
                <input
                  type="file"
                  accept=".tex,application/x-tex,text/x-tex,text/plain"
                  className="sr-only"
                  onChange={handleFileChange}
                />
                {loadingFile ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
              </label>
              <Button
                type="button"
                variant={viewMode === "pdf" ? "default" : "outline"}
                onClick={renderPdfPreview}
                disabled={!canCompilePdf || renderingPdf}
              >
                {renderingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
              </Button>
              <Button type="button" variant="outline" onClick={downloadLatexSource}>
                <Code2 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                onClick={downloadResumePdf}
                disabled={!canCompilePdf || downloading}
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
              <Button
                type="button"
                variant={isInputPanelOpen ? "default" : "outline"}
                onClick={() => setIsInputPanelOpen((current) => !current)}
                size="icon"
                className="h-10 w-10"
                aria-label={isInputPanelOpen ? "Hide input panel" : "Show input panel"}
                title={isInputPanelOpen ? "Hide input panel" : "Show input panel"}
              >
                {isInputPanelOpen ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {error ? (
            <div className="px-4 pt-4">
              <Alert className="border-destructive/40 bg-destructive/5">
                <AlertTitle>Something needs attention</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          ) : null}

          <div
            ref={paneGridRef}
            className="grid gap-0 overflow-hidden lg:grid-cols-[minmax(320px,var(--editor-pane-width))_10px_minmax(380px,1fr)]"
            style={
              {
                "--editor-pane-width": `${editorPaneWidth}%`,
                "--workspace-pane-height": WORKSPACE_PANE_HEIGHT,
              } as CSSProperties
            }
          >
            <div className="min-h-0 border-b lg:h-[var(--workspace-pane-height)] lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between border-b px-4 py-2">
                <div>
                  <h2 className="text-sm font-semibold">LaTeX source</h2>
                  <p className="text-xs text-muted-foreground">
                    Edit the resume directly in .tex format. Compile PDF uses a real TeX engine.
                  </p>
                </div>
                <Badge variant="secondary">CodeMirror</Badge>
              </div>
              <CodeMirror
                value={latexCode}
                height="calc(var(--workspace-pane-height) - 57px)"
                extensions={[latexLanguage, latexSuggestionExtension]}
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  highlightActiveLine: true,
                  highlightSelectionMatches: true,
                }}
                onChange={updateLatex}
                className="text-sm"
              />
            </div>

            <div
              role="separator"
              aria-label="Resize LaTeX editor and preview panes"
              aria-orientation="vertical"
              aria-valuemin={MIN_EDITOR_PANE_WIDTH}
              aria-valuemax={MAX_EDITOR_PANE_WIDTH}
              aria-valuenow={Math.round(editorPaneWidth)}
              tabIndex={0}
              className={`hidden cursor-col-resize items-center justify-center border-r bg-border/60 transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex ${
                isPaneResizing ? "bg-primary/20" : ""
              }`}
              onPointerDown={(event) => {
                event.preventDefault();
                setIsPaneResizing(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  setEditorPaneWidth((current) => clampPaneWidth(current - 4));
                }

                if (event.key === "ArrowRight") {
                  event.preventDefault();
                  setEditorPaneWidth((current) => clampPaneWidth(current + 4));
                }
              }}
            >
              <span className="h-16 w-1 rounded-sm bg-muted-foreground/35" />
            </div>

            <div className="min-h-0 bg-[#e8eeee] lg:h-[var(--workspace-pane-height)]">
              <div className="flex h-[var(--workspace-pane-height)] flex-col">
                <div className="flex items-center justify-between border-b bg-slate-800 px-2 py-1 text-slate-100">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-100 hover:bg-slate-700 hover:text-slate-100"
                      onClick={() => goToPreviewPage(previewPage - 1)}
                      aria-label="Previous page"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-100 hover:bg-slate-700 hover:text-slate-100"
                      onClick={() => goToPreviewPage(previewPage + 1)}
                      aria-label="Next page"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Input
                      value={previewPageInput}
                      onChange={(event) => {
                        const digitsOnly = event.target.value.replace(/[^\d]/g, "");
                        setPreviewPageInput(digitsOnly);
                      }}
                      onBlur={() => goToPreviewPage(Number.parseInt(previewPageInput || "1", 10))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          goToPreviewPage(Number.parseInt(previewPageInput || "1", 10));
                        }
                      }}
                      className="h-7 w-12 border-slate-500 bg-slate-700 px-2 text-center text-sm text-white"
                      aria-label="Preview page number"
                    />
                    <span className="text-sm text-slate-200">/ {previewPageCount}</span>
                    <span className="mx-1 h-6 w-px bg-slate-600" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-100 hover:bg-slate-700 hover:text-slate-100"
                      onClick={() =>
                        setPreviewZoom((current) => clampPdfZoom(current - PDF_ZOOM_STEP))
                      }
                      aria-label="Zoom out preview"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-100 hover:bg-slate-700 hover:text-slate-100"
                      onClick={() =>
                        setPreviewZoom((current) => clampPdfZoom(current + PDF_ZOOM_STEP))
                      }
                      aria-label="Zoom in preview"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-sm text-slate-100 hover:bg-slate-700 hover:text-slate-100"
                    onClick={() => setPreviewZoom(100)}
                    aria-label="Reset preview zoom"
                  >
                    {previewZoom}%
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div ref={previewPaneRef} className="min-h-0 flex-1">
                  {viewMode === "pdf" ? (
                    <PdfPreview pdfUrl={pdfUrl} rendering={renderingPdf} zoom={previewZoom} />
                  ) : (
                    <div
                      className="h-full overflow-x-auto overflow-y-scroll px-3 py-4"
                      style={{ scrollbarGutter: "stable both-edges" }}
                    >
                      <ResumePreview
                        ref={previewRef}
                        pages={previewPages}
                        layout={previewLayout}
                        zoom={previewZoom}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {isInputPanelOpen ? (
          <aside className="w-full xl:w-[430px] xl:self-stretch">
            <Card className="sticky top-5 xl:flex xl:h-full xl:flex-col">
              <CardContent className="space-y-5 pt-5 xl:flex xl:flex-1 xl:flex-col xl:overflow-y-auto">
                <div
                  className="grid grid-cols-2 rounded-lg border bg-muted p-1"
                  role="tablist"
                  aria-label="Input panel tabs"
                >
                  <Button
                    type="button"
                    size="sm"
                    variant={inputSidebarTab === "project" ? "secondary" : "ghost"}
                    className={`h-8 text-xs ${
                      inputSidebarTab === "project"
                        ? "bg-background text-foreground shadow-sm hover:bg-background"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setInputSidebarTab("project")}
                    role="tab"
                    aria-selected={inputSidebarTab === "project"}
                  >
                    Project
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={inputSidebarTab === "jd" ? "secondary" : "ghost"}
                    className={`h-8 text-xs ${
                      inputSidebarTab === "jd"
                        ? "bg-background text-foreground shadow-sm hover:bg-background"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setInputSidebarTab("jd")}
                    role="tab"
                    aria-selected={inputSidebarTab === "jd"}
                  >
                    JD
                  </Button>
                </div>

                {inputSidebarTab === "project" ? (
                  <ProjectFields
                    project={projectDraft}
                    projects={projectDrafts}
                    onProjectChange={updateProjectDraft}
                    onProjectsChange={applyProjectDrafts}
                    onInsertProject={insertProject}
                  />
                ) : (
                  <>
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
                        className="min-h-48"
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
                      Suggestions update the LaTeX source, so the editable .tex remains the
                      source of truth.
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </aside>
        ) : null}
      </div>
    </main>
  );
}

function stripMetadataForGemini(sections: ResumeSection[]): ResumeSection[] {
  return sections.map((section) => ({
    ...section,
    lines: section.lines.map((line) => ({
      id: line.id,
      page: line.page,
      sectionId: line.sectionId,
      kind: line.kind,
      sourceLine: line.sourceLine,
      sourceEndLine: line.sourceEndLine,
      sourceText: line.sourceText,
      rightText: line.rightText,
      secondaryText: line.secondaryText,
      text: [
        line.text,
        line.rightText ? `(${line.rightText})` : "",
        line.secondaryText ? `- ${line.secondaryText}` : "",
      ]
        .filter(Boolean)
        .join(" "),
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

function clampPaneWidth(width: number) {
  return Math.min(MAX_EDITOR_PANE_WIDTH, Math.max(MIN_EDITOR_PANE_WIDTH, width));
}

function FieldCounter({ value, max }: { value: number; max: number }) {
  const isOver = value > max;

  return (
    <p
      className={`text-right text-xs ${
        isOver ? "text-destructive" : "text-muted-foreground"
      }`}
    >
      {value.toLocaleString()} / {max.toLocaleString()}
    </p>
  );
}

function CompilerNotice({
  status,
  checking,
}: {
  status: CompilerStatus | null;
  checking: boolean;
}) {
  if (checking) {
    return (
      <p className="text-xs text-muted-foreground">
        Checking for a LaTeX compiler before enabling PDF export...
      </p>
    );
  }

  if (!status?.available) {
    return (
      <Alert className="border-amber-400/50 bg-amber-50">
        <AlertTitle>Install a LaTeX compiler to create PDFs</AlertTitle>
        <AlertDescription>
          Install MiKTeX, TeX Live, or Tectonic, make sure{" "}
          <code>pdflatex</code>, <code>xelatex</code>, or <code>tectonic</code>{" "}
          is on PATH, then restart <code>pnpm dev</code>.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <p className="text-xs text-muted-foreground">
      PDF export compiles the current .tex source with {status.compiler}.
    </p>
  );
}

type ProjectFieldsProps = {
  project: ProjectDraft;
  projects: ProjectDraft[];
  onProjectChange: (project: ProjectDraft) => void;
  onProjectsChange: (projects: ProjectDraft[]) => void;
  onInsertProject: () => void;
};

function ProjectFields({
  project,
  projects,
  onProjectChange,
  onProjectsChange,
  onInsertProject,
}: ProjectFieldsProps) {
  const [inputMode, setInputMode] = useState<ProjectInputMode>("form");
  const [jsonValue, setJsonValue] = useState(formatProjectJson([project]));
  const [jsonError, setJsonError] = useState<string | null>(null);

  function updateField(field: keyof ProjectDraft, value: string) {
    onProjectChange({
      ...project,
      [field]: value,
    });
  }

  function switchInputMode(mode: ProjectInputMode) {
    setInputMode(mode);
    setJsonError(null);

    if (mode === "json") {
      setJsonValue(formatProjectJson(projects.length > 0 ? projects : [project]));
    }
  }

  function applyJsonProject() {
    const parsedProjects = parseProjectJson(jsonValue);

    if (!parsedProjects.ok) {
      setJsonError(parsedProjects.error);
      return;
    }

    onProjectsChange(parsedProjects.projects);
    setJsonError(null);
  }

  const activeProjects = projects.length > 0 ? projects : [project];
  const projectLength = formatProjectsInput(activeProjects).length;
  const insertProjectCount = activeProjects.filter(canInsertProject).length;

  return (
    <div className="space-y-3 rounded-md border bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Label>Project input</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Add a project once, then insert it into the LaTeX Projects section.
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Input method
          </p>
          <div
            className="grid grid-cols-2 rounded-lg border bg-muted p-1"
            role="tablist"
            aria-label="Project input method"
          >
          <Button
            type="button"
            size="sm"
            variant={inputMode === "form" ? "secondary" : "ghost"}
            className={`h-7 px-3 text-xs ${
              inputMode === "form"
                ? "bg-background text-foreground shadow-sm hover:bg-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => switchInputMode("form")}
            role="tab"
            aria-selected={inputMode === "form"}
          >
            Form
          </Button>
          <Button
            type="button"
            size="sm"
            variant={inputMode === "json" ? "secondary" : "ghost"}
            className={`h-7 px-3 text-xs ${
              inputMode === "json"
                ? "bg-background text-foreground shadow-sm hover:bg-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => switchInputMode("json")}
            role="tab"
            aria-selected={inputMode === "json"}
          >
            JSON
          </Button>
          </div>
        </div>
      </div>

      {inputMode === "form" ? (
        <>
          <Input
            value={project.heading}
            onChange={(event) => updateField("heading", event.target.value)}
            placeholder="Project heading"
          />
          <Textarea
            value={project.explanation}
            onChange={(event) => updateField("explanation", event.target.value)}
            placeholder="Project explanation"
            className="min-h-24"
          />
          <Input
            value={project.techStack}
            onChange={(event) => updateField("techStack", event.target.value)}
            placeholder="Tech stack, for example React, Node.js, MongoDB"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={project.fromDate}
              onChange={(event) => updateField("fromDate", event.target.value)}
              placeholder="From date"
            />
            <Input
              value={project.toDate}
              onChange={(event) => updateField("toDate", event.target.value)}
              placeholder="To date"
            />
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <Textarea
            value={jsonValue}
            onChange={(event) => {
              setJsonValue(event.target.value);
              setJsonError(null);
            }}
            placeholder={`{
  "projects": [
    {
      "heading": "AI Resume Analyzer",
      "explanation": "Built a resume scoring workflow with LLM feedback and keyword matching.",
      "techStack": "Next.js, TypeScript, FastAPI, PostgreSQL",
      "fromDate": "Jan 2026",
      "toDate": "Apr 2026"
    },
    {
      "heading": "Portfolio CMS",
      "explanation": "Built a content dashboard for publishing case studies and project pages.",
      "techStack": "Next.js, MongoDB, Tailwind CSS",
      "fromDate": "May 2026",
      "toDate": "Jun 2026"
    }
  ]
}`}
            className="min-h-48 font-mono text-xs"
          />
          {jsonError ? (
            <p className="text-xs text-destructive">{jsonError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Paste one object, an array, or an object with a projects array.
            </p>
          )}
          <Button type="button" size="sm" variant="outline" onClick={applyJsonProject}>
            Apply JSON
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-xs ${
            projectLength > PROJECT_LIMIT ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {projectLength.toLocaleString()} / {PROJECT_LIMIT.toLocaleString()}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onInsertProject}
          disabled={insertProjectCount === 0}
        >
          <Plus className="h-4 w-4" />
          {insertProjectCount > 1 ? `Insert ${insertProjectCount} projects` : "Insert project"}
        </Button>
      </div>
    </div>
  );
}

function formatProjectJson(projects: ProjectDraft[]) {
  const visibleProjects = projects.filter(hasProjectDraftContent);

  return JSON.stringify(
    visibleProjects.length > 1 ? { projects: visibleProjects } : visibleProjects[0] ?? emptyProjectDraft,
    null,
    2,
  );
}

function parseProjectJson(value: string):
  | { ok: true; projects: ProjectDraft[] }
  | { ok: false; error: string } {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return { ok: false, error: "Enter valid JSON before applying." };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    if (Array.isArray(parsed)) {
      const projects = parsed.map(readProjectFromRecord).filter(isProjectDraft);

      if (projects.length === 0) {
        return { ok: false, error: "Add at least one valid project object." };
      }

      return { ok: true, projects };
    }

    return { ok: false, error: "Project JSON must be an object or an array." };
  }

  const record = parsed as Record<string, unknown>;
  const rawProjects = record.projects;

  if (Array.isArray(rawProjects)) {
    const projects = rawProjects.map(readProjectFromRecord).filter(isProjectDraft);

    if (projects.length === 0) {
      return { ok: false, error: "The projects array needs at least one valid project." };
    }

    return { ok: true, projects };
  }

  const project = readProjectFromRecord(record);

  if (!project) {
    return { ok: false, error: "Project JSON needs heading, explanation, or tech stack." };
  }

  return { ok: true, projects: [project] };
}

function readProjectFromRecord(value: unknown): ProjectDraft | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const dates =
    record.dates && typeof record.dates === "object" && !Array.isArray(record.dates)
      ? (record.dates as Record<string, unknown>)
      : undefined;

  const project = {
    heading: readJsonString(record.heading),
    explanation: readJsonString(record.explanation),
    techStack: readJsonString(record.techStack ?? record.tech_stack),
    fromDate: readJsonString(
      record.fromDate ?? record.from_date ?? dates?.from ?? dates?.start,
    ),
    toDate: readJsonString(record.toDate ?? record.to_date ?? dates?.to ?? dates?.end),
  };

  return hasProjectDraftContent(project) ? project : undefined;
}

function isProjectDraft(project: ProjectDraft | undefined): project is ProjectDraft {
  return Boolean(project);
}

function readJsonString(value: unknown) {
  return typeof value === "string" ? value : "";
}

type ResumePreviewProps = {
  pages: PaginatedPreviewPage[];
  layout: PreviewLayoutProfile;
  zoom: number;
};

const ResumePreview = forwardRef<HTMLDivElement, ResumePreviewProps>(
  function ResumePreviewInner({ pages, layout, zoom }, ref) {
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
}: {
  section: ResumeSection;
  showHeading?: boolean;
}) {
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
          <p className="mt-0.5 text-[11px] leading-[1.15] text-slate-900">{locationLine.text}</p>
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
          <h2 className="text-[0.69rem] font-bold uppercase tracking-normal">{section.title}</h2>
        </div>
      ) : null}
      <div className="space-y-1">
        {section.lines.map((line) => (
          <PreviewLine
            key={line.id}
            line={line}
          />
        ))}
      </div>
    </section>
  );
}

function PreviewLine({
  line,
}: {
  line: ResumeLine;
}) {
  const labelValue = splitLabelValue(line.text);

  return (
    <div className="break-inside-avoid">
      {line.kind === "projectHeading" || line.kind === "subheading" ? (
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

type PaginatedPreviewPage = {
  id: string;
  sections: PaginatedPreviewSection[];
};

type PreviewLayoutProfile = {
  pageWidthPx: number;
  pageHeightPx: number;
  marginXpx: number;
  marginTopPx: number;
  marginBottomPx: number;
  contentWidthPx: number;
  contentHeightPx: number;
};

function paginateResumeSections(
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
  const wrappedRows = estimateWrappedRows(mainText, line.kind === "bullet" ? bodyWidth - 16 : bodyWidth);

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

function derivePreviewLayoutFromLatex(latexSource: string): PreviewLayoutProfile {
  const textWidthAddInches = readAddToLengthInches(latexSource, "textwidth");
  const textHeightAddInches = readAddToLengthInches(latexSource, "textheight");
  const topMarginAddInches = readAddToLengthInches(latexSource, "topmargin");

  const marginXpx =
    textWidthAddInches > 0
      ? Math.max(MIN_PREVIEW_MARGIN_PX, Math.round(DEFAULT_A4_MARGIN_PX - textWidthAddInches * 52))
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

type CreateLatexSuggestionExtensionInput = {
  sections: ResumeSection[];
  suggestionsByLine: Record<string, AiSuggestion[]>;
  onAcceptSuggestion: (suggestion: AiSuggestion) => void;
  onDeclineSuggestion: (suggestionId: string) => void;
};

function createLatexSuggestionExtension({
  sections,
  suggestionsByLine,
  onAcceptSuggestion,
  onDeclineSuggestion,
}: CreateLatexSuggestionExtensionInput): Extension {
  const suggestionField = StateField.define<DecorationSet>({
    create(state) {
      return buildLatexSuggestionDecorations(state.doc, {
        sections,
        suggestionsByLine,
        onAcceptSuggestion,
        onDeclineSuggestion,
      });
    },
    update(value, transaction) {
      if (!transaction.docChanged) {
        return value;
      }

      return buildLatexSuggestionDecorations(transaction.state.doc, {
        sections,
        suggestionsByLine,
        onAcceptSuggestion,
        onDeclineSuggestion,
      });
    },
    provide: (field) => EditorView.decorations.from(field),
  });

  return [latexSuggestionTheme, suggestionField];
}

function buildLatexSuggestionDecorations(
  doc: Text,
  {
    sections,
    suggestionsByLine,
    onAcceptSuggestion,
    onDeclineSuggestion,
  }: CreateLatexSuggestionExtensionInput,
) {
  const builder = new RangeSetBuilder<Decoration>();

  sections.forEach((section) => {
    section.lines.forEach((line) => {
      const lineSuggestions = suggestionsByLine[line.id] ?? [];

      if (lineSuggestions.length === 0 || typeof line.sourceLine !== "number") {
        return;
      }

      const sourceLineNumber = line.sourceLine + 1;

      if (sourceLineNumber > doc.lines) {
        return;
      }

      const sourceLine = doc.line(sourceLineNumber);

      lineSuggestions.forEach((suggestion, index) => {
        const sourceText = line.sourceText ?? line.text;

        builder.add(
          sourceLine.to,
          sourceLine.to,
          Decoration.widget({
            block: true,
            side: index + 1,
            widget: new LatexInlineSuggestionWidget({
              sectionTitle: section.title,
              sourceLineNumber,
              sourceText,
              suggestedSourceText: previewSuggestionLatexLine(
                sourceText,
                suggestion.suggestedText,
                suggestion.action,
                section.title,
              ),
              suggestion,
              onAcceptSuggestion: () => onAcceptSuggestion(suggestion),
              onDeclineSuggestion: () => onDeclineSuggestion(suggestion.id),
            }),
          }),
        );
      });
    });
  });

  return builder.finish();
}

const latexSuggestionTheme = EditorView.baseTheme({
  ".cm-latexSuggestionWidget": {
    margin: "4px 0 6px 0",
    padding: "0",
    borderRadius: "0",
    background: "transparent",
    color: "rgb(15, 23, 42)",
    fontFamily: "var(--font-sans), Arial, sans-serif",
    whiteSpace: "normal",
  },
  ".cm-latexSuggestionHeader": {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    marginBottom: "4px",
    fontSize: "12px",
  },
  ".cm-latexSuggestionBadge": {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "4px",
    padding: "1px 7px",
    background: "rgb(13, 148, 136)",
    color: "white",
    fontWeight: "700",
  },
  ".cm-latexSuggestionMeta": {
    color: "rgb(71, 85, 105)",
    fontWeight: "600",
  },
  ".cm-latexSuggestionDiff": {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
  ".cm-latexSuggestionLine": {
    overflowX: "auto",
    boxSizing: "border-box",
    width: "100%",
    margin: "0",
    padding: "7px 9px",
    borderRadius: "4px",
    fontFamily: "monospace",
    fontSize: "12px",
    lineHeight: "1.45",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  ".cm-latexSuggestionLineOld": {
    border: "1px solid rgb(252, 165, 165)",
    background: "rgb(254, 226, 226)",
    color: "rgb(127, 29, 29)",
  },
  ".cm-latexSuggestionLineNew": {
    border: "1px solid rgb(134, 239, 172)",
    background: "rgb(220, 252, 231)",
    color: "rgb(20, 83, 45)",
  },
  ".cm-latexSuggestionActions": {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: "8px",
    marginTop: "5px",
  },
  ".cm-latexSuggestionButton": {
    height: "28px",
    borderRadius: "6px",
    border: "1px solid rgb(203, 213, 225)",
    padding: "0 10px",
    background: "white",
    color: "rgb(15, 23, 42)",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
  },
  ".cm-latexSuggestionButtonPrimary": {
    borderColor: "rgb(13, 148, 136)",
    background: "rgb(13, 148, 136)",
    color: "white",
  },
});

type LatexInlineSuggestionWidgetData = {
  sectionTitle: string;
  sourceLineNumber: number;
  sourceText: string;
  suggestedSourceText: string;
  suggestion: AiSuggestion;
  onAcceptSuggestion: () => void;
  onDeclineSuggestion: () => void;
};

class LatexInlineSuggestionWidget extends WidgetType {
  constructor(private readonly data: LatexInlineSuggestionWidgetData) {
    super();
  }

  eq(other: LatexInlineSuggestionWidget) {
    return (
      other.data.suggestion.id === this.data.suggestion.id &&
      other.data.sourceText === this.data.sourceText &&
      other.data.suggestedSourceText === this.data.suggestedSourceText &&
      other.data.suggestion.suggestedText === this.data.suggestion.suggestedText
    );
  }

  toDOM() {
    const root = document.createElement("div");
    root.className = "cm-latexSuggestionWidget";

    const header = document.createElement("div");
    header.className = "cm-latexSuggestionHeader";

    const action = document.createElement("span");
    action.className = "cm-latexSuggestionBadge";
    action.textContent = this.data.suggestion.action.replace("_", " ");
    header.append(action);

    const section = document.createElement("span");
    section.className = "cm-latexSuggestionMeta";
    section.textContent = this.data.sectionTitle;
    header.append(section);

    const line = document.createElement("span");
    line.className = "cm-latexSuggestionMeta";
    line.textContent = `line ${this.data.sourceLineNumber}`;
    header.append(line);
    root.append(header);

    const diff = document.createElement("div");
    diff.className = "cm-latexSuggestionDiff";

    if (this.data.suggestion.action === "replace" || this.data.suggestion.action === "delete") {
      diff.append(createSuggestionLine(this.data.sourceText, "old"));
    }

    if (this.data.suggestion.action !== "delete") {
      diff.append(
        createSuggestionLine(
          this.data.suggestedSourceText || this.data.suggestion.suggestedText,
          "new",
        ),
      );
    }

    root.append(diff);

    const actions = document.createElement("div");
    actions.className = "cm-latexSuggestionActions";
    actions.append(
      createSuggestionButton("Accept", true, this.data.onAcceptSuggestion),
      createSuggestionButton("Decline", false, this.data.onDeclineSuggestion),
    );

    root.append(actions);
    return root;
  }

  ignoreEvent() {
    return false;
  }
}

function createSuggestionLine(value: string, tone: "old" | "new") {
  const line = document.createElement("pre");
  line.className =
    tone === "old"
      ? "cm-latexSuggestionLine cm-latexSuggestionLineOld"
      : "cm-latexSuggestionLine cm-latexSuggestionLineNew";
  line.textContent = value;
  return line;
}

function createSuggestionButton(
  label: string,
  primary: boolean,
  onClick: () => void,
) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = primary
    ? "cm-latexSuggestionButton cm-latexSuggestionButtonPrimary"
    : "cm-latexSuggestionButton";
  button.textContent = label;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });

  return button;
}

function PdfPreview({
  pdfUrl,
  rendering,
  zoom,
}: {
  pdfUrl: string | null;
  rendering: boolean;
  zoom: number;
}) {
  if (rendering) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Compiling LaTeX PDF...
      </div>
    );
  }

  if (!pdfUrl) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Compile the PDF from the toolbar.
      </div>
    );
  }

  return (
    <iframe
      title="Resume PDF preview"
      src={applyPdfZoom(pdfUrl, zoom)}
      className="h-full w-full border-0 bg-white"
    />
  );
}

function PdfFullscreenPreview({
  pdfUrl,
  rendering,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onClose,
}: {
  pdfUrl: string | null;
  rendering: boolean;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#e8eeee]">
      <div className="flex items-center justify-between border-b bg-white px-4 py-3 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold">PDF preview</h2>
          <p className="text-xs text-muted-foreground">
            Compiled from the current LaTeX source.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" onClick={onZoomOut} title="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" className="min-w-16" onClick={onZoomReset}>
            {zoom}%
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={onZoomIn} title="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            <X className="h-4 w-4" />
            Back to editor
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {rendering ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Compiling LaTeX PDF...
          </div>
        ) : pdfUrl ? (
          <iframe
            title="Fullscreen resume PDF preview"
            src={applyPdfZoom(pdfUrl, zoom)}
            className="h-full w-full border-0 bg-white"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Compile the PDF from the toolbar.
          </div>
        )}
      </div>
    </div>
  );
}

function clampPdfZoom(zoom: number) {
  return Math.max(MIN_PDF_ZOOM, Math.min(MAX_PDF_ZOOM, zoom));
}

function applyPdfZoom(url: string, zoom: number) {
  const [base, hash] = url.split("#");
  const params = new URLSearchParams(hash ?? "");
  params.set("zoom", String(zoom));
  return `${base}#${params.toString()}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
