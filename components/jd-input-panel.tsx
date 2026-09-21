"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Brain, ChevronDown, ChevronLeft, ChevronRight, Info,
  Loader2, Plus, SortDesc, Sparkles, Target, Trash2,
  Building2, Briefcase, FileText, CheckCircle2, Layers,
  Lock, ArrowRight, Zap, Check, X, ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  canInsertProject,
  type ProjectDraft,
  hasProjectDraftContent,
} from "@/lib/latex-resume";
import { emptyProjectDraft } from "@/components/latex-project-fields";
import type { LlmProvider } from "@/types/resume";
import type { ProjectRankingItem } from "@/lib/schemas";

// ─── Types ───────────────────────────────────────────────────────────────────

export type JdPanelProps = {
  // JD fields
  companyName: string;
  role: string;
  jd: string;
  onCompanyNameChange: (v: string) => void;
  onRoleChange: (v: string) => void;
  onJdChange: (v: string) => void;

  // Project drafts
  project: ProjectDraft;
  projects: ProjectDraft[];
  onProjectChange: (p: ProjectDraft) => void;
  onProjectsChange: (ps: ProjectDraft[]) => void;
  onSaveProjects?: (ps: ProjectDraft[]) => void;
  onDeleteProject: (i: number) => void;
  onInsertProject: () => void;
  onInsertSingleProject: (i: number) => void;

  // Actions
  onAtsScore: () => void;
  onAiTailor: () => void;
  isAiTailorLoading: boolean;

  // Ranked projects state
  rankedProjects?: ProjectRankingItem[];
  onRankedProjectsChange?: (ranked: ProjectRankingItem[]) => void;

  // LLM settings (for prioritize call)
  llmProvider: LlmProvider;
  llmModel?: string;
  apiKey?: string;

  // Visual mode
  insertLabel?: string;
  hideHeader?: boolean;
};

type ProjectInputMode = "form" | "json";

// ─── Score colour helper ──────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 75) return { bar: "bg-emerald-500", text: "text-emerald-400", badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };
  if (score >= 45) return { bar: "bg-amber-400", text: "text-amber-400", badge: "bg-amber-400/15 text-amber-300 border-amber-400/30" };
  return { bar: "bg-rose-500", text: "text-rose-400", badge: "bg-rose-500/15 text-rose-300 border-rose-500/30" };
}

// ─── Project Analysis Panel (View 2) ──────────────────────────────────────────

interface ProjectAnalysisPanelProps {
  project: ProjectDraft;
  projects: ProjectDraft[];
  jd: string;
  llmProvider: LlmProvider;
  llmModel?: string;
  apiKey?: string;
  onProjectChange: (p: ProjectDraft) => void;
  onProjectsChange: (ps: ProjectDraft[]) => void;
  onDeleteProject: (i: number) => void;
  onInsertProject: () => void;
  onInsertSingleProject: (i: number) => void;
  onBack: () => void;
  rankedProjects?: ProjectRankingItem[];
  onRankedProjectsChange?: (ranked: ProjectRankingItem[]) => void;
  insertLabel?: string;
}

