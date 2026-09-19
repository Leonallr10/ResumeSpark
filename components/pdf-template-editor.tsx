"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
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
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  ExternalLink,
  Save,
  ArrowRight,
  Eye,
  Edit3,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import {
  type ResumeDocumentModel,
  createSampleResumeTemplate1,
  createEmptyResumeDocument,
} from "@/server/documents/resume-document-model";
import { parseLatexToDocumentModel } from "@/server/documents/from-latex";
import { generateLatexFromDocumentModel } from "@/server/documents/to-latex";
import { documentModelToSections, applySuggestionToDocumentModel } from "@/server/documents/from-template";
import { TEMPLATE_REGISTRY, getTemplateRenderer } from "@/lib/templates/registry";
import { PdfTemplateGallery } from "./pdf-template-gallery";
import { PdfSuggestionDiffModal } from "./pdf-suggestion-diff-modal";
import type { AiSuggestion, SuggestionResponse, LlmProvider } from "@/types/resume";

const PDF_STORAGE_KEY = "resume_pdf_document_model_v1";
const LATEX_STORAGE_KEY = "resume_latex_source_v1";
const ACTIVE_FLOW_KEY = "resume_active_flow";

export function PdfTemplateEditor() {
  const router = useRouter();

  // State
  const [model, setModel] = useState<ResumeDocumentModel>(createSampleResumeTemplate1);
  const [activeTab, setActiveTab] = useState<"editor" | "gallery">("editor");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showAiDrawer, setShowAiDrawer] = useState(false);
  const [targetCompanyRole, setTargetCompanyRole] = useState("Software Engineer / AI Engineer");
  const [jobDescription, setJobDescription] = useState("");
  const [extraProject, setExtraProject] = useState("");
  const [llmProvider, setLlmProvider] = useState<LlmProvider>("gemini");
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);

  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Load initial model from localStorage
  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_FLOW_KEY, "pdf");
      const savedPdf = localStorage.getItem(PDF_STORAGE_KEY);
      if (savedPdf) {
        setModel(JSON.parse(savedPdf));
      } else {
        const savedLatex = localStorage.getItem(LATEX_STORAGE_KEY);
        if (savedLatex) {
          const parsed = parseLatexToDocumentModel(savedLatex);
          setModel(parsed);
        }
      }
    } catch {
      // fallback to initial
    }
  }, []);

  // Save to localStorage whenever model updates
  const saveModel = useCallback((nextModel: ResumeDocumentModel) => {
    setModel(nextModel);
    try {
      localStorage.setItem(PDF_STORAGE_KEY, JSON.stringify(nextModel));
      // Keep LaTeX model in sync for cross-flow switching
      const generatedLatex = generateLatexFromDocumentModel(nextModel);
      localStorage.setItem(LATEX_STORAGE_KEY, generatedLatex);
    } catch {
      // storage error
    }
  }, []);

  // Cross-Flow Transition to LaTeX Editor
  const handleSwitchToLatex = () => {
    try {
      const generatedLatex = generateLatexFromDocumentModel(model);
      localStorage.setItem(LATEX_STORAGE_KEY, generatedLatex);
      localStorage.setItem(ACTIVE_FLOW_KEY, "latex");
      toast.success("Synchronized data model with LaTeX editor.");
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
      const res = await fetch("/api/resume/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeSections: sections,
          companyRole: targetCompanyRole,
          jd: jobDescription,
          project: extraProject,
          provider: llmProvider,
        }),
      });

      const data: SuggestionResponse = await res.json();
      if (!res.ok) {
        throw new Error((data as unknown as { error?: string })?.error || "Failed to generate suggestions.");
      }

      setSuggestions(data.suggestions || []);
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
    window.print();
  };

  // 1-Click Client PDF Download via html2pdf
  const handleDownloadPdf = async () => {
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
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
      };

      await html2pdf().set(opt).from(element).save();
      toast.success("PDF Downloaded!", { id: toastId });
    } catch (err) {
      toast.error("Download failed. Opening system print dialog instead.", { id: toastId });
      window.print();
    }
  };

  // Template HTML Render
  const renderedHtml = getTemplateRenderer(model.templateId)(model);

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <Toaster position="top-right" richColors />

      {/* Top Header */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-4 flex items-center justify-between z-30 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <FileText className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm tracking-tight text-white">ResumeSpark</span>
          </div>

          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[11px]">
            PDF Template Flow
          </Badge>

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
              className={`px-3 py-1 rounded-md transition-all ${
                activeTab === "editor" ? "bg-emerald-600 text-white font-medium" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5 inline mr-1" /> Editor
            </button>
            <button
              onClick={() => setActiveTab("gallery")}
              className={`px-3 py-1 rounded-md transition-all ${
                activeTab === "gallery" ? "bg-emerald-600 text-white font-medium" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layout className="w-3.5 h-3.5 inline mr-1" /> Templates
            </button>
          </div>

          {/* AI Tailor Button */}
          <Button
            size="sm"
            onClick={() => setShowAiDrawer(!showAiDrawer)}
            className="h-8 text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white gap-1.5 shadow-sm shadow-emerald-500/20"
          >
            <Sparkles className="w-3.5 h-3.5" /> AI Tailor from JD
          </Button>

          {/* Switch to LaTeX */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleSwitchToLatex}
            className="h-8 text-xs border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white gap-1.5 hidden md:flex"
            title="Convert and open in CodeMirror LaTeX editor with SyncTeX"
          >
            <Code2 className="w-3.5 h-3.5 text-emerald-400" /> Switch to LaTeX
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
        <div className="flex-1 p-6 overflow-y-auto">
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
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Structured Data Editor */}
          <div className="w-full lg:w-[460px] xl:w-[500px] border-r border-slate-800 bg-slate-900/50 flex flex-col h-[calc(100vh-3.5rem)] overflow-y-auto p-4 space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Structured Resume Data</span>
              <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/20">
                <ShieldCheck className="w-3 h-3 mr-1 inline" /> Auto-Saved
              </Badge>
            </div>

            {/* Personal Info */}
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

            {/* Summary */}
            <div className="space-y-2 bg-slate-900/80 p-3.5 rounded-lg border border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">2. Professional Summary</h4>
              <Textarea
                rows={3}
                value={model.summary}
                onChange={(e) => saveModel({ ...model, summary: e.target.value })}
                className="text-xs bg-slate-950 border-slate-800"
                placeholder="Brief impact summary..."
              />
            </div>

            {/* Experience List */}
            <div className="space-y-3 bg-slate-900/80 p-3.5 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">3. Work Experience</h4>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const nextExp = [
                      ...model.experience,
                      {
                        id: `exp-${Date.now()}`,
                        company: "New Company",
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
                      placeholder="Dates"
                      value={`${exp.startDate} – ${exp.endDate}`}
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

            {/* Skills */}
            <div className="space-y-3 bg-slate-900/80 p-3.5 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">4. Skills Categories</h4>
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
          </div>

          {/* Right Panel: High Fidelity Printable Canvas */}
          <div className="flex-1 bg-slate-950 flex flex-col items-center justify-start overflow-y-auto p-6 relative">
            {/* Zoom & Canvas controls */}
            <div className="mb-4 flex items-center gap-3 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-400">
              <span>Zoom:</span>
              <button
                onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
                className="hover:text-white px-1.5 py-0.5 rounded bg-slate-800"
              >
                -
              </button>
              <span className="font-mono text-slate-200">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
                className="hover:text-white px-1.5 py-0.5 rounded bg-slate-800"
              >
                +
              </button>
              <div className="h-3 w-px bg-slate-800 mx-1" />
              <button
                onClick={handlePrintPdf}
                className="hover:text-emerald-400 flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            </div>

            {/* Template Container Canvas */}
            <div
              ref={previewContainerRef}
              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top center" }}
              className="shadow-2xl rounded-sm transition-transform duration-150"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          </div>
        </div>
      )}

      {/* AI Tailoring Drawer / Modal */}
      {showAiDrawer && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[440px] bg-slate-900 border-l border-slate-800 shadow-2xl z-40 p-5 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-emerald-500/20 text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-white">AI Resume Tailoring</h3>
              </div>
              <button onClick={() => setShowAiDrawer(false)} className="text-slate-400 hover:text-white text-xs">
                ✕
              </button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Target Role & Company</Label>
              <Input
                value={targetCompanyRole}
                onChange={(e) => setTargetCompanyRole(e.target.value)}
                className="h-8 text-xs bg-slate-950 border-slate-800"
                placeholder="e.g. Senior Backend Engineer at Stripe"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Paste Job Description (JD)</Label>
              <Textarea
                rows={7}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="text-xs bg-slate-950 border-slate-800 leading-relaxed font-mono"
                placeholder="Paste requirements, tech stack, and responsibilities..."
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Extra Project / Achievements (Optional)</Label>
              <Textarea
                rows={3}
                value={extraProject}
                onChange={(e) => setExtraProject(e.target.value)}
                className="text-xs bg-slate-950 border-slate-800 font-mono"
                placeholder="Project title, stack, and results to insert if relevant..."
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">AI Provider</Label>
              <select
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value as LlmProvider)}
                className="w-full bg-slate-950 border border-slate-800 rounded text-xs px-2.5 py-1.5 text-slate-200"
              >
                <option value="gemini">Google Gemini 2.5</option>
                <option value="groq">Groq (Llama 3.3 70B Fast)</option>
                <option value="claude">Anthropic Claude Sonnet</option>
              </select>
            </div>

            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[11px] text-emerald-400 space-y-1">
              <div className="font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Guardrails Enabled
              </div>
              <p className="text-slate-400">
                Input sanitization, injection rejection, and hallucination fact-checking are strictly enforced.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <Button
              disabled={isAiLoading}
              onClick={handleGenerateAiSuggestions}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-9 gap-2"
            >
              {isAiLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Tailoring with Guardrails...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Generate STAR Suggestions
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Side-by-Side Diff Modal */}
      <PdfSuggestionDiffModal
        isOpen={isDiffModalOpen}
        suggestions={suggestions}
        onClose={() => setIsDiffModalOpen(false)}
        onApplySuggestion={handleApplySuggestion}
        onApplyAll={handleApplyAllSuggestions}
      />
    </div>
  );
}
