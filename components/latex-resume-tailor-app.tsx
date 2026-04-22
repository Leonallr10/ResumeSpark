"use client";

import { StreamLanguage } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import CodeMirror from "@uiw/react-codemirror";
import {
  type ChangeEvent,
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Code2,
  Download,
  FileText,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  Upload,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createLatexSuggestionExtension } from "@/components/latex-editor-suggestions";
import {
  emptyProjectDraft,
  LatexProjectFields,
  PROJECT_LIMIT,
} from "@/components/latex-project-fields";
import {
  clampPdfZoom,
  PdfFullscreenPreview,
  PdfPreview,
} from "@/components/latex-pdf-preview";
import {
  derivePreviewLayoutFromLatex,
  paginateResumeSections,
  ResumePreview,
  type ResumePreviewSelection,
} from "@/components/latex-resume-preview";
import {
  applySuggestionToLatex,
  canInsertProject,
  DEFAULT_LATEX_RESUME,
  formatProjectsInput,
  hasProjectDraftContent,
  insertProjectsIntoLatex,
  parseLatexResume,
  type ProjectDraft,
} from "@/lib/latex-resume";
import { getDownloadFilename, sanitizeFilename } from "@/lib/resume";
import { EditorView } from "@codemirror/view";
import type {
  AiSuggestion,
  ResumeSection,
  SectionReview,
  SuggestionResponse,
} from "@/types/resume";

const COMPANY_ROLE_LIMIT = 300;
const JD_LIMIT = 20000;
const PROJECT_CACHE_KEY = "resume-tailor-projects-v1";
const WORKSPACE_PANE_HEIGHT = "clamp(560px, calc(100vh - 190px), 820px)";
const MIN_EDITOR_PANE_WIDTH = 34;
const MAX_EDITOR_PANE_WIDTH = 68;
const PDF_ZOOM_STEP = 10;
const latexLanguage = StreamLanguage.define(stex);

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
  const editorViewRef = useRef<EditorView | null>(null);
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
  const projectForPrompt =
    projectInput.trim().length > 0 ? projectInput : "No extra project input was provided.";

  useEffect(() => {
    const cachedProjects = readCachedProjectDrafts();

    if (cachedProjects.length > 0) {
      setProjectDraft(cachedProjects[0]);
      setProjectDrafts(cachedProjects);
    }
  }, []);

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

  const focusEditorAtSourceLine = useCallback((zeroBasedLineNumber: number) => {
    const view = editorViewRef.current;

    if (!view) {
      return;
    }

    const oneBasedLineNumber = Math.min(
      Math.max(zeroBasedLineNumber + 1, 1),
      view.state.doc.lines,
    );
    const targetLine = view.state.doc.line(oneBasedLineNumber);

    view.dispatch({
      selection: { anchor: targetLine.from },
      effects: EditorView.scrollIntoView(targetLine.from, { y: "center" }),
    });
    view.focus();
  }, []);

  const navigateFromPreviewToSource = useCallback(
    (selection: ResumePreviewSelection) => {
      const sourceLine =
        selection.line?.sourceLine ??
        selection.line?.sourceEndLine ??
        selection.section.lines[0]?.sourceLine ??
        selection.section.lines[0]?.sourceEndLine;

      if (typeof sourceLine !== "number") {
        return;
      }

      goToPreviewPage(selection.page);
      window.requestAnimationFrame(() => {
        focusEditorAtSourceLine(sourceLine);
      });
    },
    [focusEditorAtSourceLine, goToPreviewPage],
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
    const restoreEditorView = captureEditorViewPosition(editorViewRef.current);
    setLatexCode((current) =>
      applySuggestionToLatex(current, resumeSections, suggestion),
    );
    setSuggestions((current) => current.filter((item) => item.id !== suggestion.id));
    revokePdfPreview();
    restoreEditorView();
  }

  function declineSuggestion(suggestionId: string) {
    const restoreEditorView = captureEditorViewPosition(editorViewRef.current);
    setSuggestions((current) => current.filter((item) => item.id !== suggestionId));
    restoreEditorView();
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
    persistProjectDrafts([project], { clearError: false });
  }

  function applyProjectDrafts(projects: ProjectDraft[]) {
    persistProjectDrafts(projects, { clearError: false });
  }

  function saveProjectDrafts(projects: ProjectDraft[]) {
    persistProjectDrafts(projects);
  }

  function deleteProjectDraft(index: number) {
    persistProjectDrafts(
      activeProjectDrafts.filter((_project, currentIndex) => currentIndex !== index),
    );
  }

  function insertProject() {
    const insertableProjects = activeProjectDrafts.filter(canInsertProject);

    if (insertableProjects.length === 0) {
      setError("Add at least one project with heading, explanation, and tech stack first.");
      return;
    }

    updateLatex(insertProjectsIntoLatex(latexCode, insertableProjects));
    persistProjectDrafts([]);
  }

  function persistProjectDrafts(
    projects: ProjectDraft[],
    options?: { clearError?: boolean },
  ) {
    const savedProjects = writeCachedProjectDrafts(projects);

    setProjectDraft(savedProjects[0] ?? emptyProjectDraft);
    setProjectDrafts(savedProjects);

    if (options?.clearError ?? true) {
      setError(null);
    }
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
      <div className="mx-auto flex min-h-screen max-w-[1760px] flex-col items-stretch gap-5 px-4 py-5 xl:flex-row">
        <section className="flex w-full min-w-0 flex-1 flex-col rounded-md border bg-white">
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
              <div className="flex min-h-[57px] items-center justify-between gap-3 border-b bg-white px-4 py-2">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold">LaTeX source</h2>
                  <p className="truncate text-xs text-muted-foreground">
                    Edit the .tex content used for preview and export.
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  Source
                </Badge>
              </div>
              <CodeMirror
                value={latexCode}
                height="calc(var(--workspace-pane-height) - 57px)"
                extensions={[latexLanguage, latexSuggestionExtension]}
                onCreateEditor={(view) => {
                  editorViewRef.current = view;
                }}
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
                        onNavigateToSource={navigateFromPreviewToSource}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {isInputPanelOpen ? (
          <aside className="w-full xl:w-[510px] xl:self-stretch">
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
                  <LatexProjectFields
                    project={projectDraft}
                    projects={projectDrafts}
                    onProjectChange={updateProjectDraft}
                    onProjectsChange={applyProjectDrafts}
                    onSaveProjects={saveProjectDrafts}
                    onDeleteProject={deleteProjectDraft}
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

function readCachedProjectDrafts() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const cachedValue = window.localStorage.getItem(PROJECT_CACHE_KEY);

    if (!cachedValue) {
      return [];
    }

    const parsed = JSON.parse(cachedValue) as unknown;
    const rawProjects =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as { projects?: unknown }).projects
        : parsed;

    if (!Array.isArray(rawProjects)) {
      return [];
    }

    return normalizeProjectDrafts(rawProjects);
  } catch {
    return [];
  }
}

