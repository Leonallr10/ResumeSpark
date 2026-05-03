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
import { motion, AnimatePresence } from "framer-motion";
import { Toaster, toast } from "sonner";
import {
  CheckCheck,
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
  Settings2,
  KeyRound,
  Redo2,
  Undo2,
  Upload,
  X,
} from "lucide-react";


import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createLatexSuggestionExtension } from "@/components/latex-editor-suggestions";
import { createPolishExtension } from "@/components/latex-polish-extension";
import {
  emptyProjectDraft,
  LatexProjectFields,
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
  LlmProvider,
  PolishAction,
  PolishState,
  ResumeSection,
  SectionReview,
  SuggestionResponse,
} from "@/types/resume";

const COMPANY_ROLE_LIMIT = 300;
const JD_LIMIT = 20000;
const PROJECT_CACHE_KEY = "resume-tailor-projects-v1";
const LLM_SETTINGS_CACHE_KEY = "resume-tailor-llm-settings-v1";
const LEGACY_GEMINI_SETTINGS_KEY = "resume-tailor-gemini-settings-v1";
const MIN_EDITOR_PANE_WIDTH = 34;
const MAX_EDITOR_PANE_WIDTH = 68;
const PDF_ZOOM_STEP = 10;
const PREVIEW_WHEEL_ZOOM_STEP = 2;
const latexLanguage = StreamLanguage.define(stex);

type ViewMode = "preview" | "pdf";
type InputSidebarTab = "project" | "jd";
type CompilerStatus = {
  available: boolean;
  compiler: string | null;
  message: string;
};

type LlmSettings = {
  provider: LlmProvider;
  model: string;
  geminiApiKey: string;
  groqApiKey: string;
  claudeApiKey: string;
};

