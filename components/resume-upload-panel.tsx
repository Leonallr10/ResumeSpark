"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type DragEvent,
  type ChangeEvent,
} from "react";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  Brain,
  GripVertical,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { ResumeDocumentModel } from "@/server/documents/resume-document-model";
import {
  validatePdfFile,
  extractParsedLines,
  renderPdfToImages,
  groupIntoSections,
  buildDocumentModel,
  type ParsedLine,
} from "@/lib/pdf-parser";

/* ─────────────────────────── Props ──────────────────────────── */

type ResumeUploadPanelProps = {
  onModelLoaded: (model: ResumeDocumentModel) => void;
  onClose?: () => void;
  initialFile?: File | null;
};

/* ─────────────────────────── State types ──────────────────────────── */

type UploadPhase =
  | "idle"
  | "validating"
  | "extracting"
  | "parsing"
  | "llm_fallback"
  | "done"
  | "error";

const PHASE_LABELS: Record<UploadPhase, string> = {
  idle: "Upload",
  validating: "Validating file…",
  extracting: "Extracting text from PDF…",
  parsing: "Parsing resume structure…",
  llm_fallback: "Using AI for precise extraction…",
  done: "Done",
  error: "Error",
};

/* ─────────────────────────── Component ──────────────────────────── */

