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
import Image from "next/image";
import { Toaster, toast } from "sonner";
import {
  AlertTriangle,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  Code2,
  Crosshair,
  Download,
  Eye,
  FileText,
  FilePlus,
  FolderOpen,
  Globe,
  List,
  ListOrdered,
  Loader2,
  LogIn,
  LogOut,
  Menu,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SearchCheck,
  Sparkles,
  Settings2,
  KeyRound,
  Redo2,
  Trash2,
  Type,
  Undo2,
  Upload,
  X,
} from "lucide-react";


import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { LatexDiagnostic } from "@/types/latex-diagnostics";
import { createLatexSuggestionExtension } from "@/components/latex-editor-suggestions";
import { createPolishExtension } from "@/components/latex-polish-extension";
import {
  emptyProjectDraft,
  LatexProjectFields,
} from "@/components/latex-project-fields";
import {
  clampPdfZoom,
} from "@/components/latex-pdf-preview";
import {
  PdfCanvasViewer,
  type PdfCanvasViewerHandle,
} from "@/components/pdf-canvas-viewer";
import { fetchSynctexMapping } from "@/lib/synctex-client";
import { forwardSync, type SynctexMapping, type SynctexRect } from "@/lib/synctex-parser";
import {
  derivePreviewLayoutFromLatex,
  paginateResumeSections,
  type PreviewFontSizes,
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
import { createClient } from "@/lib/supabase";
import { extractPortfolioFromResume, portfolioToStorage } from "@/lib/portfolio";
import { openSearchPanel } from "@codemirror/search";
import { EditorView } from "@codemirror/view";
import type { User } from "@supabase/supabase-js";
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

type ResumeProject = {
  id: string;
  name: string;
  latex_code: string;
  company_role: string;
  jd: string;
  created_at: string;
  updated_at: string;
};

const MODEL_OPTIONS: { provider: LlmProvider; model: string; label: string }[] = [
  { provider: "gemini", model: "gemini-2.5-pro", label: "Gemini 2.5 Pro (Recommended)" },
  { provider: "gemini", model: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { provider: "gemini", model: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { provider: "groq", model: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Groq)" },
  { provider: "claude", model: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
];

function providerForModel(model: string): LlmProvider {
  return MODEL_OPTIONS.find((opt) => opt.model === model)?.provider ?? "gemini";
}

type FormattingType = string;

function getDynamicCommands(latex: string) {
  const customCommands: { name: string; args: number }[] = [];
  const matches = latex.matchAll(/\\newcommand\{\\([a-zA-Z]+)\}(?:\[(\d+)\])?/g);
  for (const match of matches) {
    if (!customCommands.find(c => c.name === match[1])) {
      customCommands.push({ name: match[1], args: match[2] ? parseInt(match[2], 10) : 0 });
    }
  }
  return customCommands;
}
const LATEX_SIZE_COMMANDS = [
  { cmd: "\\tiny", pt: 6 },
  { cmd: "\\scriptsize", pt: 8 },
  { cmd: "\\footnotesize", pt: 9 },
  { cmd: "\\small", pt: 10 },
  { cmd: "\\normalsize", pt: 11 },
  { cmd: "\\large", pt: 12 },
  { cmd: "\\Large", pt: 14 },
  { cmd: "\\LARGE", pt: 17 },
  { cmd: "\\huge", pt: 20 },
  { cmd: "\\Huge", pt: 25 },
] as const;

const LATEX_SIZE_TABLES: Record<number, Record<string, number>> = {
  10: { "\\tiny": 5, "\\scriptsize": 7, "\\footnotesize": 8, "\\small": 9, "\\normalsize": 10, "\\large": 12, "\\Large": 14, "\\LARGE": 17, "\\huge": 21, "\\Huge": 25 },
  11: { "\\tiny": 6, "\\scriptsize": 8, "\\footnotesize": 9, "\\small": 10, "\\normalsize": 11, "\\large": 12, "\\Large": 14, "\\LARGE": 17, "\\huge": 21, "\\Huge": 25 },
  12: { "\\tiny": 6, "\\scriptsize": 8, "\\footnotesize": 10, "\\small": 11, "\\normalsize": 12, "\\large": 14, "\\Large": 17, "\\LARGE": 21, "\\huge": 25, "\\Huge": 25 },
};

function latexSizePtForBase(cmd: string, basePt: number): number {
  const table = LATEX_SIZE_TABLES[basePt] ?? LATEX_SIZE_TABLES[11];
  return table[cmd] ?? basePt;
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
  const [auditing, setAuditing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [renderingPdf, setRenderingPdf] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("pdf");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [, setPdfFullscreen] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageInput, setPreviewPageInput] = useState("1");
  const [isInputPanelOpen, setIsInputPanelOpen] = useState(true);
  const [inputSidebarTab, setInputSidebarTab] = useState<InputSidebarTab>("project");
  const [compilerStatus, setCompilerStatus] = useState<CompilerStatus | null>(null);
  const [checkingCompiler, setCheckingCompiler] = useState(true);
  const [compilerEngine, setCompilerEngine] = useState<"pdflatex" | "xelatex" | "tectonic">("pdflatex");
  const [error, setError] = useState<string | null>(null);
  const [geminiSettingsOpen, setGeminiSettingsOpen] = useState(false);
  const [llmProvider, setLlmProvider] = useState<LlmProvider>("gemini");
  const [llmModel, setLlmModel] = useState("gemini-2.5-pro");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [groqApiKey, setGroqApiKey] = useState("");
  const [claudeApiKey, setClaudeApiKey] = useState("");
  const [testingKey, setTestingKey] = useState(false);
  const [testKeyResult, setTestKeyResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pdfArrayBuffer, setPdfArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [synctexMapping, setSynctexMapping] = useState<SynctexMapping | null>(null);
  const [synctexLineOffset, setSynctexLineOffset] = useState(0);
  const [forwardHighlight, setForwardHighlight] = useState<SynctexRect | null>(null);
  const pdfViewerRef = useRef<PdfCanvasViewerHandle>(null);
  const pdfBlobRef = useRef<Blob | null>(null);
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
  const suggestAbortRef = useRef<AbortController | null>(null);
  const [diagnostics, setDiagnostics] = useState<LatexDiagnostic[]>([]);
  const [isRecompiling, setIsRecompiling] = useState(false);
  const [lastCompileSuccess, setLastCompileSuccess] = useState<boolean | null>(null);
  const [diagnosticsPanelOpen, setDiagnosticsPanelOpen] = useState(false);
  const [committedLatex, setCommittedLatex] = useState(DEFAULT_LATEX_RESUME);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [toolbarCommand, setToolbarCommand] = useState<FormattingType>("section");
  const [formattingMenuOpen, setFormattingMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [forgotSent, setForgotSent] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [supabaseProjects, setSupabaseProjects] = useState<ResumeProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [projectNameInput, setProjectNameInput] = useState("");
  const [savingProject, setSavingProject] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const LATEX_HISTORY_DEBOUNCE_MS = 450;

  latestLatexRef.current = latexCode;

  const { canUndoLatex, canRedoLatex } = useMemo(
    () => ({
      canUndoLatex: pastLatexRef.current.length > 0,
      canRedoLatex: futureLatexRef.current.length > 0,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [historyVersion],
  );

  const resumeSections = useMemo(() => parseLatexResume(latexCode), [latexCode]);
  const previewSections = useMemo(() => parseLatexResume(committedLatex), [committedLatex]);
  const previewLayout = useMemo(() => derivePreviewLayoutFromLatex(committedLatex), [committedLatex]);
  const previewFontSizes = useMemo((): PreviewFontSizes => ({
    headerNamePt: getFormattingFontSize("header-name", committedLatex),
    sectionPt: getFormattingFontSize("section", committedLatex),
    subheadingPt: getFormattingFontSize("resumeSubheading", committedLatex),
    projectHeadingPt: getFormattingFontSize("resumeProjectHeading", committedLatex),
    bulletItemPt: getFormattingFontSize("resumeItem", committedLatex),
    normalTextPt: getFormattingFontSize("normal-text", committedLatex),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [committedLatex]);
  const previewPages = useMemo(
    () => paginateResumeSections(previewSections, previewLayout, previewFontSizes),
    [previewSections, previewLayout, previewFontSizes],
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

  // Auth listener
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: { user: User } | null } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: { user: User } | null) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load projects and settings when user signs in
  useEffect(() => {
    if (!user) {
      setSupabaseProjects([]);
      setActiveProjectId(null);
      return;
    }
    loadUserProjects();
    loadUserSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Auto-save to Supabase
  useEffect(() => {
    if (!user || !activeProjectId) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveProjectToSupabase(activeProjectId, {
        latex_code: latexCode,
        company_role: companyRole,
        jd: jd,
      });
    }, 2000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeProjectId, latexCode, companyRole, jd]);

  // Auto-save project drafts to Supabase
  useEffect(() => {
    if (!user || !activeProjectId) return;
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = setTimeout(() => {
      saveProjectDraftsToSupabase(activeProjectId, projectDrafts);
    }, 2000);
    return () => { if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeProjectId, projectDrafts]);

  async function loadUserProjects() {
    const supabase = createClient();
    const { data } = await supabase
      .from("resume_projects")
      .select("*")
      .order("updated_at", { ascending: false });
    if (data && data.length > 0) {
      setSupabaseProjects(data as ResumeProject[]);
      loadProjectIntoEditor(data[0] as ResumeProject);
    } else {
      setSupabaseProjects([]);
    }
  }

  async function loadUserSettings() {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("resume_settings")
      .select("provider, model")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setLlmProvider(data.provider as LlmProvider);
      setLlmModel(data.model);
    }
  }

  async function saveProjectToSupabase(projectId: string, updates: Partial<Pick<ResumeProject, "latex_code" | "company_role" | "jd" | "name">>) {
    setSavingProject(true);
    const supabase = createClient();
    await supabase
      .from("resume_projects")
      .update(updates)
      .eq("id", projectId);
    setSavingProject(false);
  }

  async function saveProjectDraftsToSupabase(projectId: string, drafts: ProjectDraft[]) {
    const supabase = createClient();
    await supabase.from("resume_project_drafts").delete().eq("project_id", projectId);
    if (drafts.length > 0) {
      await supabase.from("resume_project_drafts").insert(
        drafts.map((d, i) => ({
          project_id: projectId,
          heading: d.heading,
          explanation: d.explanation,
          tech_stack: d.techStack,
          link: d.link,
          from_date: d.fromDate,
          to_date: d.toDate,
          sort_order: i,
        })),
      );
    }
  }

  async function saveSettingsToSupabase(settings: LlmSettings) {
    if (!user) return;
    const supabase = createClient();
    await supabase.from("resume_settings").upsert({
      user_id: user.id,
      provider: settings.provider,
      model: settings.model,
    }, { onConflict: "user_id" });
  }

  async function loadProjectIntoEditor(project: ResumeProject) {
    // Flush pending auto-save for the current project
    if (activeProjectId && activeProjectId !== project.id) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
      await saveProjectToSupabase(activeProjectId, {
        latex_code: latexCode,
        company_role: companyRole,
        jd: jd,
      });
      await saveProjectDraftsToSupabase(activeProjectId, projectDrafts);
    }

    setActiveProjectId(project.id);
    setSuggestions([]);
    setSectionReviews([]);
    pastLatexRef.current = [];
    futureLatexRef.current = [];
    setHistoryVersion((v) => v + 1);

    // Fetch fresh project data from Supabase
    const supabase = createClient();
    const { data: freshProject } = await supabase
      .from("resume_projects")
      .select("*")
      .eq("id", project.id)
      .single();

    if (freshProject) {
      const p = freshProject as ResumeProject;
      setLatexCode(p.latex_code || DEFAULT_LATEX_RESUME);
      setCommittedLatex(p.latex_code || DEFAULT_LATEX_RESUME);
      setCompanyRole(p.company_role || "");
      setJd(p.jd || "");
    } else {
      setLatexCode(project.latex_code || DEFAULT_LATEX_RESUME);
      setCommittedLatex(project.latex_code || DEFAULT_LATEX_RESUME);
      setCompanyRole(project.company_role || "");
      setJd(project.jd || "");
    }

    // Fetch project drafts
    const { data: drafts } = await supabase
      .from("resume_project_drafts")
      .select("*")
      .eq("project_id", project.id)
      .order("sort_order");

    const mapped = (drafts ?? []).map((d: Record<string, string>) => ({
      heading: d.heading || "",
      explanation: d.explanation || "",
      techStack: d.tech_stack || "",
      link: d.link || "",
      fromDate: d.from_date || "",
      toDate: d.to_date || "",
    }));
    setProjectDraft(mapped[0] ?? emptyProjectDraft);
    setProjectDrafts(mapped);
  }

  async function createNewProject() {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("resume_projects")
      .insert({ user_id: user.id, name: "Untitled Resume", latex_code: DEFAULT_LATEX_RESUME })
      .select()
      .single();
    if (data) {
      const project = data as ResumeProject;
      setSupabaseProjects((prev) => [project, ...prev]);
      loadProjectIntoEditor(project);
    }
  }

  async function renameProject(projectId: string, newName: string) {
    const supabase = createClient();
    await supabase.from("resume_projects").update({ name: newName }).eq("id", projectId);
    setSupabaseProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, name: newName } : p));
  }

  async function deleteProject(projectId: string) {
    const supabase = createClient();
    await supabase.from("resume_projects").delete().eq("id", projectId);
    const remaining = supabaseProjects.filter((p) => p.id !== projectId);
    setSupabaseProjects(remaining);
    if (activeProjectId === projectId) {
      if (remaining.length > 0) {
        loadProjectIntoEditor(remaining[0]);
      } else {
        setActiveProjectId(null);
        setLatexCode(DEFAULT_LATEX_RESUME);
        setCommittedLatex(DEFAULT_LATEX_RESUME);
        setCompanyRole("");
        setJd("");
        setProjectDraft(emptyProjectDraft);
        setProjectDrafts([]);
      }
    }
  }

  async function handleAuthSubmit() {
    setAuthError(null);
    setAuthSubmitting(true);
    const supabase = createClient();
    try {
      if (authMode === "signup") {
        const { error: err } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
        if (err) { setAuthError(err.message); return; }
        toast.success("Account created! Check your email to confirm.");
        setAuthModalOpen(false);
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (err) { setAuthError(err.message); return; }
        toast.success("Signed in successfully!");
        setAuthModalOpen(false);
      }
    } catch {
      setAuthError("An unexpected error occurred.");
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    setAuthError(null);
    setAuthSubmitting(true);
    const supabase = createClient();
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(authEmail, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (err) { setAuthError(err.message); return; }
      setForgotSent(true);
    } catch {
      setAuthError("An unexpected error occurred.");
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setSupabaseProjects([]);
    setActiveProjectId(null);
    setSidebarOpen(false);
    toast.success("Signed out.");
  }

  const currentProjectName = useMemo(() => {
    if (!activeProjectId) return "";
    return supabaseProjects.find((p) => p.id === activeProjectId)?.name ?? "Untitled Resume";
  }, [activeProjectId, supabaseProjects]);

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

  const handleInverseSync = useCallback(
    (synctexLine: number) => {
      focusEditorAtSourceLine(synctexLine - 1);
    },
    [focusEditorAtSourceLine],
  );

  const handleForwardSync = useCallback(() => {
    const view = editorViewRef.current;
    if (!view || !synctexMapping) return;

    const cursorLine = view.state.doc.lineAt(view.state.selection.main.head).number;
    const adjustedLine = cursorLine + synctexLineOffset;
    const rect = forwardSync(synctexMapping, adjustedLine);

    if (rect) {
      setForwardHighlight(rect);
      pdfViewerRef.current?.scrollToPage(rect.page);
      if (viewMode !== "pdf") setViewMode("pdf");
    }
  }, [synctexMapping, synctexLineOffset, viewMode]);

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
    pdfBlobRef.current = null;
    setDiagnostics([]);
    setLastCompileSuccess(null);
    setDiagnosticsPanelOpen(false);
    setPreviewId(null);
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
      suggestAbortRef.current?.abort();
    },
    [],
  );

  const undoRef = useRef<() => void>(() => { });
  const redoRef = useRef<() => void>(() => { });
  const recompileRef = useRef<() => void>(() => { });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isCtrlOrMeta = event.ctrlKey || event.metaKey;
      if (!isCtrlOrMeta) return;

      if (event.key === "z" && !event.shiftKey) {
        event.preventDefault();
        undoRef.current();
      } else if (event.key === "y") {
        event.preventDefault();
        redoRef.current();
      } else if (event.key === "s") {
        event.preventDefault();
        recompileRef.current();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  function navigateToDiff(currentText: string, newText: string) {
    const len = Math.min(currentText.length, newText.length);
    let diffPos = currentText.length !== newText.length ? len : -1;
    for (let i = 0; i < len; i++) {
      if (currentText[i] !== newText[i]) {
        diffPos = i;
        break;
      }
    }

    if (diffPos !== -1 && editorViewRef.current) {
      // Wait for React to apply the state change
      requestAnimationFrame(() => {
        editorViewRef.current?.dispatch({
          selection: { anchor: diffPos },
          effects: EditorView.scrollIntoView(diffPos, { y: "center" })
        });
        editorViewRef.current?.focus();
      });
    }
  }

  function undoLatex() {
    if (pastLatexRef.current.length === 0) {
      return;
    }

    cancelTypingHistoryDebounce({ flushPending: true });
    const previous = pastLatexRef.current.pop()!;
    navigateToDiff(latestLatexRef.current, previous);
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
    navigateToDiff(latestLatexRef.current, next);
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

  undoRef.current = undoLatex;
  redoRef.current = redoLatex;

  function replaceLatexContent(value: string, options?: { recordHistory?: boolean }) {
    cancelTypingHistoryDebounce({ flushPending: true });
    if (options?.recordHistory && value !== latestLatexRef.current) {
      commitLatexHistoryBeforeEdit(latestLatexRef.current);
    }
    navigateToDiff(latestLatexRef.current, value);
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

    suggestAbortRef.current?.abort();
    const controller = new AbortController();
    suggestAbortRef.current = controller;

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
          apiKey: (llmProvider === "groq" ? groqApiKey : llmProvider === "claude" ? claudeApiKey : geminiApiKey).trim() || undefined,
        }),
        signal: controller.signal,
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
      if (requestError instanceof DOMException && requestError.name === "AbortError") {
        return;
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to generate suggestions.",
      );
    } finally {
      suggestAbortRef.current = null;
      setSuggesting(false);
    }
  }

  function cancelSuggestions() {
    suggestAbortRef.current?.abort();
    suggestAbortRef.current = null;
    setSuggesting(false);
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
    navigateToDiff(currentLatex, nextLatex);
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
    const pending = [...replaces, ...inserts, ...deletes];

    for (let i = 0; i < pending.length; i++) {
      const before = result;
      commitLatexHistoryBeforeEdit(result);
      result = applySuggestionToLatex(result, parseLatexResume(result), pending[i].suggestion);
      const lineDelta = countLatexLines(result) - countLatexLines(before);

      if (lineDelta !== 0) {
        const appliedLine = pending[i].sourceLine;
        for (let j = i + 1; j < pending.length; j++) {
          if (pending[j].sourceLine > appliedLine) {
            const newLine = pending[j].sourceLine + lineDelta;
            pending[j] = {
              ...pending[j],
              sourceLine: newLine,
              suggestion: {
                ...pending[j].suggestion,
                targetLineId: `line-${newLine}`,
              },
            };
          }
        }
      }
    }

    navigateToDiff(latestLatexRef.current, result);
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

      const cleanText = text
        .replace(/\\(?:textbf|textit|emph|underline|textsubscript|textsuperscript)\{([^}]*)\}/g, "$1")
        .replace(/\\([&%$#_])/g, "$1");

      setPolishState({ range, original: cleanText, polished: null, loading: true, action });

      try {
        const response = await fetch("/api/resume/polish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: cleanText,
            action,
            provider: llmProvider,
            model: llmModel.trim(),
            apiKey: (llmProvider === "groq" ? groqApiKey : llmProvider === "claude" ? claudeApiKey : geminiApiKey).trim() || undefined,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      body: JSON.stringify({ latex: latexCode, engine: compilerEngine }),
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


  async function recompileLatex() {
    setIsRecompiling(true);
    setError(null);

    try {
      const response = await fetch("/api/resume/compile-latex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latex: latexCode, engine: compilerEngine }),
      });

      if (!response.ok) {
        const payload = await response.json() as {
          error?: string;
          details?: string;
          diagnostics?: LatexDiagnostic[];
        };
        const diags = payload.diagnostics ?? [];
        setDiagnostics(diags);
        setLastCompileSuccess(false);
        setDiagnosticsPanelOpen(diags.length > 0);

        const errorCount = diags.filter((d) => d.severity === "error").length;
        const warnCount = diags.filter((d) => d.severity === "warning").length;
        const parts = [
          errorCount > 0 ? `${errorCount} error${errorCount > 1 ? "s" : ""}` : "",
          warnCount > 0 ? `${warnCount} warning${warnCount > 1 ? "s" : ""}` : "",
        ].filter(Boolean).join(", ");

        toast.error(
          parts ? `Compilation failed: ${parts}` : (payload.error ?? "Compilation failed."),
          { duration: 5000 },
        );
        return;
      }

      const newPreviewId = response.headers.get("X-Preview-Id");
      const hasSynctex = response.headers.get("X-Synctex-Available") === "1";
      const blob = await response.blob();
      pdfBlobRef.current = blob;
      const arrayBuffer = await blob.arrayBuffer();
      setPdfArrayBuffer(arrayBuffer);
      if (newPreviewId) setPreviewId(newPreviewId);
      setCommittedLatex(latexCode);
      setDiagnostics([]);
      setLastCompileSuccess(true);
      setDiagnosticsPanelOpen(false);
      setViewMode("pdf");

      if (hasSynctex && newPreviewId) {
        fetchSynctexMapping(newPreviewId).then(({ mapping, lineOffset }) => {
          setSynctexMapping(mapping);
          setSynctexLineOffset(lineOffset);
        });
      } else {
        setSynctexMapping(null);
        setSynctexLineOffset(0);
      }

      toast.success("Compiled successfully.", { duration: 3000 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Compilation failed.");
      setLastCompileSuccess(false);
      toast.error("Compilation failed — check your connection.", { duration: 5000 });
    } finally {
      setIsRecompiling(false);
    }
  }

  recompileRef.current = () => {
    if (!isRecompiling && canCompilePdf) {
      recompileLatex();
    }
  };

  async function downloadResumePdf() {
    setDownloading(true);
    setError(null);

    try {
      const blob = pdfBlobRef.current ?? await createPdfBlob();
      pdfBlobRef.current = blob;
      downloadBlob(blob, getDownloadFilename(currentProjectName || companyRole || "resume"));
    } catch (compileError) {
      const message =
        compileError instanceof Error ? compileError.message : "LaTeX compilation failed.";
      setError(message);
      toast.error("PDF download failed — fix LaTeX errors and try again.", { duration: 6000 });
    } finally {
      setDownloading(false);
    }
  }

  function downloadLatexSource() {
    downloadBlob(
      new Blob([latexCode], { type: "application/x-tex;charset=utf-8" }),
      `${sanitizeFilename(currentProjectName || companyRole || "resume")}.tex`,
    );
  }

  function openPortfolioGenerator() {
    const portfolioData = extractPortfolioFromResume(resumeSections, activeProjectDrafts);
    portfolioToStorage(portfolioData);
    window.open("/portfolio-generate", "_blank");
  }

  async function auditResume() {
    if (resumeSections.length === 0) return;

    setAuditing(true);
    setError(null);
    setSuggestions([]);
    setSectionReviews([]);

    try {
      const apiKey = (
        llmProvider === "groq" ? groqApiKey : llmProvider === "claude" ? claudeApiKey : geminiApiKey
      ).trim() || undefined;

      const response = await fetch("/api/resume/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeSections: resumeSections.map((section) => ({
            id: section.id,
            title: section.title,
            lines: section.lines.map((line) => ({
              id: line.id,
              page: line.page,
              sectionId: line.sectionId,
              text: line.text,
              sourceLine: line.sourceLine,
              sourceText: line.sourceText,
              kind: line.kind,
            })),
          })),
          provider: llmProvider,
          model: llmModel.trim(),
          apiKey,
        }),
      });

      const payload = (await response.json()) as {
        suggestions?: AiSuggestion[];
        sectionReviews?: SectionReview[];
        error?: string;
        details?: unknown;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Audit failed.");
      }

      setSuggestions(payload.suggestions ?? []);
      setSectionReviews(payload.sectionReviews ?? []);
      setViewMode("preview");

      if ((payload.suggestions ?? []).length === 0) {
        toast.success("No issues found — your resume looks clean!");
      } else {
        toast.info(`Found ${payload.suggestions!.length} issue(s) to fix.`);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to audit resume.",
      );
    } finally {
      setAuditing(false);
    }
  }

  function renderPdfPreview() {
    if (!previewId) {
      toast.error("Compile first (Ctrl+S) to preview PDF.", { duration: 4000 });
      return;
    }
    window.open(`/api/resume/preview/${previewId}`, "_blank");
  }

  function wrapSelectionWith(prefix: string, suffix: string) {
    const view = editorViewRef.current;
    if (!view) return;
    const { state } = view;
    const selection = state.selection.main;
    const selectedText = state.sliceDoc(selection.from, selection.to);
    const insert = selectedText
      ? `${prefix}${selectedText}${suffix}`
      : `${prefix}${suffix}`;
    view.dispatch({
      changes: { from: selection.from, to: selection.to, insert },
      selection: {
        anchor: selectedText
          ? selection.from + insert.length
          : selection.from + prefix.length,
      },
    });
    view.focus();
  }

  function insertLatexBold() {
    wrapSelectionWith("\\textbf{", "}");
  }

  function insertLatexItalic() {
    wrapSelectionWith("\\textit{", "}");
  }

  function applyFormattingCommand(type: string) {
    if (type === "normal-text") return;

    let prefix = "";
    let suffix = "";

    if (type === "header-name") {
      prefix = "\\textbf{\\Huge ";
      suffix = "}";
    } else if (type === "section") {
      prefix = "\\section{";
      suffix = "}";
    } else {
      const customCmds = getDynamicCommands(latexCode);
      const cmdDef = customCmds.find((c) => c.name === type);
      const argCount = cmdDef ? Math.max(1, cmdDef.args) : 1;

      prefix = `\\${type}{`;
      suffix = "}" + "{}".repeat(argCount - 1);
    }

    wrapSelectionWith(prefix, suffix);
  }


  function getDocumentBasePt(latex: string): number {
    const m = latex.match(/\\documentclass\[[^\]]*?(\d+(?:\.\d+)?)pt[^\]]*\]/);
    if (!m) return 11;
    const raw = Number.parseFloat(m[1]);
    if (raw <= 10.5) return 10;
    if (raw <= 11.5) return 11;
    return 12;
  }

  function extractSizeFromArgs(formatArgs: string, basePt: number = 11): number {
    for (const { cmd } of [...LATEX_SIZE_COMMANDS].reverse()) {
      if (formatArgs.includes(cmd)) return latexSizePtForBase(cmd, basePt);
    }
    return basePt;
  }

  function findCommandBody(latex: string, cmdName: string): { body: string; start: number; end: number } | null {
    const prefix = `\\newcommand{\\${cmdName}}`;
    const idx = latex.indexOf(prefix);
    if (idx === -1) return null;
    let pos = idx + prefix.length;
    while (pos < latex.length && latex[pos] !== "{") pos++;
    if (pos >= latex.length) return null;
    let depth = 0;
    const bodyStart = pos;
    for (; pos < latex.length; pos++) {
      if (latex[pos] === "{") depth++;
      else if (latex[pos] === "}") {
        depth--;
        if (depth === 0) {
          return { body: latex.slice(bodyStart + 1, pos), start: bodyStart + 1, end: pos };
        }
      }
    }
    return null;
  }

  function closestSizeCommand(targetPt: number, basePt: number = 11): string {
    let closestCmd = LATEX_SIZE_COMMANDS[0].cmd as string;
    let minDiff = Math.abs(targetPt - latexSizePtForBase(LATEX_SIZE_COMMANDS[0].cmd, basePt));
    for (const entry of LATEX_SIZE_COMMANDS) {
      const actualPt = latexSizePtForBase(entry.cmd, basePt);
      const diff = Math.abs(targetPt - actualPt);
      if (diff < minDiff) {
        closestCmd = entry.cmd;
        minDiff = diff;
      }
    }
    return closestCmd;
  }

  function getFormattingFontSize(type: FormattingType, latex: string): number {
    const basePt = getDocumentBasePt(latex);

    switch (type) {
      case "normal-text":
        return basePt;
      case "section": {
        const matches = [...latex.matchAll(/\\titleformat\{\\section\}\{([^}]*)\}/g)];
        const last = matches[matches.length - 1];
        return last ? extractSizeFromArgs(last[1], basePt) : Math.round(basePt * 1.2);
      }
      case "header-name": {
        const headerMatch = latex.match(/\\textbf\{(\\[A-Za-z]+)\s/)
          ?? latex.match(/\{(\\Huge|\\huge|\\LARGE|\\Large|\\large)\s/);
        return headerMatch ? extractSizeFromArgs(headerMatch[1], basePt) : 25;
      }
      default: {
        const cmd = findCommandBody(latex, type);
        if (!cmd) return basePt;
        return extractSizeFromArgs(cmd.body, basePt);
      }
    }
  }

  const SIZE_PATTERN = /\\(?:tiny|scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge|Huge)\b/;

  function replaceSizeInBody(body: string, newCmd: string): string {
    return SIZE_PATTERN.test(body) ? body.replace(SIZE_PATTERN, newCmd) : `${newCmd}${body}`;
  }

  function replaceSizeInCommandBody(latex: string, cmdName: string, newCmd: string): string {
    const found = findCommandBody(latex, cmdName);
    if (!found) return latex;
    const newBody = replaceSizeInBody(found.body, newCmd);
    return `${latex.slice(0, found.start)}${newBody}${latex.slice(found.end)}`;
  }

  function applyFormattingFontSize(type: FormattingType, newPt: number) {
    let updated = latexCode;
    const basePt = getDocumentBasePt(latexCode);
    const newCmd = closestSizeCommand(newPt, basePt);

    switch (type) {
      case "normal-text": {
        const validBase = [10, 11, 12].includes(newPt) ? newPt : 11;
        updated = updated.replace(
          /\\documentclass\[([^\]]*?)(\d+(?:\.\d+)?)pt([^\]]*)\]/,
          `\\documentclass[$1${validBase}pt$3]`,
        );
        break;
      }
      case "section": {
        const re = /(\\titleformat\{\\section\}\{)([^}]*)(\})/g;
        const allMatches = [...updated.matchAll(re)];
        if (allMatches.length > 0) {
          const lastMatch = allMatches[allMatches.length - 1];
          const lastIdx = lastMatch.index!;
          const before = updated.slice(0, lastIdx);
          const after = updated.slice(lastIdx + lastMatch[0].length);
          updated = `${before}${lastMatch[1]}${replaceSizeInBody(lastMatch[2], newCmd)}${lastMatch[3]}${after}`;
        } else {
          const ins = updated.indexOf("\\begin{document}");
          if (ins !== -1) {
            const line = `\\titleformat{\\section}{${newCmd}\\bfseries}{}{0em}{}[\\titlerule]\n`;
            updated = `${updated.slice(0, ins)}${line}${updated.slice(ins)}`;
          }
        }
        break;
      }
      case "header-name": {
        const textbfRe = /(\\textbf\{)(\\[A-Za-z]+)(\s)/;
        const braceRe = /(\{)(\\Huge|\\huge|\\LARGE|\\Large|\\large)([\s\\])/;
        if (textbfRe.test(updated)) {
          updated = updated.replace(textbfRe, `$1${newCmd}$3`);
        } else if (braceRe.test(updated)) {
          updated = updated.replace(braceRe, `$1${newCmd}$3`);
        }
        break;
      }
      default: {
        const result = replaceSizeInCommandBody(updated, type, newCmd);
        if (result !== updated) {
          updated = result;
        }
        break;
      }
    }

    if (updated !== latexCode) {
      replaceLatexContent(updated, { recordHistory: true });
    }
  }

  function insertBulletList() {
    const view = editorViewRef.current;
    if (!view) return;
    const { state } = view;
    const selection = state.selection.main;
    const selectedText = state.sliceDoc(selection.from, selection.to);
    const items = selectedText
      ? selectedText.split("\n").map((line) => `  \\item ${line}`).join("\n")
      : "  \\item ";
    const insert = `\\begin{itemize}\n${items}\n\\end{itemize}`;
    const cursorPos = selectedText
      ? selection.from + insert.length
      : selection.from + "\\begin{itemize}\n  \\item ".length;
    view.dispatch({
      changes: { from: selection.from, to: selection.to, insert },
      selection: { anchor: cursorPos },
    });
    view.focus();
  }

  function insertNumberedList() {
    const view = editorViewRef.current;
    if (!view) return;
    const { state } = view;
    const selection = state.selection.main;
    const selectedText = state.sliceDoc(selection.from, selection.to);
    const items = selectedText
      ? selectedText.split("\n").map((line) => `  \\item ${line}`).join("\n")
      : "  \\item ";
    const insert = `\\begin{enumerate}\n${items}\n\\end{enumerate}`;
    const cursorPos = selectedText
      ? selection.from + insert.length
      : selection.from + "\\begin{enumerate}\n  \\item ".length;
    view.dispatch({
      changes: { from: selection.from, to: selection.to, insert },
      selection: { anchor: cursorPos },
    });
    view.focus();
  }

  function handleFindReplace() {
    const view = editorViewRef.current;
    if (!view) return;
    openSearchPanel(view);
  }

  const currentFontSize = useMemo(() => {
    return getFormattingFontSize(toolbarCommand, latexCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolbarCommand, latexCode]);

  const [fontSizeInput, setFontSizeInput] = useState(String(currentFontSize));
  const [isFontSizeEditing, setIsFontSizeEditing] = useState(false);
  const fontSizeDragRef = useRef<{ startX: number; startVal: number } | null>(null);

  useEffect(() => {
    if (!isFontSizeEditing) {
      setFontSizeInput(String(currentFontSize));
    }
  }, [currentFontSize, isFontSizeEditing]);

  function commitFontSize(val: number) {
    const clamped = Math.max(4, Math.min(40, val));
    applyFormattingFontSize(toolbarCommand, clamped);
  }

  useEffect(() => {
    if (!formattingMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-formatting-menu]")) {
        setFormattingMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [formattingMenuOpen]);

  return (
    <main className="flex h-dvh max-h-dvh min-h-0 flex-col bg-[#f4f8f8]">
      <Toaster position="top-right" richColors />
      {authModalOpen ? (
        <DialogContent onClose={() => { setAuthModalOpen(false); setAuthError(null); setForgotSent(false); }} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {authMode === "forgot" ? "Reset Password" : authMode === "signup" ? "Create Account" : "Welcome back"}
            </DialogTitle>
            <DialogDescription>
              {authMode === "forgot"
                ? "Enter your email and we'll send you a link to reset your password."
                : authMode === "signup"
                  ? "Sign up to save your projects in the cloud."
                  : "Sign in to access your saved projects."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {authMode !== "forgot" ? (
              <div className="flex rounded-lg border bg-muted/40 p-1">
                <button
                  type="button"
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${authMode === "signin" ? "bg-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => { setAuthMode("signin"); setAuthError(null); }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${authMode === "signup" ? "bg-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => { setAuthMode("signup"); setAuthError(null); }}
                >
                  Sign Up
                </button>
              </div>
            ) : null}
            {authMode === "forgot" && forgotSent ? (
              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-700">
                <CircleCheck className="h-4 w-4 shrink-0" />
                Password reset link sent! Check your email inbox.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="authEmail">Email</Label>
                  <Input
                    id="authEmail"
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    onKeyDown={(e) => { if (e.key === "Enter" && authMode === "forgot") handleForgotPassword(); }}
                    className="h-10"
                  />
                </div>
                {authMode !== "forgot" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="authPassword">Password</Label>
                    <Input
                      id="authPassword"
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAuthSubmit(); }}
                      className="h-10"
                    />
                    {authMode === "signin" ? (
                      <button
                        type="button"
                        className="text-sm text-primary hover:underline"
                        onClick={() => { setAuthMode("forgot"); setAuthError(null); setForgotSent(false); }}
                      >
                        Forgot password?
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
            {authError ? (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {authError}
              </div>
            ) : null}
          </DialogBody>
          <DialogFooter>
            {authMode === "forgot" ? (
              <>
                <Button type="button" variant="outline" onClick={() => { setAuthMode("signin"); setAuthError(null); setForgotSent(false); }}>
                  Back to Sign In
                </Button>
                {!forgotSent ? (
                  <Button type="button" onClick={handleForgotPassword} disabled={authSubmitting || !authEmail} className="min-w-[100px]">
                    {authSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                    Send Reset Link
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => { setAuthModalOpen(false); setAuthError(null); }}>Cancel</Button>
                <Button type="button" onClick={handleAuthSubmit} disabled={authSubmitting} className="min-w-[100px]">
                  {authSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                  {authMode === "signup" ? "Create Account" : "Sign In"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      ) : null}
      {geminiSettingsOpen ? (
        <DialogContent onClose={() => { setGeminiSettingsOpen(false); setTestKeyResult(null); }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-muted-foreground" />
              AI Model Settings
            </DialogTitle>
            <DialogDescription>
              Choose a model and configure API keys. {user ? "Settings sync across devices." : "Saved locally in this browser."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="llmModel" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Model</Label>
              <select
                id="llmModel"
                value={llmModel}
                onChange={(event) => {
                  setLlmModel(event.target.value);
                  setLlmProvider(providerForModel(event.target.value));
                }}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
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
            <Separator />
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">API Keys</p>
              <div className={`space-y-1.5 rounded-lg border p-3 transition-colors ${llmProvider === "gemini" ? "border-emerald-300 bg-emerald-50/50" : "border-transparent bg-muted/30"}`}>
                <Label htmlFor="geminiApiKey" className="flex items-center gap-1.5 text-sm">
                  Gemini
                  {llmProvider === "gemini" ? <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">Active</Badge> : null}
                </Label>
                <Input
                  id="geminiApiKey"
                  type="password"
                  value={geminiApiKey}
                  onChange={(event) => setGeminiApiKey(event.target.value)}
                  placeholder="AIza..."
                  autoComplete="off"
                  className="h-9"
                />
              </div>
              <div className={`space-y-1.5 rounded-lg border p-3 transition-colors ${llmProvider === "groq" ? "border-emerald-300 bg-emerald-50/50" : "border-transparent bg-muted/30"}`}>
                <Label htmlFor="groqApiKey" className="flex items-center gap-1.5 text-sm">
                  Groq
                  {llmProvider === "groq" ? <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">Active</Badge> : null}
                </Label>
                <Input
                  id="groqApiKey"
                  type="password"
                  value={groqApiKey}
                  onChange={(event) => setGroqApiKey(event.target.value)}
                  placeholder="gsk_..."
                  autoComplete="off"
                  className="h-9"
                />
              </div>
              <div className={`space-y-1.5 rounded-lg border p-3 transition-colors ${llmProvider === "claude" ? "border-emerald-300 bg-emerald-50/50" : "border-transparent bg-muted/30"}`}>
                <Label htmlFor="claudeApiKey" className="flex items-center gap-1.5 text-sm">
                  Claude
                  {llmProvider === "claude" ? <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">Active</Badge> : null}
                </Label>
                <Input
                  id="claudeApiKey"
                  type="password"
                  value={claudeApiKey}
                  onChange={(event) => setClaudeApiKey(event.target.value)}
                  placeholder="sk-ant-..."
                  autoComplete="off"
                  className="h-9"
                />
              </div>
            </div>
            {testKeyResult ? (
              <div className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${testKeyResult.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                {testKeyResult.ok ? <CircleCheck className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                <span className="line-clamp-2">{testKeyResult.message}</span>
              </div>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
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
            <Button
              type="button"
              onClick={() => {
                const nextSettings: LlmSettings = {
                  provider: llmProvider,
                  model: llmModel.trim() || "gemini-2.5-pro",
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
                saveSettingsToSupabase(nextSettings);
                setGeminiSettingsOpen(false);
                setTestKeyResult(null);
                toast.success("AI model settings saved successfully!");
              }}
            >
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
      <div className="flex flex-1 min-h-0">
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="flex h-full flex-col overflow-hidden border-r border-slate-700/60 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950"
              style={{ minWidth: 0 }}
            >
              <div className="flex items-center justify-between border-b border-slate-700/60 px-3 py-2">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-slate-400" />
                  <h2 className="text-sm font-semibold text-slate-200">Projects</h2>
                </div>
                <div className="flex items-center gap-1">
                  {user ? (
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-800" onClick={createNewProject} title="New Project">
                      <FilePlus className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
              {user ? (
                <>
                  <ScrollArea className="flex-1">
                    <div className="p-2">
                      {supabaseProjects.length === 0 ? (
                        <p className="px-2 py-4 text-center text-sm text-slate-400">No projects yet. Create one to get started.</p>
                      ) : (
                        supabaseProjects.map((project) => (
                          <div
                            key={project.id}
                            className={`group flex cursor-pointer items-center gap-2.5 border-l-2 px-3 py-2 text-sm transition-all duration-150 ${activeProjectId === project.id
                              ? "bg-gradient-to-r from-emerald-500/12 via-emerald-500/5 to-transparent border-l-emerald-450 text-white font-medium"
                              : "border-l-transparent hover:bg-slate-800/40 hover:text-white text-slate-350"
                              }`}
                            onClick={() => { if (renamingProjectId !== project.id) loadProjectIntoEditor(project); }}
                          >
                            {renamingProjectId === project.id ? (
                              <input
                                className="flex-1 rounded border border-slate-700 bg-slate-950/60 text-slate-200 px-1.5 py-0.5 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onBlur={() => { if (renameValue.trim()) renameProject(project.id, renameValue.trim()); setRenamingProjectId(null); }}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } if (e.key === "Escape") setRenamingProjectId(null); }}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <>
                                <FileText className={`h-4 w-4 shrink-0 transition-colors ${activeProjectId === project.id ? "text-emerald-400" : "text-slate-400 group-hover:text-slate-300"}`} />
                                <div className="min-w-0 flex-1">
                                  <p className={`truncate text-sm transition-colors ${activeProjectId === project.id ? "text-white" : "text-slate-300 group-hover:text-slate-100"}`}>{project.name}</p>
                                  <p className={`truncate text-xs transition-colors ${activeProjectId === project.id ? "text-emerald-400/80" : "text-slate-500"}`}>
                                    {new Date(project.updated_at).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-slate-450 hover:text-white hover:bg-slate-700" onClick={(e) => { e.stopPropagation(); setRenamingProjectId(project.id); setRenameValue(project.name); }}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-rose-450 hover:text-rose-350 hover:bg-rose-950/30" onClick={(e) => { e.stopPropagation(); deleteProject(project.id); }}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                  <div className="border-t border-slate-750 p-2">
                    <Button type="button" variant="ghost" size="sm" className="w-full gap-2 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors" onClick={handleSignOut}>
                      <LogOut className="h-3.5 w-3.5" />
                      Sign Out
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4">
                  <p className="text-center text-sm text-slate-400">Sign in to save and manage your resume projects in the cloud.</p>
                  <Button type="button" className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 border-0 text-white font-semibold transition-all shadow-md shadow-emerald-950/20" onClick={() => { setAuthModalOpen(true); setAuthMode("signin"); }}>
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </Button>
                </div>
              )}
            </motion.aside>
          )}
        </AnimatePresence>
        <div className="flex flex-1 min-h-0 min-w-0 flex-col">
          <div className="mx-auto flex min-h-0 w-full flex-1 flex-col items-stretch gap-5 px-4 py-5 xl:flex-row xl:items-stretch">
            <section className="flex w-full min-w-0 flex-1 min-h-0 flex-col rounded-md border bg-white xl:min-h-0">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-700/60 bg-slate-800 px-3 py-2">
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-slate-300 hover:text-white hover:bg-slate-700"
                    onClick={() => setSidebarOpen((prev) => !prev)}
                    aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
                  >
                    {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                  </Button>
                  <Image
                    src="/aurabio-refined-logo.png?v=3"
                    alt="AURABIO"
                    width={120}
                    height={36}
                    className="h-9 w-auto"
                    priority
                  />
                </div>

                <span className="mx-0.5 hidden h-5 w-px bg-slate-700/60 sm:block" />

                {/* Editor Toolbar */}
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <select
                        value={compilerEngine}
                        onChange={(e) => setCompilerEngine(e.target.value as "pdflatex" | "xelatex" | "tectonic")}
                        className="h-8 w-28 appearance-none rounded-md border border-slate-700 bg-slate-900/60 pl-2.5 pr-8 py-1 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 truncate"
                        title="Compiler Engine"
                      >
                        <option value="pdflatex" className="bg-slate-800 text-slate-100">pdflatex</option>
                        <option value="xelatex" className="bg-slate-800 text-slate-100">xelatex</option>
                        <option value="tectonic" className="bg-slate-800 text-slate-100">tectonic</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                    <div className="relative">
                      <select
                        value={toolbarCommand}
                        onChange={(e) => {
                          setToolbarCommand(e.target.value);
                          applyFormattingCommand(e.target.value);
                        }}
                        className="h-8 w-36 appearance-none rounded-md border border-slate-700 bg-slate-900/60 pl-2.5 pr-8 py-1 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 truncate"
                        title="Formatting Command"
                      >
                        <optgroup label="Built-in Commands" className="bg-slate-800 text-slate-300 font-semibold">
                          <option value="header-name" className="text-slate-100 font-normal">Header Name</option>
                          <option value="section" className="text-slate-100 font-normal">Section</option>
                          <option value="normal-text" className="text-slate-100 font-normal">Normal Text</option>
                        </optgroup>
                        <optgroup label="Custom Commands" className="bg-slate-800 text-slate-300 font-semibold">
                          {getDynamicCommands(latexCode).map((cmd) => (
                            <option key={cmd.name} value={cmd.name} className="text-slate-100 font-normal">
                              \{cmd.name}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                    <div
                      className="relative flex h-8 w-20 items-center rounded-md border border-slate-700 bg-slate-900/60 text-sm select-none text-slate-100"
                      style={{ cursor: "ew-resize" }}
                      onPointerDown={(e) => {
                        if (isFontSizeEditing) return;
                        e.preventDefault();
                        (e.target as HTMLElement).setPointerCapture(e.pointerId);
                        fontSizeDragRef.current = { startX: e.clientX, startVal: currentFontSize };
                      }}
                      onPointerMove={(e) => {
                        if (!fontSizeDragRef.current) return;
                        const delta = Math.round((e.clientX - fontSizeDragRef.current.startX) / 4);
                        const newVal = Math.max(4, Math.min(40, fontSizeDragRef.current.startVal + delta));
                        setFontSizeInput(String(newVal));
                        commitFontSize(newVal);
                      }}
                      onPointerUp={(e) => {
                        if (!fontSizeDragRef.current) return;
                        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                        fontSizeDragRef.current = null;
                      }}
                    >
                      <input
                        className="h-full w-full bg-transparent px-2 text-center text-sm outline-none text-slate-100"
                        style={{ cursor: isFontSizeEditing ? "text" : "ew-resize" }}
                        value={isFontSizeEditing ? fontSizeInput : `${currentFontSize}pt`}
                        onFocus={() => {
                          setIsFontSizeEditing(true);
                          setFontSizeInput(String(currentFontSize));
                        }}
                        onBlur={() => {
                          setIsFontSizeEditing(false);
                          const pt = Number.parseInt(fontSizeInput, 10);
                          if (Number.isFinite(pt)) commitFontSize(pt);
                        }}
                        onChange={(e) => setFontSizeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur();
                          } else if (e.key === "Escape") {
                            setFontSizeInput(String(currentFontSize));
                            setIsFontSizeEditing(false);
                          }
                        }}
                      />
                    </div>
                  </div>

                  <span className="mx-1 hidden h-5 w-px bg-slate-700/60 sm:block" />

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 w-8 p-0 font-bold bg-slate-700/40 hover:bg-slate-700 border border-slate-700/60 text-slate-200 hover:text-white transition-all shadow-sm duration-150"
                      onClick={insertLatexBold}
                      title="Bold (\\textbf{})"
                    >
                      B
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 w-8 p-0 italic bg-slate-700/40 hover:bg-slate-700 border border-slate-700/60 text-slate-200 hover:text-white transition-all shadow-sm duration-150"
                      onClick={insertLatexItalic}
                      title="Italic (\\textit{})"
                    >
                      I
                    </Button>

                    <div className="relative" data-formatting-menu>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 gap-1 px-2 bg-slate-700/40 hover:bg-slate-700 border border-slate-700/60 text-slate-200 hover:text-white transition-all shadow-sm duration-150"
                        onClick={() => setFormattingMenuOpen((v) => !v)}
                        title="Formatting"
                      >
                        <Type className="h-3.5 w-3.5" />
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                      {formattingMenuOpen ? (
                        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md border border-slate-700 bg-slate-900 py-1 shadow-lg text-slate-200">
                          {([
                            { type: "header-name" as FormattingType, label: "Header Name" },
                            { type: "section" as FormattingType, label: "Section" },
                            { type: "normal-text" as FormattingType, label: "Normal Text" },
                            ...getDynamicCommands(latexCode).map(cmd => ({ type: cmd.name, label: `\\${cmd.name}` }))
                          ]).map((item) => (
                            <button
                              key={item.type}
                              type="button"
                              className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-slate-800 hover:text-white ${toolbarCommand === item.type ? "bg-slate-800/80 text-emerald-400 font-semibold" : ""}`}
                              onClick={() => {
                                setToolbarCommand(item.type);
                                setFormattingMenuOpen(false);
                                applyFormattingCommand(item.type);
                              }}
                            >
                              <span>{item.label}</span>
                              <span className="text-xs text-muted-foreground">
                                {getFormattingFontSize(item.type, latexCode)}pt
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      className="h-8 w-8 p-0 bg-slate-700/40 hover:bg-slate-700 border border-slate-700/60 text-slate-200 hover:text-white transition-all shadow-sm duration-150"
                      onClick={insertBulletList}
                      title="Bullet list (\\begin{itemize})"
                    >
                      <List className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 w-8 p-0 bg-slate-700/40 hover:bg-slate-700 border border-slate-700/60 text-slate-200 hover:text-white transition-all shadow-sm duration-150"
                      onClick={insertNumberedList}
                      title="Numbered list (\\begin{enumerate})"
                    >
                      <ListOrdered className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 gap-1 px-2 bg-slate-700/40 hover:bg-slate-700 border border-slate-700/60 text-slate-200 hover:text-white transition-all shadow-sm duration-150"
                      onClick={handleFindReplace}
                      title="Find & Replace"
                    >
                      <Search className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {user && activeProjectId ? (
                  <>
                    <span className="mx-0.5 hidden h-5 w-px bg-slate-700/60 sm:block" />
                    <div className="flex items-center gap-1">
                      {editingProjectName ? (
                        <input
                          className="h-7 w-40 rounded border border-slate-700 bg-slate-900/60 text-slate-200 px-2 text-center text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                          value={projectNameInput}
                          onChange={(e) => setProjectNameInput(e.target.value)}
                          onBlur={() => { if (projectNameInput.trim()) { renameProject(activeProjectId, projectNameInput.trim()); } setEditingProjectName(false); }}
                          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditingProjectName(false); }}
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
                          onClick={() => { setEditingProjectName(true); setProjectNameInput(currentProjectName); }}
                        >
                          <span className="max-w-[160px] truncate">{currentProjectName}</span>
                          <Pencil className="h-2.5 w-2.5 text-slate-400" />
                        </button>
                      )}
                      {savingProject ? <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground" /> : null}
                    </div>
                  </>
                ) : null}

                <div className="ml-auto flex items-center gap-1">
                  {!user && !authLoading ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 gap-1.5 px-2.5 bg-slate-700/40 hover:bg-slate-700 border border-slate-700/60 text-slate-200 hover:text-white transition-all shadow-sm duration-150"
                      onClick={() => { setAuthModalOpen(true); setAuthMode("signin"); }}
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline text-xs">Sign In</span>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 w-8 p-0 bg-slate-700/40 hover:bg-slate-700 border border-slate-700/60 text-slate-200 hover:text-white transition-all shadow-sm duration-150"
                    onClick={() => setGeminiSettingsOpen(true)}
                    title="AI Model Settings"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                  </Button>
                  <label className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-slate-700 bg-slate-700/40 text-sm shadow-sm text-slate-200 hover:text-white hover:bg-slate-700 transition-all duration-150" title="Upload .tex file">
                    <input
                      type="file"
                      accept=".tex,application/x-tex,text/x-tex,text/plain"
                      className="sr-only"
                      onChange={handleFileChange}
                    />
                    {loadingFile ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                  </label>
                  <Button type="button" size="sm" className="h-8 w-8 p-0 bg-slate-700/40 hover:bg-slate-700 border border-slate-700/60 text-slate-200 hover:text-white transition-all shadow-sm duration-150" onClick={downloadLatexSource} title="Download .tex source">
                    <Code2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 w-8 p-0 bg-slate-700/40 hover:bg-slate-700 border border-slate-700/60 text-slate-200 hover:text-white disabled:bg-slate-800/40 disabled:border-slate-800/30 disabled:text-slate-500 transition-all shadow-sm duration-150"
                    onClick={auditResume}
                    disabled={auditing || resumeSections.length === 0}
                    title="ATS Audit"
                  >
                    {auditing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <SearchCheck className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 gap-1.5 px-2.5 bg-slate-700/40 hover:bg-slate-700 border border-slate-700/60 text-slate-200 hover:text-white disabled:bg-slate-800/40 disabled:border-slate-800/30 disabled:text-slate-500 transition-all shadow-sm duration-150"
                    disabled={!user || lastCompileSuccess !== true}
                    onClick={openPortfolioGenerator}
                    title="Generate Portfolio Website"
                  >
                    <Globe className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 w-8 p-0 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 border-0 text-white font-semibold transition-all shadow-md shadow-emerald-950/20 disabled:bg-slate-800/40 disabled:text-slate-500 disabled:border-0"
                    onClick={downloadResumePdf}
                    disabled={!canCompilePdf || downloading}
                    title={
                      compilerStatus?.available
                        ? `Download PDF via ${compilerStatus.compiler}`
                        : "No LaTeX compiler found"
                    }
                  >
                    {downloading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setIsInputPanelOpen((current) => !current)}
                    size="sm"
                    className={`h-8 w-8 p-0 transition-all shadow-sm border duration-150 ${isInputPanelOpen ? "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-500" : "bg-slate-700/40 border-slate-700/60 text-slate-200 hover:bg-slate-700 hover:text-white"}`}
                    aria-label={isInputPanelOpen ? "Hide input panel" : "Show input panel"}
                    title={isInputPanelOpen ? "Hide input panel" : "Show input panel"}
                  >
                    {isInputPanelOpen ? (
                      <ChevronRight className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronLeft className="h-3.5 w-3.5" />
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

              {!compilerStatus?.available && !checkingCompiler ? (
                <div className="px-4 pt-2">
                  <CompilerNotice status={compilerStatus} checking={checkingCompiler} />
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
                    readOnly={suggesting}
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
                    className={`min-h-0 flex-1 text-sm [&_.cm-editor]:h-full${suggesting ? " opacity-60 pointer-events-none" : ""}`}
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
                          className="h-7 gap-1.5 px-2 text-sm text-slate-100 hover:bg-slate-700 hover:text-slate-100 disabled:opacity-40"
                          onClick={renderPdfPreview}
                          disabled={!previewId}
                          title={previewId ? "Open PDF in new tab" : "Compile first to preview PDF"}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <span className="mx-1 h-6 w-px bg-slate-600" />

                        <Button
                          type="button"
                          variant="ghost"
                          className={`relative h-7 gap-1.5 px-2 text-sm hover:bg-slate-700 hover:text-slate-100 ${lastCompileSuccess === false
                            ? "text-red-400"
                            : lastCompileSuccess === true
                              ? "text-green-400"
                              : "text-slate-100"
                            }`}
                          onClick={recompileLatex}
                          disabled={isRecompiling || !canCompilePdf}
                          title="Recompile LaTeX and show diagnostics"
                        >
                          {isRecompiling ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : lastCompileSuccess === true ? (
                            <CircleCheck className="h-3.5 w-3.5" />
                          ) : lastCompileSuccess === false ? (
                            <AlertTriangle className="h-3.5 w-3.5" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                          {lastCompileSuccess === false && diagnostics.filter((d) => d.severity === "error").length > 0 && (
                            <Badge variant="destructive" className="ml-1 h-4 min-w-4 px-1 text-[10px] leading-none">
                              {diagnostics.filter((d) => d.severity === "error").length}
                            </Badge>
                          )}
                        </Button>




                      </div>
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
                        title="Reset zoom to 100%"
                      >
                        {previewZoom}%
                      </Button>
                    </div>

                    {/* Diagnostics Panel */}
                    <AnimatePresence>
                      {diagnosticsPanelOpen && diagnostics.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden border-t border-slate-700 bg-slate-900"
                        >
                          <div className="flex items-center justify-between px-3 py-1.5">
                            <div className="flex items-center gap-3 text-xs">
                              {diagnostics.filter((d) => d.severity === "error").length > 0 && (
                                <span className="flex items-center gap-1 text-red-400">
                                  <AlertTriangle className="h-3 w-3" />
                                  {diagnostics.filter((d) => d.severity === "error").length} error{diagnostics.filter((d) => d.severity === "error").length > 1 ? "s" : ""}
                                </span>
                              )}
                              {diagnostics.filter((d) => d.severity === "warning").length > 0 && (
                                <span className="flex items-center gap-1 text-amber-400">
                                  <AlertTriangle className="h-3 w-3" />
                                  {diagnostics.filter((d) => d.severity === "warning").length} warning{diagnostics.filter((d) => d.severity === "warning").length > 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 text-slate-400 hover:bg-slate-700 hover:text-slate-100"
                              onClick={() => setDiagnosticsPanelOpen(false)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          <ScrollArea className="max-h-48">
                            <div className="space-y-0.5 px-3 pb-2">
                              {diagnostics.map((diag) => (
                                <div
                                  key={diag.id}
                                  className="flex items-start gap-2 rounded px-1.5 py-1 text-xs hover:bg-slate-800"
                                >
                                  <AlertTriangle
                                    className={`mt-0.5 h-3 w-3 shrink-0 ${diag.severity === "error" ? "text-red-400" : "text-amber-400"
                                      }`}
                                  />
                                  <button
                                    type="button"
                                    className="shrink-0 font-mono text-blue-400 hover:underline"
                                    onClick={() => focusEditorAtSourceLine(diag.line - 1)}
                                    title={`Go to line ${diag.line}`}
                                  >
                                    L{diag.line}
                                  </button>
                                  <span className="text-slate-300">{diag.message}</span>
                                  {diag.context && (
                                    <code className="ml-auto shrink-0 truncate rounded bg-slate-800 px-1 text-[10px] text-slate-500">
                                      {diag.context}
                                    </code>
                                  )}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div ref={previewPaneRef} className="min-h-0 flex-1">
                      <PdfCanvasViewer
                        ref={pdfViewerRef}
                        pdfData={pdfArrayBuffer}
                        zoom={previewZoom}
                        onZoomChange={(z) => setPreviewZoom(clampPdfZoom(z))}
                        synctexMapping={synctexMapping}
                        lineOffset={synctexLineOffset}
                        highlightRect={forwardHighlight}
                        onPdfClick={handleInverseSync}
                        onHighlightFade={() => setForwardHighlight(null)}
                      />
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
                  className="flex w-full min-h-0 flex-col xl:w-[450px] xl:max-w-[450px] xl:self-stretch overflow-hidden"
                >
                  <Card className="sticky top-5 min-h-0 flex-1 xl:flex xl:h-full xl:min-h-0 xl:flex-col bg-gradient-to-br from-slate-800 via-slate-900 to-emerald-950/85 border-slate-700/60 shadow-2xl rounded-2xl text-slate-100 backdrop-blur-lg">
                    <CardContent className="space-y-5 pt-5 xl:flex xl:flex-1 xl:flex-col xl:overflow-y-auto bg-transparent border-0">
                      <div
                        className="grid grid-cols-2 rounded-xl border border-slate-700/80 bg-slate-950/60 p-1 backdrop-blur-md"
                        role="tablist"
                        aria-label="Input panel tabs"
                      >
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className={`h-8 text-xs font-semibold rounded-lg transition-all duration-200 border ${inputSidebarTab === "project"
                            ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-950/40 hover:from-emerald-400 hover:to-teal-400 border-emerald-400/20"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border-transparent"
                            }`}
                          onClick={() => setInputSidebarTab("project")}
                          role="tab"
                          aria-selected={inputSidebarTab === "project"}
                        >
                          Project Drafts
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className={`h-8 text-xs font-semibold rounded-lg transition-all duration-200 border ${inputSidebarTab === "jd"
                            ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-950/40 hover:from-emerald-400 hover:to-teal-400 border-emerald-400/20"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border-transparent"
                            }`}
                          onClick={() => setInputSidebarTab("jd")}
                          role="tab"
                          aria-selected={inputSidebarTab === "jd"}
                        >
                          Job Description
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
                            <div className="w-full space-y-4 rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 shadow-xl backdrop-blur-md">
                              <div className="space-y-2">
                                <Label htmlFor="companyRole" className="text-xs font-bold uppercase tracking-wider text-emerald-400">Company name & role</Label>
                                <Input
                                  id="companyRole"
                                  value={companyRole}
                                  onChange={(event) => setCompanyRole(event.target.value)}
                                  placeholder="e.g. Google - Senior Frontend Engineer"
                                  maxLength={COMPANY_ROLE_LIMIT}
                                  className="h-10 bg-slate-950/60 border-slate-700/60 text-slate-100 placeholder-slate-500 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 focus:border-emerald-500 rounded-lg shadow-inner transition-all duration-200 text-xs"
                                />
                                <FieldCounter value={companyRole.length} max={COMPANY_ROLE_LIMIT} />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="jd" className="text-xs font-bold uppercase tracking-wider text-emerald-400">Job Description (JD)</Label>
                                <Textarea
                                  id="jd"
                                  value={jd}
                                  onChange={(event) => setJd(event.target.value)}
                                  placeholder="Paste the job description here to tailor your resume perfectly..."
                                  className="min-h-[160px] bg-slate-950/60 border-slate-700/60 text-slate-100 placeholder-slate-500 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 focus:border-emerald-500 rounded-lg shadow-inner transition-all duration-200 text-xs leading-relaxed"
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
                                --dot-color: #10b981;
                                --line-color: #34d399;
                                --grid-color: rgba(16, 185, 129, 0.05);
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
                                padding: 0.9rem 1.5rem;
                                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                                border: 1px solid rgba(52, 211, 153, 0.2);
                                color: #fff;
                                font-family: inherit;
                                font-size: 0.875rem;
                                font-weight: 600;
                                border-radius: 8px;
                                cursor: pointer;
                                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                                z-index: 10;
                                box-shadow: 0 4px 20px 0 rgba(16, 185, 129, 0.3);
                                text-transform: uppercase;
                                letter-spacing: 0.05em;
                              }

                              .btn-wrapper .btn:hover:not(:disabled) {
                                transform: translateY(-2px);
                                background: linear-gradient(135deg, #059669 0%, #047857 100%);
                                box-shadow: 0 8px 25px rgba(5, 150, 105, 0.4);
                                border-color: rgba(52, 211, 153, 0.4);
                              }

                              .btn-wrapper .btn:active:not(:disabled) {
                                transform: scale(0.98);
                              }

                              .btn-wrapper .btn:disabled {
                                background: #334155;
                                color: #64748b;
                                border-color: #1e293b;
                                box-shadow: none;
                                cursor: not-allowed;
                              }

                              .btn-wrapper .btn-svg {
                                margin-left: 0.5rem;
                                height: 18px;
                                width: 18px;
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

                                {suggesting ? (
                                  <button
                                    type="button"
                                    className="btn"
                                    onClick={cancelSuggestions}
                                  >
                                    <X className="mr-2 h-4 w-4" />
                                    Cancel
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn"
                                    disabled={!canSubmit}
                                    onClick={requestSuggestions}
                                  >
                                    <svg className="btn-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M17.6744 11.4075L15.7691 17.1233C15.7072 17.309 15.5586 17.4529 15.3709 17.5087L3.69348 20.9803C3.22819 21.1186 2.79978 20.676 2.95328 20.2155L6.74467 8.84131C6.79981 8.67588 6.92419 8.54263 7.08543 8.47624L12.472 6.25822C12.696 6.166 12.9535 6.21749 13.1248 6.38876L17.5294 10.7935C17.6901 10.9542 17.7463 11.1919 17.6744 11.4075Z" />
                                      <path d="M3.2959 20.6016L9.65986 14.2376" />
                                      <path d="M17.7917 11.0557L20.6202 8.22724C21.4012 7.44619 21.4012 6.17986 20.6202 5.39881L18.4989 3.27749C17.7178 2.49645 16.4515 2.49645 15.6704 3.27749L12.842 6.10592" />
                                      <path d="M11.7814 12.1163C11.1956 11.5305 10.2458 11.5305 9.66004 12.1163C9.07426 12.7021 9.07426 13.6519 9.66004 14.2376C10.2458 14.8234 11.1956 14.8234 11.7814 14.2376C12.3671 13.6519 12.3671 12.7021 11.7814 12.1163Z" />
                                    </svg>
                                    Suggest resume changes
                                  </button>
                                )}
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
        </div>
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

function isValidModel(model: unknown): model is string {
  return typeof model === "string" && MODEL_OPTIONS.some((opt) => opt.model === model);
}

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict`;
}

function readCachedLlmSettings(): LlmSettings | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    const provider = getCookie("llm_provider");
    const model = getCookie("llm_model");
    const geminiKey = getCookie("gemini_api_key");
    const groqKey = getCookie("groq_api_key");
    const claudeKey = getCookie("claude_api_key");

    if (provider || model || geminiKey || groqKey || claudeKey) {
      return {
        provider: (["gemini", "groq", "claude"].includes(provider ?? "") ? provider : "gemini") as LlmProvider,
        model: isValidModel(model) ? model : "gemini-2.5-pro",
        geminiApiKey: geminiKey ?? "",
        groqApiKey: groqKey ?? "",
        claudeApiKey: claudeKey ?? "",
      };
    }

    const cachedValue = window.localStorage.getItem(LLM_SETTINGS_CACHE_KEY);
    if (cachedValue) {
      const parsed = JSON.parse(cachedValue) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const migrated: LlmSettings = {
          provider: (["gemini", "groq", "claude"].includes(parsed.provider as string) ? parsed.provider : "gemini") as LlmProvider,
          model: isValidModel(parsed.model) ? parsed.model : "gemini-2.5-pro",
          geminiApiKey: typeof parsed.geminiApiKey === "string" ? parsed.geminiApiKey : "",
          groqApiKey: typeof parsed.groqApiKey === "string" ? parsed.groqApiKey : "",
          claudeApiKey: typeof parsed.claudeApiKey === "string" ? parsed.claudeApiKey : "",
        };
        writeCachedLlmSettings(migrated);
        window.localStorage.removeItem(LLM_SETTINGS_CACHE_KEY);
        return migrated;
      }
    }

    const legacyValue = window.localStorage.getItem(LEGACY_GEMINI_SETTINGS_KEY);
    if (legacyValue) {
      const legacy = JSON.parse(legacyValue) as Record<string, unknown>;
      if (legacy && typeof legacy === "object") {
        const migrated: LlmSettings = {
          provider: "gemini",
          model: isValidModel(legacy.model) ? legacy.model : "gemini-2.5-pro",
          geminiApiKey: typeof legacy.apiKey === "string" ? legacy.apiKey : "",
          groqApiKey: "",
          claudeApiKey: "",
        };
        writeCachedLlmSettings(migrated);
        window.localStorage.removeItem(LEGACY_GEMINI_SETTINGS_KEY);
        return migrated;
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}

function writeCachedLlmSettings(settings: LlmSettings) {
  setCookie("llm_provider", settings.provider);
  setCookie("llm_model", settings.model);
  setCookie("gemini_api_key", settings.geminiApiKey);
  setCookie("groq_api_key", settings.groqApiKey);
  setCookie("claude_api_key", settings.claudeApiKey);
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