function ProjectAnalysisPanel({
  project,
  projects,
  jd,
  llmProvider,
  llmModel,
  apiKey,
  onProjectChange,
  onProjectsChange,
  onDeleteProject,
  onInsertProject,
  onInsertSingleProject,
  onBack,
  rankedProjects = [],
  onRankedProjectsChange,
  insertLabel,
}: ProjectAnalysisPanelProps) {
  const [inputMode, setInputMode] = useState<ProjectInputMode>("form");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPrioritizing, setIsPrioritizing] = useState(false);
  const [localRanked, setLocalRanked] = useState<ProjectRankingItem[]>(rankedProjects);
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const [jsonValue, setJsonValue] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const activeProjects = useMemo(
    () => (projects.length > 0 ? projects : hasProjectDraftContent(project) ? [project] : [emptyProjectDraft]),
    [projects, project],
  );

  useEffect(() => {
    setSelectedIndex((curr) => Math.min(curr, Math.max(activeProjects.length - 1, 0)));
  }, [activeProjects.length]);

  useEffect(() => {
    if (rankedProjects.length > 0) {
      setLocalRanked(rankedProjects);
    }
  }, [rankedProjects]);

  const selectedProject = activeProjects[selectedIndex] ?? emptyProjectDraft;

  // ── Prioritize projects by JD relevance ─────────────────────────────────────
  const handlePrioritize = useCallback(async () => {
    if (!jd.trim()) {
      toast.error("Please enter a Job Description first to prioritize projects.", { id: "prioritize-toast" });
      return;
    }

    const validProjects = activeProjects.filter(hasProjectDraftContent);
    if (validProjects.length === 0) {
      toast.error("Please fill in at least one project before prioritizing.", { id: "prioritize-toast" });
      return;
    }

    setIsPrioritizing(true);
    try {
      const lightweightProjects = activeProjects.map((p, idx) => ({
        projectId: p.heading.trim() || `Project ${idx + 1}`,
        title: p.heading.trim() || `Project ${idx + 1}`,
        techStack: p.techStack,
        summary: p.explanation.split(/[.\n]/)[0]?.trim() || p.explanation.slice(0, 100),
      }));

      const res = await fetch("/api/resume/rank-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jd,
          projects: lightweightProjects,
          provider: llmProvider,
          model: llmModel,
          apiKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to prioritize projects.");

      const rankedItems: ProjectRankingItem[] = data.rankedProjects ?? [];
      setLocalRanked(rankedItems);
      onRankedProjectsChange?.(rankedItems);

      // Re-order project list descending by score
      if (rankedItems.length > 0 && activeProjects.length > 0) {
        const scoreMap = new Map(rankedItems.map((r) => [r.projectId.toLowerCase().trim(), r.relevanceScore]));
        const sorted = [...activeProjects].sort((a, b) => {
          const aKey = (a.heading.trim() || "").toLowerCase();
          const bKey = (b.heading.trim() || "").toLowerCase();
          const scoreA = scoreMap.get(aKey) ?? 0;
          const scoreB = scoreMap.get(bKey) ?? 0;
          return scoreB - scoreA;
        });
        onProjectsChange(sorted);
        setSelectedIndex(0);
      }

      toast.success("Projects prioritized by JD relevance!", { id: "prioritize-toast" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to prioritize projects.", { id: "prioritize-toast" });
    } finally {
      setIsPrioritizing(false);
    }
  }, [jd, activeProjects, llmProvider, llmModel, apiKey, onProjectsChange, onRankedProjectsChange]);

  // ── Form handlers ──────────────────────────────────────────────────────────
  function updateField(field: keyof ProjectDraft, value: string) {
    const next = { ...selectedProject, [field]: value };
    if (projects.length > 0) {
      const updated = [...projects];
      updated[selectedIndex] = next;
      onProjectsChange(updated);
    } else {
      onProjectChange(next);
    }
  }

  function addProject() {
    const next = [...activeProjects, emptyProjectDraft];
    onProjectsChange(next);
    setSelectedIndex(next.length - 1);
    setInputMode("form");
    toast.success("New project draft added!", { id: "project-draft-toast" });
  }

  function deleteCurrentProject() {
    if (activeProjects.length <= 1) {
      onProjectChange(emptyProjectDraft);
      onProjectsChange([]);
      setLocalRanked([]);
      toast.success("Project cleared.", { id: "project-draft-toast" });
      return;
    }
    onDeleteProject(selectedIndex);
    setSelectedIndex(Math.max(0, selectedIndex - 1));
    toast.success("Project deleted.", { id: "project-draft-toast" });
  }

  // ── JSON handlers ──────────────────────────────────────────────────────────
  function switchMode(mode: ProjectInputMode) {
    setInputMode(mode);
    setJsonError(null);
    if (mode === "json") {
      const visible = activeProjects.filter(hasProjectDraftContent);
      setJsonValue(
        JSON.stringify(
          visible.length > 1 ? { projects: visible } : visible[0] ?? emptyProjectDraft,
          null,
          2,
        ),
      );
    }
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(jsonValue);
      let list: ProjectDraft[] = [];
      if (Array.isArray(parsed)) {
        list = parsed;
      } else if (parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).projects)) {
        list = (parsed as { projects: ProjectDraft[] }).projects;
      } else if (parsed && typeof parsed === "object") {
        list = [parsed as ProjectDraft];
      }
      if (list.length === 0) {
        setJsonError("No valid project objects found in JSON.");
        return;
      }
      onProjectsChange(list);
      setSelectedIndex(0);
      setJsonError(null);
      toast.success("Projects JSON applied!", { id: "project-json-toast" });
    } catch {
      setJsonError("Invalid JSON syntax.");
    }
  }

  const getRankedInfo = (heading: string): ProjectRankingItem | undefined => {
    const key = heading.trim().toLowerCase();
    return localRanked.find((r) => r.projectId.trim().toLowerCase() === key);
  };

  const insertCount = activeProjects.filter(canInsertProject).length;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-4 text-slate-100"
    >
      {/* Top Header: Back button + Title + Prioritize Button */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onBack}
          className="h-8 gap-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700 px-3 rounded-lg text-xs font-semibold shadow-sm transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to JD
        </Button>

        {/* Prioritize as per JD Button */}
        <Button
          type="button"
          size="sm"
          disabled={isPrioritizing || !jd.trim()}
          onClick={handlePrioritize}
          title={!jd.trim() ? "Add a Job Description first to prioritize" : "Rank and sort projects by relevance to JD"}
          className="h-8 gap-1.5 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold px-3 rounded-lg shadow-md shadow-violet-950/40 border border-violet-400/30 transition-all active:scale-95 disabled:opacity-50"
        >
          {isPrioritizing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <SortDesc className="w-3.5 h-3.5" />
          )}
          Prioritize by JD
        </Button>
      </div>

      {/* Subheader: Project Input Title & Mode Switcher */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            Project Drafts
          </h4>
          <p className="text-[11px] text-slate-400 leading-tight">
            Add or edit projects, then insert into your resume.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="grid grid-cols-2 rounded-lg border border-slate-750 bg-slate-950 p-0.5 shadow-inner"
            role="tablist"
          >
            <button
              type="button"
              className={`px-2.5 py-1 text-[10px] font-bold rounded transition-all ${inputMode === "form"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
                }`}
              onClick={() => switchMode("form")}
            >
              FORM
            </button>
            <button
              type="button"
              className={`px-2.5 py-1 text-[10px] font-bold rounded transition-all ${inputMode === "json"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
                }`}
              onClick={() => switchMode("json")}
            >
              JSON
            </button>
          </div>
        </div>
      </div>

      {/* Ranked Summary Cards (if prioritized) */}
      <AnimatePresence>
        {localRanked.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-violet-500/30 bg-slate-950/90 p-3 space-y-2 overflow-hidden shadow-lg shadow-violet-950/20"
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-violet-400" /> JD Relevance Ranking
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                Sorted by priority
              </span>
            </div>

            <div className="space-y-1.5">
              {localRanked.map((item, idx) => {
                const c = scoreColor(item.relevanceScore);
                const isSelected =
                  activeProjects[selectedIndex]?.heading.trim().toLowerCase() ===
                  item.projectId.trim().toLowerCase();

                return (
                  <div
                    key={item.projectId}
                    className={`relative flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 border transition-all cursor-pointer ${isSelected
                        ? "bg-violet-950/40 border-violet-500/50 shadow-sm"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                      }`}
                    onClick={() => {
                      const foundIdx = activeProjects.findIndex(
                        (p) => p.heading.trim().toLowerCase() === item.projectId.trim().toLowerCase(),
                      );
                      if (foundIdx !== -1) setSelectedIndex(foundIdx);
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-extrabold text-violet-400 w-4">
                        #{idx + 1}
                      </span>
                      <span className="text-xs font-medium text-white truncate">
                        {item.projectId}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Score Badge */}
                      <Badge variant="outline" className={`text-[9px] font-bold px-1.5 py-0 border ${c.badge}`}>
                        {item.relevanceScore}%
                      </Badge>

                      {/* Info Icon with Popover / Tooltip */}
                      <div className="relative">
                        <button
                          type="button"
                          onMouseEnter={() => setHoveredProjectId(item.projectId)}
                          onMouseLeave={() => setHoveredProjectId(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setHoveredProjectId(hoveredProjectId === item.projectId ? null : item.projectId);
                          }}
                          className="p-1 text-slate-400 hover:text-violet-300 rounded hover:bg-violet-500/20 transition-colors"
                          aria-label="Why prioritized?"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>

                        <AnimatePresence>
                          {hoveredProjectId === item.projectId && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: 5 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: 5 }}
                              transition={{ duration: 0.15 }}
                              className="absolute right-0 top-7 z-50 w-64 rounded-xl border border-violet-500/40 bg-slate-950 p-3 shadow-2xl shadow-black"
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-bold text-violet-300">
                                  Priority #{idx + 1} Rationale
                                </span>
                                <span className={`text-[10px] font-bold ${c.text}`}>
                                  {item.relevanceScore}% Match
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-300 leading-relaxed mb-2">
                                {item.reason || "Matches target role requirements and core skills in the job description."}
                              </p>
                              {item.matchedSkills && item.matchedSkills.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {item.matchedSkills.map((sk: string) => (
                                    <span
                                      key={sk}
                                      className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30"
                                    >
                                      {sk}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Form or JSON Mode */}
      {inputMode === "form" ? (
        <div className="space-y-3">
          {/* Project Carousel / Selector */}
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-950/70 border border-slate-800">
            {activeProjects.length > 1 ? (
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setSelectedIndex((i) => Math.max(0, i - 1))}
                  disabled={selectedIndex === 0}
                  className="h-7 w-7 shrink-0 bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <div className="relative flex-1 min-w-0">
                  <select
                    value={selectedIndex}
                    onChange={(e) => setSelectedIndex(Number(e.target.value))}
                    className="h-7 w-full appearance-none rounded-md border border-slate-700 bg-slate-900 pl-2 pr-7 text-[11px] font-medium text-white focus:border-emerald-500 focus:outline-none transition-all truncate"
                  >
                    {activeProjects.map((p, idx) => {
                      const ri = getRankedInfo(p.heading);
                      return (
                        <option key={idx} value={idx}>
                          {ri ? `#${idx + 1} (${ri.relevanceScore}%) ` : ""}
                          {p.heading.trim() || `Project ${idx + 1}`}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setSelectedIndex((i) => Math.min(activeProjects.length - 1, i + 1))}
                  disabled={selectedIndex >= activeProjects.length - 1}
                  className="h-7 w-7 shrink-0 bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <span className="shrink-0 text-[10px] font-semibold text-emerald-400 tabular-nums bg-slate-900 px-2 py-1 rounded border border-slate-750">
                  {selectedIndex + 1}/{activeProjects.length}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0 flex-1 pl-1">
                <p className="text-[11px] font-medium text-emerald-300 italic truncate">
                  Editing: {selectedProject.heading.trim() || "Project 1"}
                </p>
                {(() => {
                  const ri = getRankedInfo(selectedProject.heading);
                  return ri ? (
                    <Badge variant="outline" className={`text-[9px] font-bold px-1.5 py-0 border ${scoreColor(ri.relevanceScore).badge}`}>
                      {ri.relevanceScore}% Match
                    </Badge>
                  ) : null;
                })()}
              </div>
            )}

            <Button
              type="button"
              size="sm"
              onClick={addProject}
              className="h-7 gap-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-[10px] font-bold px-2.5 rounded-lg shrink-0 shadow-sm"
            >
              <Plus className="h-3 w-3" />
              NEW
            </Button>
          </div>

          {/* Form Fields */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-slate-300">Project Heading / Title</Label>
              <Input
                value={selectedProject.heading}
                onChange={(e) => updateField("heading", e.target.value)}
                placeholder="e.g. AI Resume Tailor & ATS Engine"
                className="h-9 bg-slate-950/80 border-slate-750 text-white placeholder:text-slate-600 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 rounded-xl text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-slate-300">Explanation & Achievements (Bullet Points)</Label>
              <Textarea
                value={selectedProject.explanation}
                onChange={(e) => updateField("explanation", e.target.value)}
                placeholder="Paste bullet points, metrics, and achievements..."
                className="min-h-[120px] max-h-[200px] bg-slate-950/80 border-slate-750 text-white placeholder:text-slate-600 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 rounded-xl text-xs leading-relaxed resize-y p-2.5"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-slate-300">Tech Stack (comma separated)</Label>
              <Input
                value={selectedProject.techStack}
                onChange={(e) => updateField("techStack", e.target.value)}
                placeholder="e.g. React, Next.js, TypeScript, Tailwind, Node.js"
                className="h-9 bg-slate-950/80 border-slate-750 text-white placeholder:text-slate-600 focus-visible:ring-emerald-500 rounded-xl text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-slate-300">Project Link (Optional)</Label>
              <Input
                value={selectedProject.link}
                onChange={(e) => updateField("link", e.target.value)}
                placeholder="e.g. https://github.com/user/project"
                className="h-9 bg-slate-950/80 border-slate-750 text-white placeholder:text-slate-600 focus-visible:ring-emerald-500 rounded-xl text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-slate-300">From Date</Label>
                <Input
                  value={selectedProject.fromDate}
                  onChange={(e) => updateField("fromDate", e.target.value)}
                  placeholder="e.g. Jan 2025"
                  className="h-9 bg-slate-950/80 border-slate-750 text-white placeholder:text-slate-600 focus-visible:ring-emerald-500 rounded-xl text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-slate-300">To Date</Label>
                <Input
                  value={selectedProject.toDate}
                  onChange={(e) => updateField("toDate", e.target.value)}
                  placeholder="e.g. Present"
                  className="h-9 bg-slate-950/80 border-slate-750 text-white placeholder:text-slate-600 focus-visible:ring-emerald-500 rounded-xl text-xs"
                />
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between gap-3 pt-4 mt-1 border-t border-slate-800/90">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={deleteCurrentProject}
              className="h-9 px-3.5 gap-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/60 border-rose-900/60 bg-slate-950/80 rounded-xl transition-all shadow-sm"
              title="Delete project"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
            <div className="flex items-center gap-2.5">
              {activeProjects.length > 1 && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onInsertSingleProject(selectedIndex)}
                  disabled={!canInsertProject(selectedProject)}
                  className="h-9 px-3.5 gap-1.5 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-semibold rounded-xl transition-all shadow-sm disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Insert Single
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={onInsertProject}
                disabled={insertCount === 0}
                className="h-9 px-4 gap-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-950/40 border border-emerald-400/30 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {insertLabel || (insertCount > 1 ? `INSERT ${insertCount} PROJECTS` : "INSERT PROJECT")}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* JSON Mode View */
        <div className="space-y-3">
          <Textarea
            value={jsonValue}
            onChange={(e) => {
              setJsonValue(e.target.value);
              setJsonError(null);
            }}
            placeholder={`{\n  "projects": [\n    {\n      "heading": "AI Resume Tailor",\n      "explanation": "Built multi-agent resume optimizer",\n      "techStack": "Next.js, TypeScript, LLM",\n      "link": "https://github.com/...",\n      "fromDate": "Jan 2026",\n      "toDate": "Apr 2026"\n    }\n  ]\n}`}
            className="min-h-[220px] font-mono text-xs leading-relaxed bg-slate-950/80 border-slate-750 text-emerald-400 placeholder:text-slate-600 rounded-xl p-3 focus:border-emerald-500 shadow-inner"
          />
          {jsonError && (
            <p className="text-xs text-rose-400 font-semibold">{jsonError}</p>
          )}
          <div className="flex justify-end pt-2 border-t border-slate-800/80">
            <Button
              type="button"
              size="sm"
              onClick={applyJson}
              className="h-9 px-5 gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md shadow-emerald-950/30 transition-all active:scale-95"
            >
              APPLY JSON
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── JD Form (View 1) ─────────────────────────────────────────────────────────

function JdForm({
  companyName,
  role,
  jd,
  onCompanyNameChange,
  onRoleChange,
  onJdChange,
  onAtsScore,
  onProjectAnalysis,
  onAiTailor,
  isAiTailorLoading,
  hideHeader,
}: {
  companyName: string;
  role: string;
  jd: string;
  onCompanyNameChange: (v: string) => void;
  onRoleChange: (v: string) => void;
  onJdChange: (v: string) => void;
  onAtsScore: () => void;
  onProjectAnalysis: () => void;
  onAiTailor: () => void;
  isAiTailorLoading: boolean;
  hideHeader?: boolean;
}) {
  const hasJd = jd.trim().length > 0;
  const wordCount = useMemo(() => (jd.trim() ? jd.trim().split(/\s+/).length : 0), [jd]);
  const charCount = jd.length;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="space-y-4 text-slate-100"
    >
      {/* Header Banner */}
      {!hideHeader && (
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm shadow-emerald-950/30">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
                Target Job Specification
              </h4>
              <p className="text-[11px] text-slate-400 leading-none mt-0.5">
                Score ATS, prioritize projects & tailor bullets.
              </p>
            </div>
          </div>
          {hasJd ? (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-semibold px-2 py-0.5">
              ✓ Ready
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-slate-800/80 text-slate-400 border-slate-700 text-[10px] font-medium px-2 py-0.5">
              Draft
            </Badge>
          )}
        </div>
      )}

      {/* 2-Column Grid: Company Name & Target Role */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-1.5">
          <Label htmlFor="jd-company-name" className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            Company Name
          </Label>
          <div className="relative">
            <Input
              id="jd-company-name"
              value={companyName}
              onChange={(e) => onCompanyNameChange(e.target.value)}
              placeholder="e.g. Google, Stripe"
              className="h-9 bg-slate-950/70 border-slate-750/90 hover:border-slate-600 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/30 text-white placeholder:text-slate-600 rounded-xl px-3 text-xs shadow-inner transition-all"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="jd-role" className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-slate-400" />
            Target Role
          </Label>
          <div className="relative">
            <Input
              id="jd-role"
              value={role}
              onChange={(e) => onRoleChange(e.target.value)}
              placeholder="e.g. Senior Frontend Eng"
              className="h-9 bg-slate-950/70 border-slate-750/90 hover:border-slate-600 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/30 text-white placeholder:text-slate-600 rounded-xl px-3 text-xs shadow-inner transition-all"
            />
          </div>
        </div>
      </div>

      {/* Job Description (JD) Area */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="jd-textarea" className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>Job Description (JD)</span>
            <span className="text-rose-400 font-bold">*</span>
          </Label>

          <div className="flex items-center gap-2">
            {hasJd ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-mono">
                  {wordCount} words
                </span>
                <button
                  type="button"
                  onClick={() => onJdChange("")}
                  className="text-slate-500 hover:text-rose-400 transition-colors p-0.5"
                  title="Clear Job Description"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <span className="text-[10px] text-amber-400/90 font-medium bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                Required for AI
              </span>
            )}
          </div>
        </div>

        <div className="relative group">
          <Textarea
            id="jd-textarea"
            value={jd}
            onChange={(e) => onJdChange(e.target.value)}
            placeholder="Paste job description requirements, responsibilities, and tech stack here..."
            className="min-h-[140px] max-h-[220px] bg-slate-950/70 border-slate-750/90 hover:border-slate-600 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/30 text-white placeholder:text-slate-600 rounded-xl p-3 text-xs leading-relaxed resize-none shadow-inner transition-all"
          />
        </div>
      </div>

      {/* Modern High-Impact Action Cards */}
      <div className="space-y-2.5 pt-1">
        {/* 1. ATS Score Checker Card Button */}
        <button
          id="ats-score-btn"
          type="button"
          onClick={onAtsScore}
          className="group relative w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-blue-600/90 via-indigo-600/90 to-blue-700/90 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-950/40 border border-blue-400/30 transition-all duration-200 active:scale-[0.99] text-left overflow-hidden"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-500/30 border border-blue-300/30 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
              <Target className="w-4 h-4 text-blue-100" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-white">
                ATS Score Checker
              </div>
              <div className="text-[10px] text-blue-200/80 truncate">
                Calculate match score & keyword gaps
              </div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-blue-200 shrink-0 transform group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* 2. Project Analysis Card Button */}
        <button
          id="project-analysis-btn"
          type="button"
          onClick={onProjectAnalysis}
          disabled={!hasJd}
          title={!hasJd ? "Paste a Job Description above to unlock Project Analysis" : "Analyze and prioritize projects for this JD"}
          className={`group relative w-full flex items-center justify-between p-3 rounded-xl text-left transition-all duration-200 active:scale-[0.99] overflow-hidden ${hasJd
              ? "bg-gradient-to-r from-purple-600/90 via-violet-600/90 to-indigo-600/90 hover:from-purple-500 hover:to-violet-500 text-white shadow-lg shadow-purple-950/40 border border-purple-400/30 cursor-pointer"
              : "bg-slate-900/60 border border-slate-800 text-slate-500 cursor-not-allowed opacity-80"
            }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform ${hasJd ? "bg-purple-500/30 border border-purple-300/30 text-purple-100 group-hover:scale-105" : "bg-slate-800/80 border border-slate-700/60 text-slate-500"
              }`}>
              {hasJd ? <Brain className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
            </div>
            <div className="min-w-0">
              <div className={`text-xs font-bold uppercase tracking-wider ${hasJd ? "text-white" : "text-slate-400"}`}>
                Project Analysis
              </div>
              <div className={`text-[10px] truncate ${hasJd ? "text-purple-200/80" : "text-slate-500"}`}>
                {hasJd ? "Prioritize & draft JD-aligned projects" : "Paste JD above to unlock"}
              </div>
            </div>
          </div>
          {hasJd ? (
            <ArrowRight className="w-4 h-4 text-purple-200 shrink-0 transform group-hover:translate-x-0.5 transition-transform" />
          ) : (
            <Badge variant="outline" className="text-[9px] bg-slate-800 border-slate-700 text-slate-400 font-mono py-0">
              LOCKED
            </Badge>
          )}
        </button>

        {/* 3. AI Tailor Resume Hero Button */}
        <button
          id="ai-tailor-btn"
          type="button"
          onClick={onAiTailor}
          disabled={!hasJd || isAiTailorLoading}
          title={!hasJd ? "Paste a Job Description above to unlock AI Tailoring" : "Tailor resume bullets and skills using AI"}
          className={`group relative w-full flex items-center justify-between p-3.5 rounded-xl text-left transition-all duration-200 active:scale-[0.99] overflow-hidden ${hasJd && !isAiTailorLoading
              ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-white shadow-xl shadow-emerald-950/60 border border-emerald-300/40 cursor-pointer"
              : isAiTailorLoading
                ? "bg-emerald-800/70 border border-emerald-500/50 text-emerald-200 cursor-wait"
                : "bg-slate-900/60 border border-slate-800 text-slate-500 cursor-not-allowed opacity-80"
            }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform ${hasJd && !isAiTailorLoading ? "bg-emerald-400/30 border border-emerald-200/40 text-white group-hover:scale-105" : "bg-slate-800/80 border border-slate-700/60 text-slate-500"
              }`}>
              {isAiTailorLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-200" />
              ) : (
                <Sparkles className={`w-4 h-4 ${hasJd ? "text-emerald-100" : "text-slate-500"}`} />
              )}
            </div>
            <div className="min-w-0">
              <div className={`text-xs font-bold uppercase tracking-wider ${hasJd ? "text-white" : "text-slate-400"}`}>
                {isAiTailorLoading ? "Tailoring Resume..." : "AI Tailor The Resume"}
              </div>
              <div className={`text-[10px] truncate ${hasJd ? "text-emerald-100/90" : "text-slate-500"}`}>
                {isAiTailorLoading
                  ? "Applying truth guardrails & metrics"
                  : hasJd
                    ? "Rewrite bullets & sync skills with JD"
                    : "Paste JD above to unlock"}
              </div>
            </div>
          </div>
          {hasJd && !isAiTailorLoading && (
            <Zap className="w-4 h-4 text-emerald-200 shrink-0 fill-emerald-200/30 transform group-hover:scale-110 transition-transform" />
          )}
        </button>
      </div>


    </motion.div>
  );
}

// ─── Main JdInputPanel Component ──────────────────────────────────────────────

export function JdInputPanel({
  companyName,
  role,
  jd,
  onCompanyNameChange,
  onRoleChange,
  onJdChange,
  project,
  projects,
  onProjectChange,
  onProjectsChange,
  onDeleteProject,
  onInsertProject,
  onInsertSingleProject,
  onAtsScore,
  onAiTailor,
  isAiTailorLoading,
  rankedProjects = [],
  onRankedProjectsChange,
  llmProvider,
  llmModel,
  apiKey,
  insertLabel,
  hideHeader,
}: JdPanelProps) {
  const [view, setView] = useState<"jd" | "projects">("jd");

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {view === "jd" ? (
          <JdForm
            key="jd"
            companyName={companyName}
            role={role}
            jd={jd}
            onCompanyNameChange={onCompanyNameChange}
            onRoleChange={onRoleChange}
            onJdChange={onJdChange}
            onAtsScore={onAtsScore}
            onProjectAnalysis={() => setView("projects")}
            onAiTailor={onAiTailor}
            isAiTailorLoading={isAiTailorLoading}
            hideHeader={hideHeader}
          />
        ) : (
          <ProjectAnalysisPanel
            key="projects"
            project={project}
            projects={projects}
            jd={jd}
            llmProvider={llmProvider}
            llmModel={llmModel}
            apiKey={apiKey}
            onProjectChange={onProjectChange}
            onProjectsChange={onProjectsChange}
            onDeleteProject={onDeleteProject}
            onInsertProject={onInsertProject}
            onInsertSingleProject={onInsertSingleProject}
            onBack={() => setView("jd")}
            rankedProjects={rankedProjects}
            onRankedProjectsChange={onRankedProjectsChange}
            insertLabel={insertLabel}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