const MODEL_OPTIONS: { provider: LlmProvider; model: string; label: string }[] = [
  { provider: "gemini", model: "gemini-1.5-pro", label: "Gemini 1.5 Pro (Recommended)" },
  { provider: "gemini", model: "gemini-1.5-pro-latest", label: "Gemini 1.5 Pro Latest" },
  { provider: "gemini", model: "gemini-pro", label: "Gemini Pro 1.0 (Legacy)" },
  { provider: "groq", model: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Groq)" },
  { provider: "claude", model: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
];

function providerForModel(model: string): LlmProvider {
  return MODEL_OPTIONS.find((opt) => opt.model === model)?.provider ?? "gemini";
}

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
  const [geminiSettingsOpen, setGeminiSettingsOpen] = useState(false);
  const [llmProvider, setLlmProvider] = useState<LlmProvider>("gemini");
  const [llmModel, setLlmModel] = useState("gemini-1.5-pro");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [groqApiKey, setGroqApiKey] = useState("");
  const [claudeApiKey, setClaudeApiKey] = useState("");
  const [testingKey, setTestingKey] = useState(false);
  const [testKeyResult, setTestKeyResult] = useState<{ ok: boolean; message: string } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const previewPaneRef = useRef<HTMLDivElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const paneGridRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const acceptSuggestionRef = useRef<(suggestion: AiSuggestion) => void>(() => { });
  const declineSuggestionRef = useRef<(suggestionId: string) => void>(() => { });
  const [editorPaneWidth, setEditorPaneWidth] = useState(54);
  const [isPaneResizing, setIsPaneResizing] = useState(false);
  const [activeSuggestionId, setActiveSuggestionId] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const latestLatexRef = useRef(latexCode);
  const isApplyingHistoryRef = useRef(false);
  const pastLatexRef = useRef<string[]>([]);
  const futureLatexRef = useRef<string[]>([]);
  const preTypingBaselineRef = useRef<string | null>(null);
  const typingIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [polishState, setPolishState] = useState<PolishState>(null);
  const polishAbortRef = useRef<AbortController | null>(null);
  const LATEX_HISTORY_DEBOUNCE_MS = 450;

  latestLatexRef.current = latexCode;

  const { canUndoLatex, canRedoLatex } = useMemo(
    () => ({
      canUndoLatex: pastLatexRef.current.length > 0,
      canRedoLatex: futureLatexRef.current.length > 0,
    }),
    [historyVersion],
  );

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
    const cached = readCachedLlmSettings();
    if (!cached) return;
    setLlmProvider(cached.provider);
    setLlmModel(cached.model);
    setGeminiApiKey(cached.geminiApiKey);
    setGroqApiKey(cached.groqApiKey);
    setClaudeApiKey(cached.claudeApiKey);
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

  useEffect(() => {
    const element = previewScrollRef.current;

    if (!element) {
      return;
    }

    const handleNativeWheel = (event: globalThis.WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }

      // Prevent browser/page zoom while pinching inside preview pane.
      event.preventDefault();
      const previousZoom = previewZoom;
      const zoomDirection = event.deltaY < 0 ? 1 : -1;
      const nextZoom = clampPdfZoom(previousZoom + zoomDirection * PREVIEW_WHEEL_ZOOM_STEP);

      if (nextZoom === previousZoom) {
        return;
      }

      setPreviewZoom(nextZoom);
    };

    element.addEventListener("wheel", handleNativeWheel, { passive: false });

    return () => {
      element.removeEventListener("wheel", handleNativeWheel);
    };
  }, [previewZoom]);

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

      // Keep the current preview scroll position stable on click.
      // Only update page indicator + jump the editor to source.
      setPreviewPage(selection.page);
      setPreviewPageInput(String(selection.page));
      window.requestAnimationFrame(() => {
        focusEditorAtSourceLine(sourceLine);
      });
    },
    [focusEditorAtSourceLine],
  );

  const canSubmit =
    resumeSections.length > 0 &&
    latexCode.trim().length > 0 &&
    companyRole.trim().length > 0 &&
    companyRole.length <= COMPANY_ROLE_LIMIT &&
    jd.trim().length > 0 &&
    jd.length <= JD_LIMIT &&
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
  const sourceLineById = useMemo(
    () =>
      new Map(
        resumeSections.flatMap((section) =>
          section.lines.map((line) => [line.id, line.sourceLine] as const),
        ),
      ),
    [resumeSections],
  );
  const sourceEndLineById = useMemo(
    () =>
      new Map(
        resumeSections.flatMap((section) =>
          section.lines.map(
            (line) => [line.id, line.sourceEndLine ?? line.sourceLine] as const,
          ),
        ),
      ),
    [resumeSections],
  );
  const orderedSuggestions = useMemo(
    () =>
      suggestions
        .map((suggestion) => ({
          suggestion,
          sourceLine: sourceLineById.get(suggestion.targetLineId),
        }))
        .filter(
          (entry): entry is { suggestion: AiSuggestion; sourceLine: number } =>
            typeof entry.sourceLine === "number",
        )
        .sort((a, b) => a.sourceLine - b.sourceLine),
    [sourceLineById, suggestions],
  );
  const activeSuggestionIndex = useMemo(
    () => orderedSuggestions.findIndex((entry) => entry.suggestion.id === activeSuggestionId),
    [activeSuggestionId, orderedSuggestions],
  );

  const latexSuggestionExtension = useMemo(
    () =>
      createLatexSuggestionExtension({
        sections: resumeSections,
        suggestionsByLine,
        onAcceptSuggestion: (suggestion) => acceptSuggestionRef.current(suggestion),
        onDeclineSuggestion: (suggestionId) => declineSuggestionRef.current(suggestionId),
      }),
    [resumeSections, suggestionsByLine],
  );

  useEffect(() => {
    if (orderedSuggestions.length === 0) {
      setActiveSuggestionId(null);
      return;
    }

    if (!orderedSuggestions.some((entry) => entry.suggestion.id === activeSuggestionId)) {
      setActiveSuggestionId(orderedSuggestions[0].suggestion.id);
    }
  }, [activeSuggestionId, orderedSuggestions]);

  useEffect(() => {
    const activeSuggestion = orderedSuggestions.find(
      (entry) => entry.suggestion.id === activeSuggestionId,
    );

    if (!activeSuggestion) {
      return;
    }

    window.requestAnimationFrame(() => {
      focusEditorAtSourceLine(activeSuggestion.sourceLine);
    });
  }, [activeSuggestionId, focusEditorAtSourceLine, orderedSuggestions]);

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

  useEffect(
    () => () => {
      if (typingIdleTimerRef.current) {
        clearTimeout(typingIdleTimerRef.current);
      }
      polishAbortRef.current?.abort();
    },
    [],
  );

  function bumpLatexHistory() {
    setHistoryVersion((current) => current + 1);
  }

  function commitLatexHistoryBeforeEdit(previousSnapshot: string) {
    pastLatexRef.current.push(previousSnapshot);
    futureLatexRef.current = [];
    bumpLatexHistory();
  }

  function cancelTypingHistoryDebounce(options?: { flushPending?: boolean }) {
    if (typingIdleTimerRef.current) {
      clearTimeout(typingIdleTimerRef.current);
      typingIdleTimerRef.current = null;
    }
    const baseline = preTypingBaselineRef.current;
    preTypingBaselineRef.current = null;
    if (
      options?.flushPending &&
      baseline !== null &&
      baseline !== latestLatexRef.current
    ) {
      commitLatexHistoryBeforeEdit(baseline);
    }
  }

  function undoLatex() {
    if (pastLatexRef.current.length === 0) {
      return;
    }

    cancelTypingHistoryDebounce({ flushPending: true });
    const previous = pastLatexRef.current.pop()!;
    futureLatexRef.current.push(latestLatexRef.current);
    isApplyingHistoryRef.current = true;
    setLatexCode(previous);
    setSuggestions([]);
    setSectionReviews([]);
    revokePdfPreview();
    isApplyingHistoryRef.current = false;
    latestLatexRef.current = previous;
    bumpLatexHistory();
  }

  function redoLatex() {
    if (futureLatexRef.current.length === 0) {
      return;
    }

    cancelTypingHistoryDebounce({ flushPending: true });
    const next = futureLatexRef.current.pop()!;
    pastLatexRef.current.push(latestLatexRef.current);
    isApplyingHistoryRef.current = true;
    setLatexCode(next);
    setSuggestions([]);
    setSectionReviews([]);
    revokePdfPreview();
    isApplyingHistoryRef.current = false;
    latestLatexRef.current = next;
    bumpLatexHistory();
  }

  function replaceLatexContent(value: string, options?: { recordHistory?: boolean }) {
    cancelTypingHistoryDebounce({ flushPending: true });
    if (options?.recordHistory && value !== latestLatexRef.current) {
      commitLatexHistoryBeforeEdit(latestLatexRef.current);
    }
    isApplyingHistoryRef.current = true;
    setLatexCode(value);
    setSuggestions([]);
    setSectionReviews([]);
    revokePdfPreview();
    isApplyingHistoryRef.current = false;
    latestLatexRef.current = value;
  }

  function handleLatexEditorChange(value: string) {
    if (!isApplyingHistoryRef.current) {
      if (preTypingBaselineRef.current === null) {
        preTypingBaselineRef.current = latestLatexRef.current;
      }
      if (typingIdleTimerRef.current) {
        clearTimeout(typingIdleTimerRef.current);
      }
      typingIdleTimerRef.current = setTimeout(() => {
        typingIdleTimerRef.current = null;
        const baseline = preTypingBaselineRef.current;
        preTypingBaselineRef.current = null;
        const latest = latestLatexRef.current;
        if (baseline !== null && baseline !== latest) {
          commitLatexHistoryBeforeEdit(baseline);
        }
      }, LATEX_HISTORY_DEBOUNCE_MS);
    }

    latestLatexRef.current = value;
    setLatexCode(value);
    setSuggestions([]);
    setSectionReviews([]);
    revokePdfPreview();

    if (polishState) {
      polishAbortRef.current?.abort();
      setPolishState(null);
    }
  }

  async function handleTexFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".tex")) {
      setError("Upload a .tex resume file.");
      return;
    }

    setError(null);
    setLoadingFile(true);

    try {
      replaceLatexContent(await file.text(), { recordHistory: true });
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
          provider: llmProvider,
          model: llmModel.trim(),
          apiKey: (llmProvider === "groq" ? groqApiKey : llmProvider === "claude" ? claudeApiKey : geminiApiKey).trim(),
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
    const currentIndex = orderedSuggestions.findIndex(
      (entry) => entry.suggestion.id === suggestion.id,
    );
    const nextSuggestion =
      orderedSuggestions[currentIndex + 1]?.suggestion ??
      orderedSuggestions[currentIndex - 1]?.suggestion;
    const sourceLine = sourceLineById.get(suggestion.targetLineId);
    const sourceEndLine =
      sourceEndLineById.get(suggestion.targetLineId) ?? sourceLine;
    const currentLatex = latestLatexRef.current;
    const currentSections = parseLatexResume(currentLatex);
    cancelTypingHistoryDebounce({ flushPending: true });
    commitLatexHistoryBeforeEdit(currentLatex);
    const nextLatex = applySuggestionToLatex(currentLatex, currentSections, suggestion);
    const lineDelta = countLatexLines(nextLatex) - countLatexLines(currentLatex);

    isApplyingHistoryRef.current = true;
    setLatexCode(nextLatex);
    setSuggestions((current) =>
      retargetSuggestionsAfterAccepted(
        current,
        suggestion,
        typeof sourceLine === "number" && typeof sourceEndLine === "number"
          ? { sourceLine, sourceEndLine }
          : undefined,
        lineDelta,
      ),
    );
    setActiveSuggestionId(nextSuggestion?.id ?? null);
    revokePdfPreview();
    isApplyingHistoryRef.current = false;
    latestLatexRef.current = nextLatex;
  }

  function declineSuggestion(suggestionId: string) {
    const currentIndex = orderedSuggestions.findIndex(
      (entry) => entry.suggestion.id === suggestionId,
    );
    const nextSuggestion =
      orderedSuggestions[currentIndex + 1]?.suggestion ??
      orderedSuggestions[currentIndex - 1]?.suggestion;

    setSuggestions((current) => current.filter((item) => item.id !== suggestionId));
    setActiveSuggestionId(nextSuggestion?.id ?? null);
  }

  acceptSuggestionRef.current = acceptSuggestion;
  declineSuggestionRef.current = declineSuggestion;

  function acceptAllSuggestions() {
    if (orderedSuggestions.length === 0) {
      return;
    }

    cancelTypingHistoryDebounce({ flushPending: true });

    const sorted = [...orderedSuggestions].sort((left, right) => {
      if (left.sourceLine !== right.sourceLine) {
        return right.sourceLine - left.sourceLine;
      }
      const actionPriority = (action: string) =>
        action === "replace" ? 0 : action === "insert_after" ? 1 : action === "insert_before" ? 2 : 3;
      return actionPriority(left.suggestion.action) - actionPriority(right.suggestion.action);
    });

    const replaces = sorted.filter((s) => s.suggestion.action === "replace");
    const inserts = sorted.filter(
      (s) => s.suggestion.action === "insert_before" || s.suggestion.action === "insert_after",
    );
    const deletes = sorted.filter((s) => s.suggestion.action === "delete");

    let result = latestLatexRef.current;
    for (const entry of replaces) {
      commitLatexHistoryBeforeEdit(result);
      result = applySuggestionToLatex(result, parseLatexResume(result), entry.suggestion);
    }
    for (const entry of inserts) {
      commitLatexHistoryBeforeEdit(result);
      result = applySuggestionToLatex(result, parseLatexResume(result), entry.suggestion);
    }
    for (const entry of deletes) {
      commitLatexHistoryBeforeEdit(result);
      result = applySuggestionToLatex(result, parseLatexResume(result), entry.suggestion);
    }

    isApplyingHistoryRef.current = true;
    setLatexCode(result);
    setSuggestions([]);
    setSectionReviews([]);
    setActiveSuggestionId(null);
    revokePdfPreview();
    isApplyingHistoryRef.current = false;
    latestLatexRef.current = result;
  }

  function declineAllSuggestions() {
    setSuggestions([]);
    setSectionReviews([]);
    setActiveSuggestionId(null);
  }

  const handleTriggerPolish = useCallback(
    async (action: PolishAction, text: string, range: { from: number; to: number }) => {
      polishAbortRef.current?.abort();
      const controller = new AbortController();
      polishAbortRef.current = controller;

      setPolishState({ range, original: text, polished: null, loading: true, action });

      try {
        const response = await fetch("/api/resume/polish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            action,
            provider: llmProvider,
            model: llmModel.trim(),
            apiKey: (llmProvider === "groq" ? groqApiKey : llmProvider === "claude" ? claudeApiKey : geminiApiKey).trim(),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({ error: "Polish request failed." }));
          throw new Error(payload.error || "Polish request failed.");
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let result = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          result += decoder.decode(value, { stream: true });
          setPolishState((prev) =>
            prev ? { ...prev, polished: result, loading: true } : null,
          );
        }

        setPolishState((prev) =>
          prev ? { ...prev, polished: result, loading: false } : null,
        );
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Polish request failed.");
        setPolishState(null);
      }
    },
    [llmProvider, llmModel, geminiApiKey, groqApiKey, claudeApiKey],
  );

  const handleAcceptPolish = useCallback(
    (polished: string, range: { from: number; to: number }) => {
      const view = editorViewRef.current;
      if (!view) return;

      cancelTypingHistoryDebounce({ flushPending: true });
      commitLatexHistoryBeforeEdit(latestLatexRef.current);

      view.dispatch({
        changes: { from: range.from, to: range.to, insert: polished },
      });

      const newDoc = view.state.doc.toString();
      latestLatexRef.current = newDoc;
      isApplyingHistoryRef.current = true;
      setLatexCode(newDoc);
      setSuggestions([]);
      setSectionReviews([]);
      revokePdfPreview();
      isApplyingHistoryRef.current = false;
      setPolishState(null);
    },
    [revokePdfPreview],
  );

  const handleRejectPolish = useCallback(() => {
    polishAbortRef.current?.abort();
    setPolishState(null);
  }, []);

  const latexPolishExtension = useMemo(
    () =>
      createPolishExtension({
        polishState,
        hasSuggestions: suggestions.length > 0,
        onTriggerPolish: handleTriggerPolish,
        onAcceptPolish: handleAcceptPolish,
        onRejectPolish: handleRejectPolish,
      }),
    [polishState, suggestions.length, handleTriggerPolish, handleAcceptPolish, handleRejectPolish],
  );

  function focusSuggestionAtIndex(index: number) {
    if (orderedSuggestions.length === 0) {
      return;
    }

    const nextIndex =
      (index + orderedSuggestions.length) % orderedSuggestions.length;
    const nextSuggestion = orderedSuggestions[nextIndex];

    setActiveSuggestionId(nextSuggestion.suggestion.id);
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

    replaceLatexContent(insertProjectsIntoLatex(latexCode, insertableProjects), {
      recordHistory: true,
    });
    persistProjectDrafts([]);
    toast.success(`${insertableProjects.length} project(s) inserted into LaTeX source.`);
  }

  function insertSingleProject(index: number) {
    const project = activeProjectDrafts[index];
    if (!project || !canInsertProject(project)) {
      setError("This project is missing heading, explanation, or tech stack.");
      return;
    }

    replaceLatexContent(insertProjectsIntoLatex(latexCode, [project]), {
      recordHistory: true,
    });
    toast.success("Project inserted into LaTeX source.");
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
    const pageCards = Array.from(
      exportRoot.querySelectorAll<HTMLDivElement>(".resume-preview-page"),
    );
    const printablePages = pageWrappers.filter(hasRenderablePageContent);
    const exportPageWidthPx = Math.floor(previewLayout.pageWidthPx);
    const exportPageHeightPx = Math.floor(previewLayout.pageHeightPx);

    if (printablePages.length === 0) {
      throw new Error("Preview does not contain any printable content.");
    }

    // Remove preview layout classes so export sizing stays deterministic.
    exportRoot.className = "";
    exportRoot.classList.add("resume-export");
    exportRoot.style.width = `${exportPageWidthPx}px`;
    exportRoot.style.minWidth = `${exportPageWidthPx}px`;
    exportRoot.style.maxWidth = `${exportPageWidthPx}px`;
    exportRoot.style.margin = "0";
    exportRoot.style.padding = "0";
    exportRoot.style.overflow = "hidden";
    exportRoot.style.background = "#ffffff";
    exportRoot.style.boxSizing = "border-box";

    if (pagesContainer) {
      pagesContainer.classList.remove("space-y-6", "py-1");
      pagesContainer.style.display = "flex";
      pagesContainer.style.flexDirection = "column";
      pagesContainer.style.gap = "0";
      pagesContainer.style.padding = "0";
    }

    pageWrappers
      .filter((page) => !printablePages.includes(page))
      .forEach((page) => page.remove());

    printablePages.forEach((page, index) => {
      page.style.width = `${exportPageWidthPx}px`;
      page.style.height = `${exportPageHeightPx}px`;
      page.style.display = "block";
      page.style.margin = "0";
      page.style.padding = "0";
      page.style.overflow = "hidden";
      page.style.pageBreakInside = "avoid";
      page.style.breakInside = "avoid";
      page.style.pageBreakAfter = index === printablePages.length - 1 ? "auto" : "always";
      page.style.breakAfter = index === printablePages.length - 1 ? "auto" : "page";
    });

    pageCards.forEach((page) => {
      page.style.transform = "none";
      page.style.transformOrigin = "top center";
      page.style.width = `${exportPageWidthPx}px`;
      page.style.height = `${exportPageHeightPx}px`;
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
          pagebreak: { mode: [] },
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
    <main className="flex h-dvh max-h-dvh min-h-0 flex-col bg-[#f4f8f8]">
      <Toaster position="top-right" richColors />
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
      {geminiSettingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
          <div className="w-full max-w-md rounded-lg border bg-white p-4 shadow-xl">
            <div className="mb-4">
              <h2 className="text-base font-semibold">AI Model Settings</h2>
              <p className="text-sm text-muted-foreground">
                Choose a model and save API keys locally in this browser.
              </p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="llmModel">Model</Label>
                <select
                  id="llmModel"
                  value={llmModel}
                  onChange={(event) => {
                    setLlmModel(event.target.value);
                    setLlmProvider(providerForModel(event.target.value));
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <optgroup label="Gemini">
                    {MODEL_OPTIONS.filter((o) => o.provider === "gemini").map((o) => (
                      <option key={o.model} value={o.model}>{o.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Groq">
                    {MODEL_OPTIONS.filter((o) => o.provider === "groq").map((o) => (
                      <option key={o.model} value={o.model}>{o.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Claude">
                    {MODEL_OPTIONS.filter((o) => o.provider === "claude").map((o) => (
                      <option key={o.model} value={o.model}>{o.label}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div className={`space-y-1.5 rounded-md p-2 ${llmProvider === "gemini" ? "bg-emerald-50 ring-1 ring-emerald-200" : ""}`}>
                <Label htmlFor="geminiApiKey">Gemini API Key</Label>
                <Input
                  id="geminiApiKey"
                  type="password"
                  value={geminiApiKey}
                  onChange={(event) => setGeminiApiKey(event.target.value)}
                  placeholder="AIza..."
                  autoComplete="off"
                />
              </div>
              <div className={`space-y-1.5 rounded-md p-2 ${llmProvider === "groq" ? "bg-emerald-50 ring-1 ring-emerald-200" : ""}`}>
                <Label htmlFor="groqApiKey">Groq API Key</Label>
                <Input
                  id="groqApiKey"
                  type="password"
                  value={groqApiKey}
                  onChange={(event) => setGroqApiKey(event.target.value)}
                  placeholder="gsk_..."
                  autoComplete="off"
                />
              </div>
              <div className={`space-y-1.5 rounded-md p-2 ${llmProvider === "claude" ? "bg-emerald-50 ring-1 ring-emerald-200" : ""}`}>
                <Label htmlFor="claudeApiKey">Claude API Key</Label>
                <Input
                  id="claudeApiKey"
                  type="password"
                  value={claudeApiKey}
                  onChange={(event) => setClaudeApiKey(event.target.value)}
                  placeholder="sk-ant-..."
                  autoComplete="off"
                />
              </div>
            </div>
            {testKeyResult ? (
              <div className={`mt-3 rounded-md px-3 py-2 text-sm ${testKeyResult.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
                {testKeyResult.ok ? "✓ " : "✗ "}{testKeyResult.message}
              </div>
            ) : null}
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={testingKey}
                onClick={async () => {
                  const activeKey = (llmProvider === "groq" ? groqApiKey : llmProvider === "claude" ? claudeApiKey : geminiApiKey).trim();
                  if (!activeKey) {
                    setTestKeyResult({ ok: false, message: `No ${llmProvider} API key entered.` });
                    return;
                  }
                  setTestingKey(true);
                  setTestKeyResult(null);
                  try {
                    const res = await fetch("/api/resume/test-key", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ provider: llmProvider, model: llmModel, apiKey: activeKey }),
                    });
                    const data = await res.json() as { ok: boolean; error?: string; reply?: string };
                    if (data.ok) {
                      setTestKeyResult({ ok: true, message: `Key works! Response: "${data.reply}"` });
                      toast.success(`${llmProvider.toUpperCase()} API key is valid!`);
                    } else {
                      setTestKeyResult({ ok: false, message: data.error || "Test failed." });
                      toast.error(`API key test failed: ${data.error || "Unknown error"}`);
                    }
                  } catch {
                    setTestKeyResult({ ok: false, message: "Network error." });
                    toast.error("Network error during API key test.");
                  } finally {
                    setTestingKey(false);
                  }
                }}
              >
                {testingKey ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                Test Key
              </Button>
              <Button type="button" variant="outline" onClick={() => { setGeminiSettingsOpen(false); setTestKeyResult(null); }}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const nextSettings: LlmSettings = {
                    provider: llmProvider,
                    model: llmModel.trim() || "gemini-1.5-pro",
                    geminiApiKey: geminiApiKey.trim(),
                    groqApiKey: groqApiKey.trim(),
                    claudeApiKey: claudeApiKey.trim(),
                  };

                  setLlmProvider(nextSettings.provider);
                  setLlmModel(nextSettings.model);
                  setGeminiApiKey(nextSettings.geminiApiKey);
                  setGroqApiKey(nextSettings.groqApiKey);
                  setClaudeApiKey(nextSettings.claudeApiKey);
                  writeCachedLlmSettings(nextSettings);
                  setGeminiSettingsOpen(false);
                  setTestKeyResult(null);
                  toast.success("AI model settings saved successfully!");
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="mx-auto flex min-h-0 w-full flex-1 flex-col items-stretch gap-5 px-4 py-5 xl:flex-row xl:items-stretch">
        <section className="flex w-full min-w-0 flex-1 min-h-0 flex-col rounded-md border bg-white xl:min-h-0">
          <div className="flex flex-col gap-3 border-b bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-normal">Resume Tailor</h1>
              <p className="text-sm text-muted-foreground">
                Edit LaTeX source, review AI edits, preview the resume, export PDF.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10 gap-2"
                onClick={() => setGeminiSettingsOpen(true)}
              >
                <KeyRound className="h-4 w-4" />
              </Button>
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
              {/* <Button
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
              </Button> */}
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
            className="grid min-h-0 flex-1 grid-rows-[1fr_1fr] gap-0 overflow-hidden lg:grid-cols-[minmax(320px,var(--editor-pane-width))_10px_minmax(380px,1fr)] lg:grid-rows-1"
            style={
              {
                "--editor-pane-width": `${editorPaneWidth}%`,
              } as CSSProperties
            }
          >
            <div className="flex min-h-0 flex-col border-b lg:h-full lg:border-b-0 lg:border-r">
              {orderedSuggestions.length > 0 ? (
                <div className="flex min-h-[57px] flex-wrap items-center justify-between gap-2 border-b bg-white px-3 py-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">LaTeX source</h2>
                    <p className="truncate text-xs text-muted-foreground">
                      {`Suggestion ${Math.max(activeSuggestionIndex + 1, 1)} of ${orderedSuggestions.length}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => focusSuggestionAtIndex(activeSuggestionIndex - 1)}
                      disabled={orderedSuggestions.length === 0}
                      aria-label="Previous suggested change"
                      title="Previous suggested change"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => focusSuggestionAtIndex(activeSuggestionIndex + 1)}
                      disabled={orderedSuggestions.length === 0}
                      aria-label="Next suggested change"
                      title="Next suggested change"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    <span className="mx-0.5 hidden h-5 w-px bg-border sm:block" />
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={acceptAllSuggestions}
                      disabled={orderedSuggestions.length === 0}
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Accept all
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={declineAllSuggestions}
                      disabled={orderedSuggestions.length === 0}
                    >
                      <X className="h-3.5 w-3.5" />
                      Decline all
                    </Button>
                  </div>
                </div>
              ) : null}
              <CodeMirror
                value={latexCode}
                height="100%"
                extensions={[latexLanguage, latexSuggestionExtension, latexPolishExtension]}
                onCreateEditor={(view) => {
                  editorViewRef.current = view;
                }}
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  highlightActiveLine: true,
                  highlightSelectionMatches: true,
                }}
                onChange={handleLatexEditorChange}
                className="min-h-0 flex-1 text-sm [&_.cm-editor]:h-full"
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
              className={`hidden h-full min-h-0 cursor-col-resize items-center justify-center self-stretch border-r bg-border/60 transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex ${isPaneResizing ? "bg-primary/20" : ""
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

            <div className="h-full min-h-0 bg-[#e8eeee]">
              <div className="flex h-full min-h-0 flex-col">
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
                      className="h-7 w-7 text-slate-100 hover:bg-slate-700 hover:text-slate-100 disabled:opacity-40"
                      onClick={undoLatex}
                      disabled={!canUndoLatex}
                      aria-label="Undo LaTeX edit"
                      title="Undo LaTeX edit"
                    >
                      <Undo2 className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-100 hover:bg-slate-700 hover:text-slate-100 disabled:opacity-40"
                      onClick={redoLatex}
                      disabled={!canRedoLatex}
                      aria-label="Redo LaTeX edit"
                      title="Redo LaTeX edit"
                    >
                      <Redo2 className="h-4 w-4" />
                    </Button>
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

                <div ref={previewPaneRef} className="min-h-0 flex-1 overflow-hidden">
                  {viewMode === "pdf" ? (
                    <PdfPreview pdfUrl={pdfUrl} rendering={renderingPdf} zoom={previewZoom} />
                  ) : (
                    <div
                      ref={previewScrollRef}
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

        <AnimatePresence mode="wait">
          {isInputPanelOpen && (
            <motion.aside
              initial={{ opacity: 0, x: 20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: "100%" }}
              exit={{ opacity: 0, x: 20, width: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="flex w-full min-h-0 flex-col xl:w-[510px] xl:max-w-[510px] xl:self-stretch overflow-hidden"
            >
              <Card className="sticky top-5 min-h-0 flex-1 xl:flex xl:h-full xl:min-h-0 xl:flex-col">
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
                      className={`h-8 text-xs ${inputSidebarTab === "project"
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
                      className={`h-8 text-xs ${inputSidebarTab === "jd"
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

                  <AnimatePresence mode="wait">
                    {inputSidebarTab === "project" ? (
                      <motion.div
                        key="project"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="w-full"
                      >
                        <LatexProjectFields
                          project={projectDraft}
                          projects={projectDrafts}
                          onProjectChange={updateProjectDraft}
                          onProjectsChange={applyProjectDrafts}
                          onSaveProjects={saveProjectDrafts}
                          onDeleteProject={deleteProjectDraft}
                          onInsertProject={insertProject}
                          onInsertSingleProject={insertSingleProject}
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="jd"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="w-full"
                      >
                        <div className="w-full space-y-3 rounded-md border bg-white p-3 shadow-sm">
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

                          <div className="btn-wrapper group relative flex w-full items-center justify-center py-4">
                            <style>{`
                              .btn-wrapper {
                                --dot-size: 8px;
                                --line-weight: 1px;
                                --line-distance: 0.8rem 1rem;
                                --animation-speed: 2s;
                                --dot-color: #059669;
                                --line-color: #10b981;
                                --grid-color: rgba(16, 185, 129, 0.1);
                              }

                              .btn-wrapper::after {
                                content: "";
                                position: absolute;
                                inset: 0.5rem;
                                border-radius: 8px;
                                pointer-events: none;
                                background-image: repeating-linear-gradient(45deg, var(--grid-color) 0 1px, transparent 2px 5px);
                                z-index: -1;
                                animation: grid-opacity 4s ease-in-out infinite;
                              }

                              @keyframes grid-opacity {
                                0%, 100% { opacity: 0.2; }
                                50% { opacity: 0.6; }
                              }

                              .btn-wrapper .btn {
                                position: relative;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                width: 100%;
                                padding: 0.8rem 1.25rem;
                                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                                border: none;
                                color: #fff;
                                font-family: inherit;
                                font-size: 0.875rem;
                                font-weight: 600;
                                border-radius: 8px;
                                cursor: pointer;
                                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                                z-index: 10;
                                box-shadow: 0 4px 14px 0 rgba(16, 185, 129, 0.39);
                              }

                              .btn-wrapper .btn:hover:not(:disabled) {
                                transform: translateY(-2px);
                                background: linear-gradient(135deg, #059669 0%, #047857 100%);
                                box-shadow: 0 6px 20px rgba(5, 150, 105, 0.23);
                              }

                              .btn-wrapper .btn:active:not(:disabled) {
                                transform: scale(0.98);
                              }

                              .btn-wrapper .btn:disabled {
                                background: #94a3b8;
                                box-shadow: none;
                                cursor: not-allowed;
                              }

                              .btn-wrapper .btn-svg {
                                margin-left: 0.5rem;
                                height: 20px;
                                width: 20px;
                                stroke-width: 1.5;
                                stroke: currentColor;
                                fill: rgba(255, 255, 255, 0.2);
                              }

                              .btn-wrapper .dot {
                                position: absolute;
                                width: var(--dot-size);
                                height: var(--dot-size);
                                border-radius: 2px;
                                background-color: var(--dot-color);
                                opacity: 0;
                                z-index: 5;
                              }

                              .btn-wrapper .dot.top.left { animation: move-top-left var(--animation-speed) ease-in-out infinite; }
                              .btn-wrapper .dot.top.right { animation: move-top-right var(--animation-speed) ease-in-out infinite; animation-delay: 0.5s; }
                              .btn-wrapper .dot.bottom.right { animation: move-bottom-right var(--animation-speed) ease-in-out infinite; animation-delay: 1s; }
                              .btn-wrapper .dot.bottom.left { animation: move-bottom-left var(--animation-speed) ease-in-out infinite; animation-delay: 1.5s; }

                              @keyframes move-top-left {
                                0% { top: 50%; left: 50%; opacity: 0; transform: scale(0); }
                                20% { opacity: 0.8; }
                                100% { top: 0; left: 0; opacity: 0; transform: scale(1); }
                              }
                              @keyframes move-top-right {
                                0% { top: 50%; right: 50%; opacity: 0; transform: scale(0); }
                                20% { opacity: 0.8; }
                                100% { top: 0; right: 0; opacity: 0; transform: scale(1); }
                              }
                              @keyframes move-bottom-right {
                                0% { bottom: 50%; right: 50%; opacity: 0; transform: scale(0); }
                                20% { opacity: 0.8; }
                                100% { bottom: 0; right: 0; opacity: 0; transform: scale(1); }
                              }
                              @keyframes move-bottom-left {
                                0% { bottom: 50%; left: 50%; opacity: 0; transform: scale(0); }
                                20% { opacity: 0.8; }
                                100% { bottom: 0; left: 0; opacity: 0; transform: scale(1); }
                              }

                              .btn-wrapper .line {
                                position: absolute;
                                background-color: var(--line-color);
                                opacity: 0;
                                z-index: 5;
                              }

                              .btn-wrapper .line.horizontal {
                                height: var(--line-weight);
                                width: 100%;
                                background-image: repeating-linear-gradient(90deg, transparent 0 4px, var(--line-color) 4px 8px);
                              }

                              .btn-wrapper .line.vertical {
                                width: var(--line-weight);
                                height: 100%;
                                background-image: repeating-linear-gradient(0deg, transparent 0 4px, var(--line-color) 4px 8px);
                              }

                              .btn-wrapper .line.top { top: 0.5rem; animation: draw-h var(--animation-speed) linear infinite; }
                              .btn-wrapper .line.bottom { bottom: 0.5rem; animation: draw-h var(--animation-speed) linear infinite; animation-delay: 1s; }
                              .btn-wrapper .line.left { left: 0.5rem; animation: draw-v var(--animation-speed) linear infinite; animation-delay: 1.5s; }
                              .btn-wrapper .line.right { right: 0.5rem; animation: draw-v var(--animation-speed) linear infinite; animation-delay: 0.5s; }

                              @keyframes draw-h {
                                0%, 100% { transform: scaleX(0); opacity: 0; }
                                50% { transform: scaleX(1); opacity: 0.5; }
                              }
                              @keyframes draw-v {
                                0%, 100% { transform: scaleY(0); opacity: 0; }
                                50% { transform: scaleY(1); opacity: 0.5; }
                              }

                              .btn:disabled ~ .dot,
                              .btn:disabled ~ .line {
                                display: none;
                              }
                            `}</style>

                            <div className="line horizontal top"></div>
                            <div className="line vertical right"></div>
                            <div className="line horizontal bottom"></div>
                            <div className="line vertical left"></div>

                            <div className="dot top left"></div>
                            <div className="dot top right"></div>
                            <div className="dot bottom right"></div>
                            <div className="dot bottom left"></div>

                            <button
                              type="button"
                              className="btn"
                              disabled={!canSubmit || suggesting}
                              onClick={requestSuggestions}
                            >
                              {suggesting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <svg className="btn-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M17.6744 11.4075L15.7691 17.1233C15.7072 17.309 15.5586 17.4529 15.3709 17.5087L3.69348 20.9803C3.22819 21.1186 2.79978 20.676 2.95328 20.2155L6.74467 8.84131C6.79981 8.67588 6.92419 8.54263 7.08543 8.47624L12.472 6.25822C12.696 6.166 12.9535 6.21749 13.1248 6.38876L17.5294 10.7935C17.6901 10.9542 17.7463 11.1919 17.6744 11.4075Z" />
                                  <path d="M3.2959 20.6016L9.65986 14.2376" />
                                  <path d="M17.7917 11.0557L20.6202 8.22724C21.4012 7.44619 21.4012 6.17986 20.6202 5.39881L18.4989 3.27749C17.7178 2.49645 16.4515 2.49645 15.6704 3.27749L12.842 6.10592" />
                                  <path d="M11.7814 12.1163C11.1956 11.5305 10.2458 11.5305 9.66004 12.1163C9.07426 12.7021 9.07426 13.6519 9.66004 14.2376C10.2458 14.8234 11.1956 14.8234 11.7814 14.2376C12.3671 13.6519 12.3671 12.7021 11.7814 12.1163Z" />
                                </svg>
                              )}
                              Suggest resume changes
                            </button>
                          </div>

                          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                            Suggestions update the LaTeX source, so the editable .tex remains the
                            source of truth.
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function hasRenderablePageContent(page: HTMLDivElement) {
  const text = (page.textContent ?? "").replace(/\s+/g, " ").trim();

  if (text.length > 0) {
    return true;
  }

  return Boolean(page.querySelector("img,svg,canvas,table"));
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
      className={`text-right text-xs ${isOver ? "text-destructive" : "text-muted-foreground"
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

function readCachedLlmSettings(): LlmSettings | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const cachedValue = window.localStorage.getItem(LLM_SETTINGS_CACHE_KEY);

    if (cachedValue) {
      const parsed = JSON.parse(cachedValue) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return {
          provider: (["gemini", "groq", "claude"].includes(parsed.provider as string)
            ? parsed.provider
            : "gemini") as LlmProvider,
          model: typeof parsed.model === "string" ? parsed.model : "gemini-1.5-pro",
          geminiApiKey: typeof parsed.geminiApiKey === "string" ? parsed.geminiApiKey : "",
          groqApiKey: typeof parsed.groqApiKey === "string" ? parsed.groqApiKey : "",
          claudeApiKey: typeof parsed.claudeApiKey === "string" ? parsed.claudeApiKey : "",
        };
      }
    }

    const legacyValue = window.localStorage.getItem(LEGACY_GEMINI_SETTINGS_KEY);
    if (legacyValue) {
      const legacy = JSON.parse(legacyValue) as Record<string, unknown>;
      if (legacy && typeof legacy === "object") {
        return {
          provider: "gemini",
          model: typeof legacy.model === "string" ? legacy.model : "gemini-1.5-pro",
          geminiApiKey: typeof legacy.apiKey === "string" ? legacy.apiKey : "",
          groqApiKey: "",
          claudeApiKey: "",
        };
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}

function writeCachedLlmSettings(settings: LlmSettings) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LLM_SETTINGS_CACHE_KEY, JSON.stringify(settings));
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
    link: normalizeProjectField(record.link),
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

function countLatexLines(latex: string) {
  return latex.replace(/\r\n/g, "\n").split("\n").length;
}

function retargetSuggestionsAfterAccepted(
  suggestions: AiSuggestion[],
  acceptedSuggestion: AiSuggestion,
  acceptedLocation:
    | {
      sourceLine: number;
      sourceEndLine: number;
    }
    | undefined,
  lineDelta: number,
) {
  return suggestions.flatMap((suggestion) => {
    if (suggestion.id === acceptedSuggestion.id) {
      return [];
    }

    if (!acceptedLocation || lineDelta === 0) {
      return [suggestion];
    }

    const targetSourceLine = getSourceLineFromSuggestionId(suggestion.targetLineId);

    if (typeof targetSourceLine !== "number") {
      return [suggestion];
    }

    if (
      acceptedSuggestion.action === "delete" &&
      targetSourceLine >= acceptedLocation.sourceLine &&
      targetSourceLine <= acceptedLocation.sourceEndLine
    ) {
      if (suggestion.action === "insert_after" || suggestion.action === "insert_before") {
        const retargetLine = Math.max(0, acceptedLocation.sourceLine - 1);
        return [
          {
            ...suggestion,
            action: "insert_after" as const,
            targetLineId: `line-${retargetLine}`,
          },
        ];
      }
      return [];
    }

    const affectedStartLine =
      acceptedSuggestion.action === "insert_before"
        ? acceptedLocation.sourceLine
        : acceptedLocation.sourceEndLine + 1;

    if (targetSourceLine < affectedStartLine) {
      return [suggestion];
    }

    return [
      {
        ...suggestion,
        targetLineId: `line-${Math.max(0, targetSourceLine + lineDelta)}`,
      },
    ];
  });
}

function getSourceLineFromSuggestionId(targetLineId: string) {
  const match = targetLineId.match(/^line-(\d+)$/);

  return match ? Number.parseInt(match[1], 10) : undefined;
}