export function ResumeUploadPanel({
  onModelLoaded,
  onClose,
  initialFile,
}: ResumeUploadPanelProps) {
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [confidence, setConfidence] = useState<number>(0);
  const [usedLlm, setUsedLlm] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [unassigned, setUnassigned] = useState<ParsedLine[]>([]);
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [fileName, setFileName] = useState("");
  const [dragOverSection, setDragOverSection] = useState<string | null>(null);
  const [pendingModel, setPendingModel] = useState<ResumeDocumentModel | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragLineRef = useRef<ParsedLine | null>(null);

  /* ─────────────────────────── Pipeline ──────────────────────────── */

  const processFile = useCallback(async (file: File) => {
    setErrorMsg("");
    setUnassigned([]);
    setConfidence(0);
    setUsedLlm(false);
    setPendingModel(null);

    // 1. Validate size and type
    setPhase("validating");
    if (file.size > 5 * 1024 * 1024) {
      setPhase("error");
      setErrorMsg("File is too large. Maximum size is 5 MB.");
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const mime = file.type || "";
    const isPdf = mime === "application/pdf" || ext === "pdf";
    const isDocx = ext === "docx" || ext === "doc" || mime.includes("wordprocessingml") || mime.includes("msword");
    const isImg = mime.startsWith("image/") || ["jpg", "jpeg", "png", "webp"].includes(ext);

    if (!isPdf && !isDocx && !isImg) {
      setPhase("error");
      setErrorMsg("Unsupported file format. Please upload PDF, DOCX, or an image (.png, .jpg, .webp).");
      return;
    }

    setFileName(file.name);

    // 2. Primary pipeline: Unified server-side AI extraction (/api/resume/upload-parse)
    // Runs SHA-256 caching, multi-column extraction, text cleaning, regex contact extraction,
    // and Gemini 2.5 Flash structured parsing with Zod validation.
    setPhase("llm_fallback");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/resume/upload-parse", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process document.");
      }

      const model: ResumeDocumentModel = data.model;
      setConfidence(data.confidence ?? 0.95);
      setUsedLlm(true);
      setPendingModel(model);
      setPhase("done");
      onModelLoaded(model);
      toast.success(
        data.cached
          ? "Resume loaded instantly from cache!"
          : isDocx
          ? "Word document parsed with AI precision!"
          : isImg
          ? "Image parsed via OCR with AI precision!"
          : "Resume parsed with AI precision into Classic Traditional template!",
      );
      return;
    } catch (apiErr) {
      console.warn("Unified AI upload-parse failed, attempting client-side fallback if PDF:", apiErr);

      // 3. Fallback: If server AI failed and it's a text PDF, try client-side heuristic parser
      if (isPdf) {
        setPhase("extracting");
        try {
          const result = await extractParsedLines(file);
          const lines = result.lines;
          const sourceText = result.sourceText;
          const annotationUrls = result.annotationUrls;

          if (!sourceText.trim() || lines.length < 3) {
            throw new Error("Scanned PDF requires server AI extraction.");
          }

          setPhase("parsing");
          const { sections, unassigned: unassignedLines } = groupIntoSections(lines);
          const { model: heuristicModel, confidence: heuristicConf } = buildDocumentModel(sections, annotationUrls);

          setUnassigned(unassignedLines);
          setConfidence(heuristicConf);
          setUsedLlm(false);
          setPendingModel(heuristicModel);
          setPhase("done");
          onModelLoaded(heuristicModel);
          toast.warning(`Server AI unavailable. Using heuristic parser (${Math.round(heuristicConf * 100)}% confidence).`);
          return;
        } catch (heuristicErr) {
          setPhase("error");
          setErrorMsg(apiErr instanceof Error ? apiErr.message : "Failed to parse resume.");
          return;
        }
      } else {
        setPhase("error");
        setErrorMsg(apiErr instanceof Error ? apiErr.message : "Failed to parse resume.");
        return;
      }
    }
  }, [onModelLoaded]);

  useEffect(() => {
    if (initialFile) {
      processFile(initialFile);
    }
  }, [initialFile, processFile]);

  /* ─────────────────────────── Drag-drop handlers ──────────────────────────── */

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  }, [processFile]);

  const handleFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
    e.target.value = "";
  }, [processFile]);

  /* ─────────────────────────── Unassigned drag-to-section ──────────────────────────── */

  const SECTION_TARGETS = [
    { key: "summary", label: "Summary" },
    { key: "experience", label: "Experience" },
    { key: "skills", label: "Skills" },
    { key: "projects", label: "Projects" },
    { key: "education", label: "Education" },
    { key: "achievements", label: "Achievements" },
  ];

  const handleDragLineStart = (line: ParsedLine) => {
    dragLineRef.current = line;
  };

  const handleDropOnSection = useCallback((sectionKey: string) => {
    const line = dragLineRef.current;
    if (!line || !pendingModel) return;

    // Assign the text from the unassigned line to the appropriate section
    const text = line.text.trim();
    const updatedModel = { ...pendingModel };

    if (sectionKey === "summary") {
      updatedModel.summary = updatedModel.summary
        ? `${updatedModel.summary} ${text}`
        : text;
    } else if (sectionKey === "skills") {
      const existing = updatedModel.skills.find((s) => s.category === "General");
      const newSkills = text.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
      if (existing) {
        existing.skills = [...existing.skills, ...newSkills];
        updatedModel.skills = [...updatedModel.skills];
      } else {
        updatedModel.skills = [
          ...updatedModel.skills,
          { id: `skill-drag-${Date.now()}`, category: "General", skills: newSkills },
        ];
      }
    } else if (sectionKey === "experience") {
      updatedModel.experience = [
        ...updatedModel.experience,
        {
          id: `exp-drag-${Date.now()}`,
          company: text,
          role: "",
          location: "",
          startDate: "",
          endDate: "",
          bullets: [],
          technologies: [],
        },
      ];
    } else if (sectionKey === "projects") {
      updatedModel.projects = [
        ...updatedModel.projects,
        {
          id: `proj-drag-${Date.now()}`,
          title: text,
          subtitle: "",
          startDate: "",
          endDate: "",
          link: "",
          technologies: [],
          bullets: [],
        },
      ];
    } else if (sectionKey === "education") {
      updatedModel.education = [
        ...updatedModel.education,
        {
          id: `edu-drag-${Date.now()}`,
          institution: text,
          degree: "",
          field: "",
          location: "",
          startDate: "",
          endDate: "",
          gpa: "",
          bullets: [],
        },
      ];
    } else if (sectionKey === "achievements") {
      updatedModel.achievements = [
        ...updatedModel.achievements,
        {
          id: `ach-drag-${Date.now()}`,
          title: text,
          subtitle: "",
          date: "",
          description: "",
          bullets: [],
        },
      ];
    }

    setPendingModel(updatedModel);
    setUnassigned((prev) => prev.filter((l) => l !== line));
    onModelLoaded(updatedModel);
    setDragOverSection(null);
    dragLineRef.current = null;
    toast.success(`Added to ${sectionKey}.`);
  }, [pendingModel, onModelLoaded]);

  /* ─────────────────────────── Render ──────────────────────────── */

  const isLoading = ["validating", "extracting", "parsing", "llm_fallback"].includes(phase);
  const isDone = phase === "done";
  const isError = phase === "error";
  const progressPercent = { validating: 15, extracting: 40, parsing: 70, llm_fallback: 85, done: 100, error: 0, idle: 0 }[phase];

  return (
    <div className="flex flex-col gap-4">
      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isLoading && fileInputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed
          p-8 cursor-pointer transition-all duration-300
          ${isDragging ? "border-emerald-400 bg-emerald-500/10 scale-[1.01]" : "border-slate-700 hover:border-emerald-600/60 hover:bg-slate-800/50"}
          ${isLoading ? "cursor-not-allowed opacity-80 pointer-events-none" : ""}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,image/*"
          className="hidden"
          onChange={handleFileChange}
          disabled={isLoading}
        />

        {/* Icon */}
        <div className={`p-3 rounded-full transition-colors ${isDragging ? "bg-emerald-500/20" : "bg-slate-800"}`}>
          {isLoading ? (
            <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
          ) : isDone ? (
            <CheckCircle className="w-7 h-7 text-emerald-400" />
          ) : isError ? (
            <AlertTriangle className="w-7 h-7 text-red-400" />
          ) : (
            <Upload className="w-7 h-7 text-slate-400" />
          )}
        </div>

        {/* Label */}
        <div className="text-center">
          {isLoading ? (
            <>
              <p className="text-sm font-semibold text-emerald-300 animate-pulse">
                {PHASE_LABELS[phase]}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{fileName}</p>
            </>
          ) : isDone ? (
            <>
              <p className="text-sm font-semibold text-emerald-300">Resume loaded!</p>
              <p className="text-xs text-slate-400 mt-0.5">{fileName}</p>
              <p className="text-xs text-slate-500 mt-0.5">Click or drop to replace</p>
            </>
          ) : isError ? (
            <>
              <p className="text-sm font-semibold text-red-400">{errorMsg}</p>
              <p className="text-xs text-slate-500 mt-1">Click or drop a new resume to retry</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-200">
                {isDragging ? "Drop your resume here" : "Drop resume file here"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">or click to browse • PDF, DOCX, PNG, JPG • max 5 MB</p>
            </>
          )}
        </div>

        {/* Progress bar */}
        {isLoading && (
          <div className="w-full mt-1">
            <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-600 text-center mt-1">{progressPercent}%</p>
          </div>
        )}
      </div>

      {/* Confidence Badge */}
      {isDone && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 rounded-lg border border-slate-800">
          {usedLlm ? (
            <Brain className="w-4 h-4 text-indigo-400 shrink-0" />
          ) : (
            <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-400">Parse confidence</span>
              <span className={`font-bold tabular-nums ${confidence >= 0.7 ? "text-emerald-400" : "text-yellow-400"}`}>
                {Math.round(confidence * 100)}%
              </span>
            </div>
            <div className="h-1 mt-1 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${confidence >= 0.7 ? "bg-emerald-500" : "bg-yellow-500"}`}
                style={{ width: `${Math.round(confidence * 100)}%` }}
              />
            </div>
          </div>
          {usedLlm && (
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded px-1.5 py-0.5 shrink-0">
              AI
            </span>
          )}
        </div>
      )}

      {/* Unassigned Content Bucket */}
      {isDone && unassigned.length > 0 && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 overflow-hidden">
          <button
            onClick={() => setShowUnassigned((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-yellow-400 hover:bg-yellow-500/10 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Unassigned content ({unassigned.length} lines)
            </span>
            {showUnassigned ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showUnassigned && (
            <div className="px-3 pb-3 space-y-2">
              <p className="text-[10px] text-slate-500">
                These lines couldn&apos;t be placed automatically. Drag them to a section below.
              </p>

              {/* Draggable unassigned lines */}
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {unassigned.map((line, idx) => (
                  <div
                    key={idx}
                    draggable
                    onDragStart={() => handleDragLineStart(line)}
                    className="flex items-start gap-1.5 px-2 py-1 bg-slate-900 rounded border border-slate-800 cursor-grab hover:border-yellow-500/40 transition-colors group text-xs text-slate-300"
                  >
                    <GripVertical className="w-3 h-3 text-slate-600 mt-0.5 shrink-0 group-hover:text-yellow-500 transition-colors" />
                    <span className="truncate">{line.text}</span>
                  </div>
                ))}
              </div>

              {/* Drop zones */}
              <div className="grid grid-cols-3 gap-1 mt-2">
                {SECTION_TARGETS.map((sec) => (
                  <div
                    key={sec.key}
                    onDragOver={(e) => { e.preventDefault(); setDragOverSection(sec.key); }}
                    onDragLeave={() => setDragOverSection(null)}
                    onDrop={() => handleDropOnSection(sec.key)}
                    className={`
                      py-1.5 px-2 rounded border text-center text-[10px] font-medium transition-all
                      ${dragOverSection === sec.key
                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                        : "border-slate-700 text-slate-500 hover:border-slate-600"}
                    `}
                  >
                    {sec.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer tips */}
      {phase === "idle" && (
        <div className="flex items-start gap-2 px-3 py-2 bg-slate-900/60 rounded-lg border border-slate-800/60">
          <FileText className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
          <p className="text-[10px] text-slate-500 leading-relaxed">
            Works with any resume template. Content is extracted and mapped to the Classic Traditional template. Low-confidence fields will be highlighted for review.
          </p>
        </div>
      )}

      {/* Close button */}
      {onClose && isDone && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="self-end h-7 text-xs text-slate-400 hover:text-slate-200 gap-1"
        >
          <X className="w-3 h-3" /> Close panel
        </Button>
      )}
    </div>
  );
}