function writeCachedProjectDrafts(projects: ProjectDraft[]) {
  const normalizedProjects = normalizeProjectDrafts(projects);

  if (typeof window === "undefined") {
    return normalizedProjects;
  }

  if (normalizedProjects.length > 0) {
    window.localStorage.setItem(
      PROJECT_CACHE_KEY,
      JSON.stringify({ projects: normalizedProjects }),
    );
  } else {
    window.localStorage.removeItem(PROJECT_CACHE_KEY);
  }

  return normalizedProjects;
}

function normalizeProjectDrafts(projects: unknown[]) {
  return projects
    .map((project) => normalizeProjectDraft(project))
    .filter(isProjectDraftWithContent);
}

function normalizeProjectDraft(project: unknown): ProjectDraft | undefined {
  if (!project || typeof project !== "object" || Array.isArray(project)) {
    return undefined;
  }

  const record = project as Partial<Record<keyof ProjectDraft, unknown>>;
  const normalizedProject = {
    heading: normalizeProjectField(record.heading),
    explanation: normalizeProjectField(record.explanation),
    techStack: normalizeProjectField(record.techStack),
    fromDate: normalizeProjectField(record.fromDate),
    toDate: normalizeProjectField(record.toDate),
  };

  return hasProjectDraftContent(normalizedProject) ? normalizedProject : undefined;
}

function normalizeProjectField(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isProjectDraftWithContent(
  project: ProjectDraft | undefined,
): project is ProjectDraft {
  return Boolean(project);
}

function captureEditorViewPosition(view: EditorView | null) {
  if (!view) {
    return () => {};
  }

  const selectionHead = view.state.selection.main.head;
  const scrollTop = view.scrollDOM.scrollTop;
  const scrollLeft = view.scrollDOM.scrollLeft;

  return () => {
    window.requestAnimationFrame(() => {
      const activeView = view;

      if (!activeView) {
        return;
      }

      activeView.dispatch({
        selection: { anchor: Math.min(selectionHead, activeView.state.doc.length) },
      });
      activeView.scrollDOM.scrollTop = scrollTop;
      activeView.scrollDOM.scrollLeft = scrollLeft;
      activeView.focus();
    });
  };
}
