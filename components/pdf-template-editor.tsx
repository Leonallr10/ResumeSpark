"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast, Toaster } from "sonner";
import {
  FileText,
  Sparkles,
  Download,
  Printer,
  Code2,
  RefreshCw,
  Layout,
  Plus,
  Trash2,
  ShieldCheck,
  Edit3,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import {
  type ResumeDocumentModel,
  type CustomSection,
  type ProjectEntry,
  createSampleResumeTemplate1,
} from "@/server/documents/resume-document-model";
import { parseLatexToDocumentModel } from "@/server/documents/from-latex";
import { generateLatexFromDocumentModel } from "@/server/documents/to-latex";
import { documentModelToSections, applySuggestionToDocumentModel } from "@/server/documents/from-template";
import { TEMPLATE_REGISTRY, getTemplateRenderer } from "@/lib/templates/registry";
import { PdfTemplateGallery } from "./pdf-template-gallery";
import { PdfSuggestionDiffModal } from "./pdf-suggestion-diff-modal";
import { PdfCanvasViewer } from "./pdf-canvas-viewer";
import { ProjectRankingPanel } from "./project-ranking-panel";
import { JdInputPanel } from "./jd-input-panel";
import { JobMatchModal } from "./job-match-modal";
import { analyzeJobMatch } from "@/lib/job-match";
import type { JobMatchResult } from "@/types/job-match";
import { emptyProjectDraft } from "@/components/latex-project-fields";
import { canInsertProject, type ProjectDraft } from "@/lib/latex-resume";
import type { AiSuggestion, SuggestionResponse, LlmProvider } from "@/types/resume";
import type { ProjectRankingItem } from "@/lib/schemas";

const PDF_STORAGE_KEY = "resume_pdf_document_model_v1";
const LATEX_STORAGE_KEY = "resume_latex_source_v1";
const ACTIVE_FLOW_KEY = "resume_active_flow";

export function PdfTemplateEditor() {
  const router = useRouter();

  // State
  const [model, setModel] = useState<ResumeDocumentModel>(createSampleResumeTemplate1);
  const [activeTab, setActiveTab] = useState<"editor" | "gallery">("editor");
  const [previewMode, setPreviewMode] = useState<"html" | "compiled">("html");
  const [pdfArrayBuffer, setPdfArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [isCompilingPdf, setIsCompilingPdf] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showAiDrawer, setShowAiDrawer] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [role, setRole] = useState("Software Engineer / AI Engineer");
  const [targetCompanyRole, setTargetCompanyRole] = useState("Software Engineer / AI Engineer");
  const [jobDescription, setJobDescription] = useState("");
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>(emptyProjectDraft);
  const [projectDrafts, setProjectDrafts] = useState<ProjectDraft[]>([]);
  const [llmProvider, setLlmProvider] = useState<LlmProvider>("gemini");
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [rankedProjects, setRankedProjects] = useState<ProjectRankingItem[]>([]);
  const [jobMatchOpen, setJobMatchOpen] = useState(false);
  const [jobMatchResult, setJobMatchResult] = useState<JobMatchResult | null>(null);
  const [isJobMatchAnalyzing, setIsJobMatchAnalyzing] = useState(false);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);

  const handleCompanyNameChange = useCallback((c: string) => {
    setCompanyName(c);
    setTargetCompanyRole([c, role].filter(Boolean).join(" - "));
  }, [role]);

  const handleRoleChange = useCallback((r: string) => {
    setRole(r);
    setTargetCompanyRole([companyName, r].filter(Boolean).join(" - "));
  }, [companyName]);

  // Sync projects from loaded model to project drafts if empty
  useEffect(() => {
    if (model.projects && model.projects.length > 0 && projectDrafts.length === 0) {
      const drafts: ProjectDraft[] = model.projects.map((p) => ({
        heading: p.title || "",
        explanation: Array.isArray(p.bullets) ? p.bullets.join("\n") : "",
        techStack: Array.isArray(p.technologies) ? p.technologies.join(", ") : "",
        link: p.link || "",
        fromDate: p.startDate || "",
        toDate: p.endDate || "",
      }));
      setProjectDrafts(drafts);
    }
  }, [model.projects, projectDrafts.length]);

  const handleInsertAllProjectsToModel = useCallback(() => {
    const drafts = projectDrafts.length > 0 ? projectDrafts : [projectDraft];
    const valid = drafts.filter(canInsertProject);
    if (valid.length === 0) {
      toast.error("Please fill in project details first.");
      return;
    }
    const newEntries: ProjectEntry[] = valid.map((draft) => {
      const bullets = draft.explanation
        .split(/\r?\n/)
        .map((b) => b.trim().replace(/^[-•*]\s*/, ""))
        .filter(Boolean);
      return {
        id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: draft.heading.trim(),
        subtitle: "",
        startDate: draft.fromDate.trim(),
        endDate: draft.toDate.trim(),
        link: draft.link.trim(),
        technologies: draft.techStack ? draft.techStack.split(",").map((s) => s.trim()).filter(Boolean) : [],
        bullets: bullets.length > 0 ? bullets : [draft.explanation.trim()],
      };
    });
    saveModel({
      ...model,
      projects: [...model.projects, ...newEntries],
    });
    toast.success(`Inserted ${newEntries.length} project(s) into resume!`);
  }, [projectDrafts, projectDraft, model]);

  const handleInsertSingleProjectToModel = useCallback((idx: number) => {
    const drafts = projectDrafts.length > 0 ? projectDrafts : [projectDraft];
    const draft = drafts[idx];
    if (!draft || !canInsertProject(draft)) {
      toast.error("Project heading is required.");
      return;
    }
    const bullets = draft.explanation
      .split(/\r?\n/)
      .map((b) => b.trim().replace(/^[-•*]\s*/, ""))
      .filter(Boolean);
    const newEntry: ProjectEntry = {
      id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: draft.heading.trim(),
      subtitle: "",
      startDate: draft.fromDate.trim(),
      endDate: draft.toDate.trim(),
      link: draft.link.trim(),
      technologies: draft.techStack ? draft.techStack.split(",").map((s) => s.trim()).filter(Boolean) : [],
      bullets: bullets.length > 0 ? bullets : [draft.explanation.trim()],
    };
    saveModel({
      ...model,
      projects: [...model.projects, newEntry],
    });
    toast.success(`Inserted "${draft.heading}" into resume!`);
  }, [projectDrafts, projectDraft, model]);

  const runJobMatch = useCallback(() => {
    if (!jobDescription.trim()) {
      toast.error("Please paste a Job Description first to check ATS score.");
      return;
    }
    setIsJobMatchAnalyzing(true);
    setJobMatchOpen(true);
    const sections = documentModelToSections(model);
    const latexCode = generateLatexFromDocumentModel(model, model.templateId);
    const result = analyzeJobMatch(sections, jobDescription, latexCode);
    setJobMatchResult(result);
    setIsJobMatchAnalyzing(false);
  }, [jobDescription, model]);

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previewPanelRef = useRef<HTMLDivElement>(null);

  // Attach a native (non-passive) wheel listener so e.preventDefault() actually
  // blocks the browser's built-in Ctrl+Scroll page zoom before it fires.
  useEffect(() => {
    const el = previewPanelRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault(); // blocks browser zoom
      setZoomLevel((z) => {
        const delta = e.deltaY > 0 ? -5 : 5;
        return Math.min(200, Math.max(40, z + delta));
      });
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Load initial model and compiled PDF from localStorage
  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_FLOW_KEY, "pdf");
      const savedPdf = localStorage.getItem(PDF_STORAGE_KEY);
      if (savedPdf) {
        const parsed = JSON.parse(savedPdf);
        // Ensure sectionTitles exists
        if (!parsed.sectionTitles) {
          parsed.sectionTitles = {
            summary: "Professional Summary",
            experience: "Work Experience",
            education: "Education",
            skills: "Skills",
            projects: "Projects",
            achievements: "Achievements and Activities",
          };
        }
        if (!parsed.customSections) parsed.customSections = [];
        setModel(parsed);
      } else {
        const savedLatex = localStorage.getItem(LATEX_STORAGE_KEY);
        if (savedLatex) {
          const parsed = parseLatexToDocumentModel(savedLatex);
          setModel(parsed);
        }
      }

      // Check if exact compiled PDF is available from LaTeX editor
      const savedPdfBase64 = localStorage.getItem("resume_compiled_pdf_base64");
      const switchTs = localStorage.getItem("resume_pdf_switch_ts");
      if (savedPdfBase64) {
        try {
          const bytes = Uint8Array.from(atob(savedPdfBase64), (c) => c.charCodeAt(0));
          setPdfArrayBuffer(bytes.buffer);
          if (switchTs) {
            localStorage.removeItem("resume_pdf_switch_ts");
            setPreviewMode("compiled");
            toast.success("Loaded exact compiled LaTeX PDF preview!");
          }
        } catch {
          // ignore decode error
        }
      }
    } catch {
      // fallback to initial
    }
  }, []);

  // On-demand LaTeX compilation from PDF Studio
  const handleCompileLatexPdf = async () => {
    setIsCompilingPdf(true);
    const toastId = toast.loading("Compiling LaTeX template to vector PDF...");
    try {
      const latex = generateLatexFromDocumentModel(model, model.templateId);
      const res = await fetch("/api/resume/compile-latex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latex }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "LaTeX compilation failed.");
      }

      const pdfBytes = Uint8Array.from(atob(data.pdf), (c) => c.charCodeAt(0));
      setPdfArrayBuffer(pdfBytes.buffer);
      localStorage.setItem("resume_compiled_pdf_base64", data.pdf);
      setPreviewMode("compiled");

      if (data.overflow?.hasOverflow) {
        toast.warning(data.overflow.message || "Page overflow detected.", { id: toastId, duration: 6000 });
      } else {
        toast.success("Compiled exact PDF preview!", { id: toastId });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to compile LaTeX PDF.", { id: toastId });
    } finally {
      setIsCompilingPdf(false);
    }
  };

  // Save to localStorage whenever model updates
  const saveModel = useCallback((nextModel: ResumeDocumentModel) => {
    setModel(nextModel);
    try {
      localStorage.setItem(PDF_STORAGE_KEY, JSON.stringify(nextModel));
      // Keep LaTeX model in sync for cross-flow switching
      const generatedLatex = generateLatexFromDocumentModel(nextModel, nextModel.templateId);
      localStorage.setItem(LATEX_STORAGE_KEY, generatedLatex);
    } catch {
      // storage error
    }
  }, []);

  // Cross-Flow Transition to LaTeX Editor
  const handleSwitchToLatex = () => {
    try {
      const generatedLatex = generateLatexFromDocumentModel(model, model.templateId);
      localStorage.setItem(LATEX_STORAGE_KEY, generatedLatex);
      localStorage.setItem(ACTIVE_FLOW_KEY, "latex");
      localStorage.setItem("resume_latex_switch_ts", Date.now().toString());
      toast.success("Synchronized template with LaTeX editor. Loading compiler...");
      router.push("/latex-editor");
    } catch (err) {
      toast.error("Failed to convert model to LaTeX.");
    }
  };

  // AI Suggestions Trigger
  const handleGenerateAiSuggestions = async () => {
    if (!jobDescription.trim()) {
      toast.error("Please paste a target Job Description to generate tailored suggestions.");
      return;
    }

    setIsAiLoading(true);
    try {
      const sections = documentModelToSections(model);
      const activeDrafts = projectDrafts.length > 0 ? projectDrafts : [projectDraft];
      const projectParam = activeDrafts
        .filter(canInsertProject)
        .map((p) => `${p.heading} (${p.techStack}): ${p.explanation}`)
        .join("\n\n");

      const res = await fetch("/api/resume/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeSections: sections,
          companyRole: targetCompanyRole,
          jd: jobDescription,
          project: projectParam,
          provider: llmProvider,
        }),
      });

      const data: SuggestionResponse = await res.json();
      if (!res.ok) {
        throw new Error((data as unknown as { error?: string })?.error || "Failed to generate suggestions.");
      }

      setSuggestions(data.suggestions || []);
      setRankedProjects(data.rankedProjects || []);
      setIsDiffModalOpen(true);
      setShowAiDrawer(false);
      toast.success(`Generated ${data.suggestions?.length || 0} guardrail-verified suggestions!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error generating AI suggestions.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // Apply single suggestion
  const handleApplySuggestion = (sug: AiSuggestion) => {
    const updated = applySuggestionToDocumentModel(
      model,
      sug.targetLineId,
      sug.suggestedText,
      sug.action,
    );
    saveModel(updated);
    setSuggestions((prev) => prev.filter((s) => s.id !== sug.id));
    toast.success("Applied suggestion to resume!");
  };

  // Apply all suggestions
  const handleApplyAllSuggestions = (sugList: AiSuggestion[]) => {
    let current = model;
    for (const sug of sugList) {
      current = applySuggestionToDocumentModel(
        current,
        sug.targetLineId,
        sug.suggestedText,
        sug.action,
      );
    }
    saveModel(current);
    setSuggestions([]);
    setIsDiffModalOpen(false);
    toast.success(`Successfully applied all ${sugList.length} suggestions!`);
  };

  // Print / PDF Export
  const handlePrintPdf = () => {
    if (previewMode === "compiled" && pdfArrayBuffer) {
      const blob = new Blob([pdfArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.src = url;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(url);
        }, 60000);
      };
      return;
    }
    window.print();
  };

  // 1-Click Client PDF Download via html2pdf or Vector PDF
  const handleDownloadPdf = async () => {
    if (previewMode === "compiled" && pdfArrayBuffer) {
      const blob = new Blob([pdfArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${model.personalInfo.fullName.replace(/\s+/g, "_") || "Resume"}_Compiled.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Downloaded compiled PDF!");
      return;
    }

    const toastId = toast.loading("Rendering printable PDF...");
    try {
      const html2pdfModule = await import("html2pdf.js");
      const html2pdf = html2pdfModule.default;
      const element = previewContainerRef.current?.querySelector(".resume-sheet") as HTMLElement | null;
      if (!element) throw new Error("Resume canvas element not found.");

      const opt = {
        margin: 0,
        filename: `${model.personalInfo.fullName.replace(/\s+/g, "_") || "Resume"}_Tailored.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      };

      await html2pdf().set(opt).from(element).save();
      toast.success("PDF Downloaded!", { id: toastId });
    } catch (err) {
      toast.error("Download failed. Opening system print dialog instead.", { id: toastId });
      window.print();
    }
  };

  // Helper to add a custom section
  const handleAddCustomSection = (presetTitle = "New Section") => {
    const newSection: CustomSection = {
      id: `custom-${Date.now()}`,
      title: presetTitle,
      items: [
        {
          id: `item-${Date.now()}`,
          title: "Item Heading / Award / Role",
          subtitle: "Organization / Subtitle",
          date: "2025",
          bullets: ["Key accomplishment or point detail here."],
        },
      ],
    };
    saveModel({
      ...model,
      customSections: [...(model.customSections || []), newSection],
    });
    toast.success(`Added new section: "${presetTitle}"`);
  };

  // Template HTML Render
  const renderedHtml = getTemplateRenderer(model.templateId)(model);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-100 print:h-auto print:overflow-visible print:bg-white print:text-black print:block print:p-0 print:m-0">
      <Toaster position="top-right" richColors />

      {/* Top Header */}
      <header className="no-print print:hidden h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-4 flex items-center justify-between z-30 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <FileText className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm tracking-tight text-white">ResumeSpark</span>
          </div>

          <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

          {/* Template Selector dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden sm:inline">Template:</span>
            <select
              value={model.templateId}
              onChange={(e) => saveModel({ ...model, templateId: e.target.value })}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2.5 py-1 focus:ring-1 focus:ring-emerald-500 outline-none"
            >
              {Object.values(TEMPLATE_REGISTRY).map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Mode Switch Tabs */}
          <div className="bg-slate-800/80 p-0.5 rounded-lg border border-slate-700 flex items-center text-xs">
            <button
              onClick={() => setActiveTab("editor")}
              className={`px-3 py-1 rounded-md transition-all ${activeTab === "editor" ? "bg-emerald-600 text-white font-medium" : "text-slate-400 hover:text-slate-200"
                }`}
            >
              <Edit3 className="w-3.5 h-3.5 inline mr-1" /> Editor
            </button>
            <button
              onClick={() => setActiveTab("gallery")}
              className={`px-3 py-1 rounded-md transition-all ${activeTab === "gallery" ? "bg-emerald-600 text-white font-medium" : "text-slate-400 hover:text-slate-200"
                }`}
            >
              <Layout className="w-3.5 h-3.5 inline mr-1" /> Templates
            </button>
          </div>

          <div className="h-4 w-px bg-slate-800 mx-1 hidden md:block" />

          {/* Switch to LaTeX Editor Button */}
          <Button
            size="sm"
            onClick={handleSwitchToLatex}
            className="h-8 text-xs bg-indigo-600/90 hover:bg-indigo-600 text-white gap-1.5 border border-indigo-500/40 shadow-sm"
          >
            <Code2 className="w-3.5 h-3.5 text-indigo-200" /> Switch to LaTeX
          </Button>

          {/* AI Tailor Button */}
          <Button
            size="sm"
            onClick={() => setShowAiDrawer(true)}
            className="h-8 text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white gap-1.5 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-200" /> AI Tailor
          </Button>

          {/* PDF Download Button */}
          <Button
            size="sm"
            onClick={handleDownloadPdf}
            className="h-8 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" /> Download PDF
          </Button>
        </div>
      </header>

      {/* Main Workspace Body */}
      {activeTab === "gallery" ? (
        <div className="flex-1 p-6 overflow-y-auto no-print print:hidden">
          <PdfTemplateGallery
            selectedTemplateId={model.templateId}
            onSelectTemplate={(tplId) => {
              saveModel({ ...model, templateId: tplId });
              setActiveTab("editor");
              toast.success(`Switched to ${TEMPLATE_REGISTRY[tplId]?.name || "template"}`);
            }}
          />
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden min-h-0 print:h-auto print:overflow-visible print:block print:p-0 print:m-0">
          {/* Left Panel: Structured Data Editor */}
          <div className="no-print print:hidden w-full lg:w-[480px] xl:w-[520px] border-r border-slate-800 bg-slate-900/50 flex flex-col overflow-y-auto p-4 space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Structured Resume Data</span>
                <p className="text-[11px] text-slate-500">Edit sections, customize headings, and add custom blocks.</p>
              </div>
              <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/20">
                <ShieldCheck className="w-3 h-3 mr-1 inline" /> Auto-Saved
              </Badge>
            </div>

            {/* 1. Personal Info */}
            <div className="space-y-3 bg-slate-900/80 p-3.5 rounded-lg border border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">1. Contact & Header</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <Label className="text-[11px] text-slate-400">Full Name</Label>
                  <Input
                    value={model.personalInfo.fullName}
                    onChange={(e) =>
                      saveModel({
                        ...model,
                        personalInfo: { ...model.personalInfo, fullName: e.target.value },
                      })
                    }
                    className="h-8 text-xs bg-slate-950 border-slate-800 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-400">Email</Label>
                  <Input
                    value={model.personalInfo.email}
                    onChange={(e) =>
                      saveModel({
                        ...model,
                        personalInfo: { ...model.personalInfo, email: e.target.value },
                      })
                    }
                    className="h-8 text-xs bg-slate-950 border-slate-800 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-400">Phone</Label>
                  <Input
                    value={model.personalInfo.phone}
                    onChange={(e) =>
                      saveModel({
                        ...model,
                        personalInfo: { ...model.personalInfo, phone: e.target.value },
                      })
                    }
                    className="h-8 text-xs bg-slate-950 border-slate-800 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-400">Location</Label>
                  <Input
                    value={model.personalInfo.location}
                    onChange={(e) =>
                      saveModel({
                        ...model,
                        personalInfo: { ...model.personalInfo, location: e.target.value },
                      })
                    }
                    className="h-8 text-xs bg-slate-950 border-slate-800 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-400">LinkedIn</Label>
                  <Input
                    value={model.personalInfo.linkedin}
                    onChange={(e) =>
                      saveModel({
                        ...model,
                        personalInfo: { ...model.personalInfo, linkedin: e.target.value },
                      })
                    }
                    className="h-8 text-xs bg-slate-950 border-slate-800 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-400">GitHub</Label>
                  <Input
                    value={model.personalInfo.github}
                    onChange={(e) =>
                      saveModel({
                        ...model,
                        personalInfo: { ...model.personalInfo, github: e.target.value },
                      })
                    }
                    className="h-8 text-xs bg-slate-950 border-slate-800 mt-1"
                  />
                </div>
              </div>
            </div>

            {/* 2. Professional Summary */}
            <div className="space-y-2.5 bg-slate-900/80 p-3.5 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-1">
                  <span className="text-xs font-bold text-emerald-400">2.</span>
                  <Input
                    value={model.sectionTitles?.summary || "Professional Summary"}
                    onChange={(e) =>
                      saveModel({
                        ...model,
                        sectionTitles: {
                          ...(model.sectionTitles || {
                            summary: "Professional Summary",
                            experience: "Work Experience",
                            education: "Education",
                            skills: "Skills",
                            projects: "Projects",
                            achievements: "Achievements and Activities",
                          }),
                          summary: e.target.value,
                        },
                      })
                    }
                    className="h-6 text-xs font-bold uppercase tracking-wider text-emerald-400 bg-transparent border-none p-0 focus-visible:ring-0 focus-visible:bg-slate-950/60 rounded px-1"
                    title="Click to rename section heading"
                  />
                </div>
                <Edit3 className="w-3 h-3 text-slate-500" />
              </div>
              <Textarea
                rows={3}
                value={model.summary}
                onChange={(e) => saveModel({ ...model, summary: e.target.value })}
                className="text-xs bg-slate-950 border-slate-800 leading-relaxed"
                placeholder="Brief impact summary..."
              />
            </div>

            {/* 3. Work Experience */}
            <div className="space-y-3 bg-slate-900/80 p-3.5 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-1">
                  <span className="text-xs font-bold text-emerald-400">3.</span>
                  <Input
                    value={model.sectionTitles?.experience || "Work Experience"}
                    onChange={(e) =>
                      saveModel({
                        ...model,
                        sectionTitles: {
                          ...(model.sectionTitles || {
                            summary: "Professional Summary",
                            experience: "Work Experience",
                            education: "Education",
                            skills: "Skills",
                            projects: "Projects",
                            achievements: "Achievements and Activities",
                          }),
                          experience: e.target.value,
                        },
                      })
                    }
                    className="h-6 text-xs font-bold uppercase tracking-wider text-emerald-400 bg-transparent border-none p-0 focus-visible:ring-0 focus-visible:bg-slate-950/60 rounded px-1"
                    title="Click to rename section heading"
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const nextExp = [
                      ...model.experience,
                      {
                        id: `exp-${Date.now()}`,
                        company: "Company Name",
                        role: "Software Engineer",
                        location: "City, Country",
                        startDate: "2024",
                        endDate: "Present",
                        bullets: ["Engineered scalable features using modern tech stack."],
                        technologies: [],
                      },
                    ];
                    saveModel({ ...model, experience: nextExp });
                  }}
                  className="h-6 text-[11px] text-emerald-400 hover:text-emerald-300 px-2"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Role
                </Button>
              </div>

              {model.experience.map((exp, idx) => (
                <div key={exp.id || idx} className="p-3 bg-slate-950 rounded border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{exp.company || `Role #${idx + 1}`}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        const filtered = model.experience.filter((_, i) => i !== idx);
                        saveModel({ ...model, experience: filtered });
                      }}
                      className="h-6 w-6 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Company"
                      value={exp.company}
                      onChange={(e) => {
                        const copy = [...model.experience];
                        copy[idx].company = e.target.value;
                        saveModel({ ...model, experience: copy });
                      }}
                      className="h-7 text-xs bg-slate-900 border-slate-800"
                    />
                    <Input
                      placeholder="Role"
                      value={exp.role}
                      onChange={(e) => {
                        const copy = [...model.experience];
                        copy[idx].role = e.target.value;
                        saveModel({ ...model, experience: copy });
                      }}
                      className="h-7 text-xs bg-slate-900 border-slate-800"
                    />
                    <Input
                      placeholder="Start – End Date"
                      value={`${exp.startDate}${exp.endDate ? ` – ${exp.endDate}` : ""}`}
                      onChange={(e) => {
                        const parts = e.target.value.split(/–|-/);
                        const copy = [...model.experience];
                        copy[idx].startDate = parts[0]?.trim() || "";
                        copy[idx].endDate = parts[1]?.trim() || "";
                        saveModel({ ...model, experience: copy });
                      }}
                      className="h-7 text-xs bg-slate-900 border-slate-800"
                    />
                    <Input
                      placeholder="Location"
                      value={exp.location}
                      onChange={(e) => {
                        const copy = [...model.experience];
                        copy[idx].location = e.target.value;
                        saveModel({ ...model, experience: copy });
                      }}
                      className="h-7 text-xs bg-slate-900 border-slate-800"
                    />
                  </div>

                  {/* Bullets */}
                  <div className="space-y-1.5 pt-1">
                    <Label className="text-[10px] text-slate-400">STAR Bullets ({exp.bullets.length})</Label>
                    {exp.bullets.map((bullet, bIdx) => (
                      <div key={bIdx} className="flex gap-1.5 items-start">
                        <span className="text-emerald-500 mt-1">•</span>
                        <Textarea
                          rows={2}
                          value={bullet}
                          onChange={(e) => {
                            const copy = [...model.experience];
                            copy[idx].bullets[bIdx] = e.target.value;
                            saveModel({ ...model, experience: copy });
                          }}
                          className="text-xs bg-slate-900 border-slate-800 flex-1 leading-relaxed"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            const copy = [...model.experience];
                            copy[idx].bullets.splice(bIdx, 1);
                            saveModel({ ...model, experience: copy });
                          }}
                          className="h-6 w-6 text-slate-500 hover:text-red-400 mt-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const copy = [...model.experience];
                        copy[idx].bullets.push("Built high-impact module improving performance.");
                        saveModel({ ...model, experience: copy });
                      }}
                      className="h-5 text-[10px] text-slate-400 hover:text-emerald-400 px-1"
                    >
                      + Add Bullet
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* 4. Education */}
            <div className="space-y-3 bg-slate-900/80 p-3.5 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-1">
                  <span className="text-xs font-bold text-emerald-400">4.</span>
                  <Input
                    value={model.sectionTitles?.education || "Education"}
                    onChange={(e) =>
                      saveModel({
                        ...model,
                        sectionTitles: {
                          ...(model.sectionTitles || {
                            summary: "Professional Summary",
                            experience: "Work Experience",
                            education: "Education",
                            skills: "Skills",
                            projects: "Projects",
                            achievements: "Achievements and Activities",
                          }),
                          education: e.target.value,
                        },
                      })
                    }
                    className="h-6 text-xs font-bold uppercase tracking-wider text-emerald-400 bg-transparent border-none p-0 focus-visible:ring-0 focus-visible:bg-slate-950/60 rounded px-1"
                    title="Click to rename section heading"
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const nextEdu = [
                      ...model.education,
                      {
                        id: `edu-${Date.now()}`,
                        institution: "University Name",
                        degree: "Bachelor of Science",
                        field: "Computer Science",
                        location: "City, Country",
                        startDate: "2021",
                        endDate: "2025",
                        bullets: [],
                      },
                    ];
                    saveModel({ ...model, education: nextEdu });
                  }}
                  className="h-6 text-[11px] text-emerald-400 hover:text-emerald-300 px-2"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Degree
                </Button>
              </div>

              {model.education.map((edu, idx) => (
                <div key={edu.id || idx} className="p-3 bg-slate-950 rounded border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{edu.institution || `Institution #${idx + 1}`}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        const filtered = model.education.filter((_, i) => i !== idx);
                        saveModel({ ...model, education: filtered });
                      }}
                      className="h-6 w-6 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Institution"
                      value={edu.institution}
                      onChange={(e) => {
                        const copy = [...model.education];
                        copy[idx].institution = e.target.value;
                        saveModel({ ...model, education: copy });
                      }}
                      className="h-7 text-xs bg-slate-900 border-slate-800"
                    />
                    <Input
                      placeholder="Degree / Major"
                      value={edu.degree}
                      onChange={(e) => {
                        const copy = [...model.education];
                        copy[idx].degree = e.target.value;
                        saveModel({ ...model, education: copy });
                      }}
                      className="h-7 text-xs bg-slate-900 border-slate-800"
                    />
                    <Input
                      placeholder="Field (Optional)"
                      value={edu.field || ""}
                      onChange={(e) => {
                        const copy = [...model.education];
                        copy[idx].field = e.target.value;
                        saveModel({ ...model, education: copy });
                      }}
                      className="h-7 text-xs bg-slate-900 border-slate-800"
                    />
                    <Input
                      placeholder="Dates (e.g. 2021 – 2025)"
                      value={`${edu.startDate}${edu.endDate ? ` – ${edu.endDate}` : ""}`}
                      onChange={(e) => {
                        const parts = e.target.value.split(/–|-/);
                        const copy = [...model.education];
                        copy[idx].startDate = parts[0]?.trim() || "";
                        copy[idx].endDate = parts[1]?.trim() || "";
                        saveModel({ ...model, education: copy });
                      }}
                      className="h-7 text-xs bg-slate-900 border-slate-800"
                    />
                    <Input
                      placeholder="Location"
                      value={edu.location}
                      onChange={(e) => {
                        const copy = [...model.education];
                        copy[idx].location = e.target.value;
                        saveModel({ ...model, education: copy });
                      }}
                      className="h-7 text-xs bg-slate-900 border-slate-800 col-span-2"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* 5. Skills */}
            <div className="space-y-3 bg-slate-900/80 p-3.5 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-1">
                  <span className="text-xs font-bold text-emerald-400">5.</span>
                  <Input
                    value={model.sectionTitles?.skills || "Skills"}
                    onChange={(e) =>
                      saveModel({
                        ...model,
                        sectionTitles: {
                          ...(model.sectionTitles || {
                            summary: "Professional Summary",
                            experience: "Work Experience",
                            education: "Education",
                            skills: "Skills",
                            projects: "Projects",
                            achievements: "Achievements and Activities",
                          }),
                          skills: e.target.value,
                        },
                      })
                    }
                    className="h-6 text-xs font-bold uppercase tracking-wider text-emerald-400 bg-transparent border-none p-0 focus-visible:ring-0 focus-visible:bg-slate-950/60 rounded px-1"
                    title="Click to rename section heading (e.g. Skills, Technical Skills, Core Stack)"
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const nextSkills = [
                      ...model.skills,
                      { id: `skill-${Date.now()}`, category: "Category Name", skills: ["Skill 1", "Skill 2"] },
                    ];
                    saveModel({ ...model, skills: nextSkills });
                  }}
                  className="h-6 text-[11px] text-emerald-400 hover:text-emerald-300 px-2"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Category
                </Button>
              </div>
              {model.skills.map((s, idx) => (
                <div key={s.id || idx} className="p-2.5 bg-slate-950 rounded border border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Input
                      value={s.category}
                      onChange={(e) => {
                        const copy = [...model.skills];
                        copy[idx].category = e.target.value;
                        saveModel({ ...model, skills: copy });
                      }}
                      className="h-7 text-xs bg-slate-900 border-slate-800 font-semibold w-2/5"
                    />
                    <Input
                      value={s.skills.join(", ")}
                      onChange={(e) => {
                        const copy = [...model.skills];
                        copy[idx].skills = e.target.value.split(/,\s*/).filter(Boolean);
                        saveModel({ ...model, skills: copy });
                      }}
                      className="h-7 text-xs bg-slate-900 border-slate-800 flex-1"
                      placeholder="Comma-separated skills"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        const filtered = model.skills.filter((_, i) => i !== idx);
                        saveModel({ ...model, skills: filtered });
                      }}
                      className="h-6 w-6 text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* 6. Projects */}
            <div className="space-y-3 bg-slate-900/80 p-3.5 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-1">
                  <span className="text-xs font-bold text-emerald-400">6.</span>
                  <Input
                    value={model.sectionTitles?.projects || "Projects"}
                    onChange={(e) =>
                      saveModel({
                        ...model,
                        sectionTitles: {
                          ...(model.sectionTitles || {
                            summary: "Professional Summary",
                            experience: "Work Experience",
                            education: "Education",
                            skills: "Skills",
                            projects: "Projects",
                            achievements: "Achievements and Activities",
                          }),
                          projects: e.target.value,
                        },
                      })
                    }
                    className="h-6 text-xs font-bold uppercase tracking-wider text-emerald-400 bg-transparent border-none p-0 focus-visible:ring-0 focus-visible:bg-slate-950/60 rounded px-1"
                    title="Click to rename section heading"
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const nextProjects = [
                      ...model.projects,
                      {
                        id: `proj-${Date.now()}`,
                        title: "Project Name",
                        subtitle: "Tech Stack / Scope",
                        startDate: "2025",
                        endDate: "2026",
                        link: "",
                        technologies: [],
                        bullets: ["Built high-impact application with modern frameworks."],
                      },
                    ];
                    saveModel({ ...model, projects: nextProjects });
                  }}
                  className="h-6 text-[11px] text-emerald-400 hover:text-emerald-300 px-2"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Project
                </Button>
              </div>

              {model.projects.map((proj, idx) => (
                <div key={proj.id || idx} className="p-3 bg-slate-950 rounded border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{proj.title || `Project #${idx + 1}`}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        const filtered = model.projects.filter((_, i) => i !== idx);
                        saveModel({ ...model, projects: filtered });
                      }}
                      className="h-6 w-6 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Project Title"
                      value={proj.title}
                      onChange={(e) => {
                        const copy = [...model.projects];
                        copy[idx].title = e.target.value;
                        saveModel({ ...model, projects: copy });
                      }}
                      className="h-7 text-xs bg-slate-900 border-slate-800"
                    />
                    <Input
                      placeholder="Subtitle / Role / Stack"
                      value={proj.subtitle || ""}
                      onChange={(e) => {
                        const copy = [...model.projects];
                        copy[idx].subtitle = e.target.value;
                        saveModel({ ...model, projects: copy });
                      }}
                      className="h-7 text-xs bg-slate-900 border-slate-800"
                    />
                    <Input
                      placeholder="Dates (e.g. Jan 2026 – Mar 2026)"
                      value={`${proj.startDate}${proj.endDate ? ` – ${proj.endDate}` : ""}`}
                      onChange={(e) => {
                        const parts = e.target.value.split(/–|-/);
                        const copy = [...model.projects];
                        copy[idx].startDate = parts[0]?.trim() || "";
                        copy[idx].endDate = parts[1]?.trim() || "";
                        saveModel({ ...model, projects: copy });
                      }}
                      className="h-7 text-xs bg-slate-900 border-slate-800 col-span-2"
                    />
                  </div>

                  {/* Bullets */}
                  <div className="space-y-1.5 pt-1">
                    <Label className="text-[10px] text-slate-400">Bullet Points</Label>
                    {proj.bullets.map((bullet, bIdx) => (
                      <div key={bIdx} className="flex gap-1.5 items-start">
                        <span className="text-emerald-500 mt-1">•</span>
                        <Textarea
                          rows={2}
                          value={bullet}
                          onChange={(e) => {
                            const copy = [...model.projects];
                            copy[idx].bullets[bIdx] = e.target.value;
                            saveModel({ ...model, projects: copy });
                          }}
                          className="text-xs bg-slate-900 border-slate-800 flex-1 leading-relaxed"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            const copy = [...model.projects];
                            copy[idx].bullets.splice(bIdx, 1);
                            saveModel({ ...model, projects: copy });
                          }}
                          className="h-6 w-6 text-slate-500 hover:text-red-400 mt-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const copy = [...model.projects];
                        copy[idx].bullets.push("Engineered core feature optimizing performance.");
                        saveModel({ ...model, projects: copy });
                      }}
                      className="h-5 text-[10px] text-slate-400 hover:text-emerald-400 px-1"
                    >
                      + Add Bullet
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* 7. Achievements & Activities */}
            <div className="space-y-3 bg-slate-900/80 p-3.5 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-1">
                  <span className="text-xs font-bold text-emerald-400">7.</span>
                  <Input
                    value={model.sectionTitles?.achievements || "Achievements and Activities"}
                    onChange={(e) =>
                      saveModel({
                        ...model,
                        sectionTitles: {
                          ...(model.sectionTitles || {
                            summary: "Professional Summary",
                            experience: "Work Experience",
                            education: "Education",
                            skills: "Skills",
                            projects: "Projects",
                            achievements: "Achievements and Activities",
                          }),
                          achievements: e.target.value,
                        },
                      })
                    }
                    className="h-6 text-xs font-bold uppercase tracking-wider text-emerald-400 bg-transparent border-none p-0 focus-visible:ring-0 focus-visible:bg-slate-950/60 rounded px-1"
                    title="Click to rename section heading"
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const nextAch = [
                      ...model.achievements,
                      {
                        id: `ach-${Date.now()}`,
                        title: "Achievement Title",
                        subtitle: "Details / Rank",
                        date: "2025",
                        description: "",
                        bullets: [],
                      },
                    ];
                    saveModel({ ...model, achievements: nextAch });
                  }}
                  className="h-6 text-[11px] text-emerald-400 hover:text-emerald-300 px-2"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Entry
                </Button>
              </div>

              {model.achievements.map((ach, idx) => (
                <div key={ach.id || idx} className="p-2.5 bg-slate-950 rounded border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Title"
                      value={ach.title}
                      onChange={(e) => {
                        const copy = [...model.achievements];
                        copy[idx].title = e.target.value;
                        saveModel({ ...model, achievements: copy });
                      }}
                      className="h-7 text-xs bg-slate-900 border-slate-800 flex-1 font-semibold"
                    />
                    <Input
                      placeholder="Subtitle (Optional)"
                      value={ach.subtitle || ""}
                      onChange={(e) => {
                        const copy = [...model.achievements];
                        copy[idx].subtitle = e.target.value;
                        saveModel({ ...model, achievements: copy });
                      }}
                      className="h-7 text-xs bg-slate-900 border-slate-800 w-2/5"
                    />
                    <Input
                      placeholder="Date"
                      value={ach.date}
                      onChange={(e) => {
                        const copy = [...model.achievements];
                        copy[idx].date = e.target.value;
                        saveModel({ ...model, achievements: copy });
                      }}
                      className="h-7 text-xs bg-slate-900 border-slate-800 w-24"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        const filtered = model.achievements.filter((_, i) => i !== idx);
                        saveModel({ ...model, achievements: filtered });
                      }}
                      className="h-6 w-6 text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* 8. Custom Sections */}
            {(model.customSections || []).map((sec, sIdx) => (
              <div key={sec.id || sIdx} className="space-y-3 bg-slate-900/80 p-3.5 rounded-lg border border-emerald-500/30">
                <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-xs font-bold text-emerald-400">{8 + sIdx}.</span>
                    <Input
                      value={sec.title}
                      onChange={(e) => {
                        const copy = [...(model.customSections || [])];
                        copy[sIdx].title = e.target.value;
                        saveModel({ ...model, customSections: copy });
                      }}
                      placeholder="Section Title (e.g. Certifications, Publications)"
                      className="h-6 text-xs font-bold uppercase tracking-wider text-emerald-400 bg-slate-950/60 border-slate-800 px-2"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const copy = [...(model.customSections || [])];
                        const items = copy[sIdx].items || [];
                        items.push({
                          id: `item-${Date.now()}`,
                          title: "Item Heading",
                          subtitle: "Subtitle / Organization",
                          date: "2025",
                          bullets: ["Key detail or accomplishment point."],
                        });
                        copy[sIdx].items = items;
                        saveModel({ ...model, customSections: copy });
                      }}
                      className="h-6 text-[11px] text-emerald-400 hover:text-emerald-300 px-2"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Item
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        const filtered = (model.customSections || []).filter((_, i) => i !== sIdx);
                        saveModel({ ...model, customSections: filtered });
                        toast.info(`Deleted section "${sec.title}"`);
                      }}
                      className="h-6 w-6 text-red-400 hover:text-red-300"
                      title="Delete Section"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Items within custom section */}
                {((sec.items && sec.items.length > 0) ? sec.items : []).map((item, itemIdx) => (
                  <div key={item.id || itemIdx} className="p-3 bg-slate-950 rounded border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">{item.title || `Item #${itemIdx + 1}`}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          const copy = [...(model.customSections || [])];
                          copy[sIdx].items = copy[sIdx].items.filter((_, i) => i !== itemIdx);
                          saveModel({ ...model, customSections: copy });
                        }}
                        className="h-6 w-6 text-red-400 hover:text-red-300"
                        title="Delete Item"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Title / Heading (e.g. AWS Solutions Architect)"
                        value={item.title}
                        onChange={(e) => {
                          const copy = [...(model.customSections || [])];
                          copy[sIdx].items[itemIdx].title = e.target.value;
                          saveModel({ ...model, customSections: copy });
                        }}
                        className="h-7 text-xs bg-slate-900 border-slate-800"
                      />
                      <Input
                        placeholder="Subtitle / Org (e.g. Amazon Web Services)"
                        value={item.subtitle || ""}
                        onChange={(e) => {
                          const copy = [...(model.customSections || [])];
                          copy[sIdx].items[itemIdx].subtitle = e.target.value;
                          saveModel({ ...model, customSections: copy });
                        }}
                        className="h-7 text-xs bg-slate-900 border-slate-800"
                      />
                      <Input
                        placeholder="Date (e.g. 2024 - Present)"
                        value={item.date}
                        onChange={(e) => {
                          const copy = [...(model.customSections || [])];
                          copy[sIdx].items[itemIdx].date = e.target.value;
                          saveModel({ ...model, customSections: copy });
                        }}
                        className="h-7 text-xs bg-slate-900 border-slate-800 col-span-2"
                      />
                    </div>

                    {/* Heading points / Bullets */}
                    <div className="space-y-1.5 pt-1">
                      <Label className="text-[10px] text-slate-400">Heading Points / Bullets ({(item.bullets || []).length})</Label>
                      {(item.bullets || []).map((bullet, bIdx) => (
                        <div key={bIdx} className="flex gap-1.5 items-start">
                          <span className="text-emerald-500 mt-1">•</span>
                          <Textarea
                            rows={2}
                            value={bullet}
                            onChange={(e) => {
                              const copy = [...(model.customSections || [])];
                              copy[sIdx].items[itemIdx].bullets[bIdx] = e.target.value;
                              saveModel({ ...model, customSections: copy });
                            }}
                            className="text-xs bg-slate-900 border-slate-800 flex-1 leading-relaxed"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              const copy = [...(model.customSections || [])];
                              copy[sIdx].items[itemIdx].bullets.splice(bIdx, 1);
                              saveModel({ ...model, customSections: copy });
                            }}
                            className="h-6 w-6 text-slate-500 hover:text-red-400 mt-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const copy = [...(model.customSections || [])];
                          if (!copy[sIdx].items[itemIdx].bullets) copy[sIdx].items[itemIdx].bullets = [];
                          copy[sIdx].items[itemIdx].bullets.push("Added notable contribution / detail point.");
                          saveModel({ ...model, customSections: copy });
                        }}
                        className="h-5 text-[10px] text-slate-400 hover:text-emerald-400 px-1"
                      >
                        + Add Point
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {/* Bottom Add Section Controls */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <div className="text-[11px] font-semibold text-slate-400">Add New Section to Resume:</div>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddCustomSection("Certifications & Licenses")}
                  className="h-7 text-[11px] border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300"
                >
                  <Plus className="w-3 h-3 mr-1 text-emerald-400" /> Certifications
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddCustomSection("Publications & Research")}
                  className="h-7 text-[11px] border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300"
                >
                  <Plus className="w-3 h-3 mr-1 text-emerald-400" /> Publications
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddCustomSection("Leadership & Volunteering")}
                  className="h-7 text-[11px] border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300"
                >
                  <Plus className="w-3 h-3 mr-1 text-emerald-400" /> Leadership
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddCustomSection("Custom Section")}
                  className="h-7 text-[11px] border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300"
                >
                  <Plus className="w-3 h-3 mr-1" /> + Custom Section
                </Button>
              </div>
            </div>
          </div>

          {/* Right Panel: High Fidelity Printable Canvas */}
          <div
            ref={previewPanelRef}
            className="flex-1 bg-slate-950 flex flex-col overflow-hidden relative print:overflow-visible print:bg-white print:block print:w-full"
          >
            {/* Sticky zoom toolbar - hidden on print */}
            <div className="no-print print:hidden shrink-0 flex items-center gap-2 px-4 py-2 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-sm">
              <span className="text-[11px] text-slate-500 font-medium mr-1">Zoom</span>

              <button
                onClick={() => setZoomLevel((z) => Math.max(40, z - 10))}
                title="Zoom Out (Ctrl + Scroll Down)"
                className="flex items-center justify-center w-7 h-7 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-emerald-500/40 text-slate-300 hover:text-white transition-all"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <span className="font-mono text-sm font-semibold text-slate-200 w-12 text-center tabular-nums">
                {zoomLevel}%
              </span>

              <button
                onClick={() => setZoomLevel((z) => Math.min(200, z + 10))}
                title="Zoom In (Ctrl + Scroll Up)"
                className="flex items-center justify-center w-7 h-7 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-emerald-500/40 text-slate-300 hover:text-white transition-all"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setZoomLevel(100)}
                title="Reset Zoom"
                className="flex items-center justify-center w-7 h-7 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-all"
              >
                <RotateCcw className="w-3 h-3" />
              </button>

              <div className="h-4 w-px bg-slate-800 mx-1" />

              {/* View Switcher: Live HTML vs Exact Compiled PDF */}
              <div className="flex items-center bg-slate-800/90 p-0.5 rounded-md border border-slate-700 text-xs">
                <button
                  onClick={() => setPreviewMode("html")}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-all ${previewMode === "html"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                    }`}
                  title="Interactive pure HTML/CSS live preview"
                >
                  HTML Live
                </button>
                <button
                  onClick={() => {
                    if (!pdfArrayBuffer) {
                      void handleCompileLatexPdf();
                    } else {
                      setPreviewMode("compiled");
                    }
                  }}
                  disabled={isCompilingPdf}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-all ${previewMode === "compiled"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                    }`}
                  title="Exact compiled vector PDF from LaTeX engine"
                >
                  {isCompilingPdf ? (
                    <RefreshCw className="w-3 h-3 inline mr-1 animate-spin" />
                  ) : (
                    <FileText className="w-3 h-3 inline mr-1 text-emerald-400" />
                  )}
                  Compiled PDF
                </button>
              </div>

              {/* Dedicated Recompile button in preview toolbar */}
              <button
                onClick={() => void handleCompileLatexPdf()}
                disabled={isCompilingPdf}
                title="Recompile LaTeX template to fresh vector PDF"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/90 border border-slate-700 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 text-[11px] font-medium transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 text-emerald-400 ${isCompilingPdf ? "animate-spin" : ""}`} />
                <span>{isCompilingPdf ? "Compiling..." : "Recompile"}</span>
              </button>

              <span className="text-[10px] text-slate-600 hidden xl:inline">
                Ctrl + Scroll to zoom
              </span>

              <div className="flex-1" />

              <button
                onClick={handlePrintPdf}
                className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-emerald-400 transition-colors px-2 py-1 rounded hover:bg-slate-800"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            </div>

            {/* Scrollable canvas area */}
            <div className="flex-1 overflow-auto p-6 flex justify-center items-start print:overflow-visible print:p-0 print:m-0 print:block">
              {previewMode === "compiled" && pdfArrayBuffer ? (
                <div className="w-full h-full flex justify-center items-start overflow-auto print:hidden">
                  <PdfCanvasViewer
                    pdfData={pdfArrayBuffer}
                    zoom={zoomLevel}
                    onZoomChange={(z) => setZoomLevel(Math.min(200, Math.max(40, z)))}
                    synctexMapping={null}
                    lineOffset={0}
                    highlightRect={null}
                    onPdfClick={() => { }}
                    onHighlightFade={() => { }}
                  />
                </div>
              ) : (
                <div
                  ref={previewContainerRef}
                  style={{
                    transform: `scale(${zoomLevel / 100})`,
                    transformOrigin: "top center",
                    // Preserve layout space so the parent scrollbar works correctly
                    marginBottom: `${(zoomLevel / 100 - 1) * 100}%`,
                  }}
                  className="shadow-2xl rounded-sm transition-transform duration-100 print:shadow-none print:transform-none print:m-0 print:p-0"
                  dangerouslySetInnerHTML={{ __html: renderedHtml }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Tailoring Drawer / Modal */}
      {showAiDrawer && (
        <div className="no-print print:hidden fixed inset-y-0 right-0 w-full sm:w-[480px] bg-slate-900 border-l border-slate-800 shadow-2xl z-40 p-5 flex flex-col justify-between overflow-y-auto space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">AI Resume Tailoring</h3>
                  <p className="text-[11px] text-slate-400">Target role analysis &amp; guardrail tailoring</p>
                </div>
              </div>
              <button
                onClick={() => setShowAiDrawer(false)}
                className="text-slate-400 hover:text-white text-xs p-1 rounded hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">AI Provider</Label>
              <select
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value as LlmProvider)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg text-xs px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="gemini">Google Gemini 2.5</option>
                <option value="groq">Groq (Llama 3.3 70B Fast)</option>
                <option value="claude">Anthropic Claude Sonnet</option>
              </select>
            </div>



            {/* Unified JdInputPanel with JD form, ATS score, and Project Analysis with JD Prioritization */}
            <JdInputPanel
              companyName={companyName}
              role={role}
              jd={jobDescription}
              onCompanyNameChange={handleCompanyNameChange}
              onRoleChange={handleRoleChange}
              onJdChange={setJobDescription}
              project={projectDraft}
              projects={projectDrafts}
              onProjectChange={setProjectDraft}
              onProjectsChange={setProjectDrafts}
              onDeleteProject={(idx) => setProjectDrafts((ps) => ps.filter((_, i) => i !== idx))}
              onInsertProject={handleInsertAllProjectsToModel}
              onInsertSingleProject={handleInsertSingleProjectToModel}
              onAtsScore={runJobMatch}
              onAiTailor={handleGenerateAiSuggestions}
              isAiTailorLoading={isAiLoading}
              rankedProjects={rankedProjects}
              onRankedProjectsChange={setRankedProjects}
              llmProvider={llmProvider}
              insertLabel="INSERT TO RESUME"
              hideHeader={true}
            />

            {/* Project Ranking results from Call #1 */}
            {rankedProjects.length > 0 && (
              <div className="pt-2">
                <ProjectRankingPanel rankedProjects={rankedProjects} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Side-by-Side Diff Modal */}
      <PdfSuggestionDiffModal
        isOpen={isDiffModalOpen}
        suggestions={suggestions}
        rankedProjects={rankedProjects}
        onClose={() => setIsDiffModalOpen(false)}
        onApplySuggestion={handleApplySuggestion}
        onApplyAll={handleApplyAllSuggestions}
      />

      {/* ATS Score & Job Matching Modal */}
      <JobMatchModal
        isOpen={jobMatchOpen}
        result={jobMatchResult}
        sections={documentModelToSections(model)}
        latexCode={generateLatexFromDocumentModel(model, model.templateId)}
        jd={jobDescription}
        companyRole={targetCompanyRole}
        isAnalyzing={isJobMatchAnalyzing}
        onClose={() => setJobMatchOpen(false)}
        onReanalyze={runJobMatch}
      />
    </div>
  );
}
