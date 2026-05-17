"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Save, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  canInsertProject,
  formatProjectsInput,
  hasProjectDraftContent,
  type ProjectDraft,
} from "@/lib/latex-resume";

export const emptyProjectDraft: ProjectDraft = {
  heading: "",
  explanation: "",
  techStack: "",
  link: "",
  fromDate: "",
  toDate: "",
};

type ProjectInputMode = "form" | "json";

type LatexProjectFieldsProps = {
  project: ProjectDraft;
  projects: ProjectDraft[];
  onProjectChange: (project: ProjectDraft) => void;
  onProjectsChange: (projects: ProjectDraft[]) => void;
  onSaveProjects: (projects: ProjectDraft[]) => void;
  onDeleteProject: (index: number) => void;
  onInsertProject: () => void;
  onInsertSingleProject: (index: number) => void;
};

export function LatexProjectFields({
  project,
  projects,
  onProjectChange,
  onProjectsChange,
  onSaveProjects,
  onDeleteProject,
  onInsertProject,
  onInsertSingleProject,
}: LatexProjectFieldsProps) {
  const [inputMode, setInputMode] = useState<ProjectInputMode>("form");
  const [jsonValue, setJsonValue] = useState(formatProjectJson([project]));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0);

  const activeProjects = useMemo(
    () => (projects.length > 0 ? projects : [project]),
    [projects, project],
  );
  const selectedProject = activeProjects[selectedProjectIndex] ?? emptyProjectDraft;

  useEffect(() => {
    setSelectedProjectIndex((current) =>
      Math.min(current, Math.max(activeProjects.length - 1, 0)),
    );
  }, [activeProjects.length]);

  useEffect(() => {
    if (inputMode === "json") {
      setJsonValue(formatProjectJson(activeProjects));
    }
  }, [activeProjects, inputMode]);

  function updateField(field: keyof ProjectDraft, value: string) {
    const nextProject = {
      ...selectedProject,
      [field]: value,
    };

    if (projects.length > 0) {
      onProjectsChange(
        activeProjects.map((currentProject, index) =>
          index === selectedProjectIndex ? nextProject : currentProject,
        ),
      );
      return;
    }

    onProjectChange(nextProject);
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
      toast.error(parsedProjects.error);
      return;
    }

    onProjectsChange(parsedProjects.projects);
    setSelectedProjectIndex(0);
    setJsonValue(formatProjectJson(parsedProjects.projects));
    setJsonError(null);
    toast.success("Project JSON applied successfully!");
  }

  function addProjectDraft() {
    const currentProjects = projects.length > 0
      ? projects
      : hasProjectDraftContent(project)
        ? [project]
        : [];
    const nextProjects = [...currentProjects, emptyProjectDraft];

    onProjectsChange(nextProjects);
    setSelectedProjectIndex(nextProjects.length - 1);
    setInputMode("form");
    setJsonError(null);
    toast.success("New project draft added!");
  }

  function deleteSelectedProject() {
    const nextIndex = Math.min(selectedProjectIndex, Math.max(activeProjects.length - 2, 0));
    onDeleteProject(selectedProjectIndex);
    setSelectedProjectIndex(nextIndex);
    setJsonError(null);
    toast.success("Project deleted.");
  }

  function goToPreviousProject() {
    setSelectedProjectIndex((current) => Math.max(0, current - 1));
  }

  function goToNextProject() {
    setSelectedProjectIndex((current) =>
      Math.min(activeProjects.length - 1, current + 1),
    );
  }

  const insertProjectCount = activeProjects.filter(canInsertProject).length;
  const canSaveProjects = activeProjects.some(hasProjectDraftContent);
  const canDeleteProject =
    activeProjects.length > 1 || hasProjectDraftContent(selectedProject);

  return (
    <div className="w-full space-y-4 rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 shadow-xl backdrop-blur-md text-slate-100">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-emerald-400">Project Input</Label>
          <p className="mt-1 text-[11px] text-slate-400 leading-relaxed font-medium">
            Add a project draft, then insert it into the LaTeX Projects section.
          </p>
        </div>
        <div className="space-y-1.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 text-right">
            Input method
          </p>
          <div
            className="grid grid-cols-2 rounded-lg border border-slate-800 bg-slate-950/70 p-0.5"
            role="tablist"
            aria-label="Project input method"
          >
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={`h-6 px-3 text-[10px] font-bold transition-all rounded ${inputMode === "form"
                ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-500"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                }`}
              onClick={() => switchInputMode("form")}
              role="tab"
              aria-selected={inputMode === "form"}
            >
              FORM
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={`h-6 px-3 text-[10px] font-bold transition-all rounded ${inputMode === "json"
                ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-500"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
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

      <AnimatePresence mode="wait">
        {inputMode === "form" ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/40 p-2 rounded-lg border border-slate-800">
              {activeProjects.length > 1 ? (
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={goToPreviousProject}
                    disabled={selectedProjectIndex === 0}
                    aria-label="Go to previous project"
                    className="h-7 w-7 shrink-0 bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="relative min-w-0 flex-1">
                    <select
                      value={selectedProjectIndex}
                      onChange={(event) => setSelectedProjectIndex(Number(event.target.value))}
                      className="h-7 w-full appearance-none rounded-md border border-slate-700 bg-slate-950 pl-2.5 pr-8 text-xs font-semibold text-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all duration-200 truncate"
                      aria-label="Select project"
                    >
                      {activeProjects.map((currentProject, index) => (
                        <option key={`${currentProject.heading}-${index}`} value={index} className="bg-slate-900 text-slate-200">
                          {currentProject.heading.trim() || `Project ${index + 1}`}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={goToNextProject}
                    disabled={selectedProjectIndex >= activeProjects.length - 1}
                    aria-label="Go to next project"
                    className="h-7 w-7 shrink-0 bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <p className="shrink-0 text-[10px] font-bold text-emerald-400 tabular-nums bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850">
                    {selectedProjectIndex + 1}/{activeProjects.length}
                  </p>
                </div>
              ) : (
                <p className="min-w-0 flex-1 text-[11px] font-semibold text-emerald-400/90 italic pl-1">
                  Editing: {selectedProject.heading.trim() || "Project 1"}
                </p>
              )}
              <Button
                type="button"
                size="sm"
                className="h-7 gap-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white border-0 shadow-sm transition-all duration-200 active:scale-95 text-[10px] font-bold rounded-md px-2.5"
                onClick={addProjectDraft}
              >
                <Plus className="h-3 w-3" />
                NEW
              </Button>
            </div>

            <div className="space-y-3">
              <Input
                value={selectedProject.heading}
                onChange={(event) => updateField("heading", event.target.value)}
                placeholder="Project heading"
                className="h-10 bg-slate-950/60 border-slate-700/60 text-slate-100 placeholder-slate-500 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 focus:border-emerald-500 rounded-lg shadow-inner transition-all duration-200 text-xs"
              />
              <Textarea
                value={selectedProject.explanation}
                onChange={(event) => updateField("explanation", event.target.value)}
                placeholder="Project explanation (achievements, details, impact...)"
                className="min-h-[140px] bg-slate-950/60 border-slate-700/60 text-slate-100 placeholder-slate-500 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 focus:border-emerald-500 rounded-lg shadow-inner transition-all duration-200 text-xs leading-relaxed"
              />
              <Input
                value={selectedProject.techStack}
                onChange={(event) => updateField("techStack", event.target.value)}
                placeholder="Tech stack (e.g. React, Node.js, MongoDB)"
                className="h-10 bg-slate-950/60 border-slate-700/60 text-slate-100 placeholder-slate-500 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 focus:border-emerald-500 rounded-lg shadow-inner transition-all duration-200 text-xs"
              />
              <Input
                value={selectedProject.link}
                onChange={(event) => updateField("link", event.target.value)}
                placeholder="Project link (optional)"
                className="h-10 bg-slate-950/60 border-slate-700/60 text-slate-100 placeholder-slate-500 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 focus:border-emerald-500 rounded-lg shadow-inner transition-all duration-200 text-xs"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  value={selectedProject.fromDate}
                  onChange={(event) => updateField("fromDate", event.target.value)}
                  placeholder="From date"
                  className="h-10 bg-slate-950/60 border-slate-700/60 text-slate-100 placeholder-slate-500 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 focus:border-emerald-500 rounded-lg shadow-inner transition-all duration-200 text-xs"
                />
                <Input
                  value={selectedProject.toDate}
                  onChange={(event) => updateField("toDate", event.target.value)}
                  placeholder="To date"
                  className="h-10 bg-slate-950/60 border-slate-700/60 text-slate-100 placeholder-slate-500 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 focus:border-emerald-500 rounded-lg shadow-inner transition-all duration-200 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800/80 mt-4">
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 w-9 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border-rose-900/50 bg-slate-950/60 rounded-lg transition-all duration-200 active:scale-95 flex items-center justify-center"
                  onClick={deleteSelectedProject}
                  disabled={!canDeleteProject}
                  title="Delete project"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                {insertProjectCount > 1 ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 gap-1.5 bg-gradient-to-r from-emerald-600/90 to-teal-600/90 hover:from-emerald-500 hover:to-teal-500 text-white border-none shadow-md shadow-emerald-950/30 transition-all duration-200 active:scale-95 text-xs font-bold rounded-lg px-4"
                    onClick={() => onInsertSingleProject(selectedProjectIndex)}
                    disabled={!canInsertProject(selectedProject)}
                  >
                    <Plus className="h-4 w-4" />
                    ADD THIS
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  className="h-9 gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white border-none shadow-md shadow-emerald-950/30 transition-all duration-200 active:scale-95 text-xs font-bold px-4 rounded-lg"
                  onClick={onInsertProject}
                  disabled={insertProjectCount === 0}
                >
                  <Plus className="h-4 w-4" />
                  {insertProjectCount > 1 ? `INSERT ${insertProjectCount} PROJECTS` : "INSERT PROJECT"}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="json"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="relative group rounded-lg overflow-hidden border border-slate-700 bg-slate-950 p-0.5">
              <div className="absolute top-2 right-3 z-10 flex items-center gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                <span className="h-2 w-2 rounded-full bg-red-500"></span>
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              </div>
              <Textarea
                value={jsonValue}
                onChange={(event) => {
                  setJsonValue(event.target.value);
                  setJsonError(null);
                }}
                placeholder={`{\n  "projects": [\n    {\n      "heading": "AI Resume Analyzer",\n      "explanation": "Built a resume scoring workflow with LLM feedback.",\n      "techStack": "Next.js, TypeScript, FastAPI",\n      "link": "https://github.com/example/analyzer",\n      "fromDate": "Jan 2026",\n      "toDate": "Apr 2026"\n    }\n  ]\n}`}
                className="min-h-[220px] font-mono text-[11px] leading-relaxed bg-slate-950 border-0 text-emerald-400 placeholder-slate-650 focus-visible:ring-0 focus-visible:border-0 rounded-md p-3 tracking-wide resize-y focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 mt-2">
              {jsonError ? (
                <p className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">{jsonError.replace("JSON", "").trim()}</p>
              ) : (
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Paste object or array draft
                </p>
              )}
              <Button
                type="button"
                size="sm"
                className="h-9 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white border-none shadow-md shadow-emerald-950/30 transition-all duration-200 active:scale-95 text-xs font-bold px-5 rounded-lg"
                onClick={applyJsonProject}
              >
                APPLY JSON
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatProjectJson(projects: ProjectDraft[]) {
  const visibleProjects = projects.filter(hasProjectDraftContent);

  return JSON.stringify(
    visibleProjects.length > 1
      ? { projects: visibleProjects }
      : visibleProjects[0] ?? emptyProjectDraft,
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

  const description = readDescriptionValue(record.description);
  const project = {
    heading: readJsonString(record.heading ?? record.name ?? record.title),
    explanation: readJsonString(
      record.explanation ?? record.role ?? record.summary ?? description,
    ),
    techStack: readJsonString(record.techStack ?? record.tech_stack ?? record.stack),
    link: readJsonString(record.link ?? record.url ?? record.projectUrl ?? record.project_url),
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

function readDescriptionValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(" ");
}
