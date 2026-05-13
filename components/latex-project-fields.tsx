"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Save, Trash2 } from "lucide-react";
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
    <div className="w-full space-y-3 rounded-md border bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Label className="text-sm font-semibold">Project Input</Label>
          <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
            Add a project once, then insert it into the LaTeX Projects section.
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
            Input method
          </p>
          <div
            className="grid grid-cols-2 rounded-lg border bg-muted/50 p-0.5"
            role="tablist"
            aria-label="Project input method"
          >
            <Button
              type="button"
              size="sm"
              variant={inputMode === "form" ? "secondary" : "ghost"}
              className={`h-6 px-3 text-[10px] font-bold transition-all ${inputMode === "form"
                ? "bg-white text-emerald-700 shadow-sm hover:bg-white"
                : "text-muted-foreground hover:text-foreground"
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
              variant={inputMode === "json" ? "secondary" : "ghost"}
              className={`h-6 px-3 text-[10px] font-bold transition-all ${inputMode === "json"
                ? "bg-white text-emerald-700 shadow-sm hover:bg-white"
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

      <AnimatePresence mode="wait">
        {inputMode === "form" ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            <div className="flex flex-wrap items-start gap-2">
              {activeProjects.length > 1 ? (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={goToPreviousProject}
                    disabled={selectedProjectIndex === 0}
                    aria-label="Go to previous project"
                    className="h-8 w-8 shrink-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <select
                      value={selectedProjectIndex}
                      onChange={(event) => setSelectedProjectIndex(Number(event.target.value))}
                      className="h-8 min-w-0 w-full rounded-md border border-input bg-background px-3 text-xs font-medium"
                      aria-label="Select project"
                    >
                      {activeProjects.map((currentProject, index) => (
                        <option key={`${currentProject.heading}-${index}`} value={index}>
                          {currentProject.heading.trim() || `Project ${index + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={goToNextProject}
                    disabled={selectedProjectIndex >= activeProjects.length - 1}
                    aria-label="Go to next project"
                    className="h-8 w-8 shrink-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <p className="shrink-0 text-[10px] font-bold text-muted-foreground tabular-nums bg-muted px-1.5 py-0.5 rounded">
                    {selectedProjectIndex + 1} / {activeProjects.length}
                  </p>
                </div>
              ) : (
                <p className="min-w-0 flex-1 text-[11px] font-medium text-muted-foreground italic">
                  Editing {selectedProject.heading.trim() || "Project 1"}
                </p>
              )}
              <Button
                type="button"
                size="sm"
                className="h-9 gap-1.5 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white border-none shadow-sm transition-all duration-200 active:scale-95 text-[11px] font-bold"
                onClick={addProjectDraft}
              >
                <Plus className="h-4 w-4" />
                NEW
              </Button>
            </div>

            <div className="space-y-2.5">
              <Input
                value={selectedProject.heading}
                onChange={(event) => updateField("heading", event.target.value)}
                placeholder="Project heading"
                className="h-9 text-xs"
              />
              <Textarea
                value={selectedProject.explanation}
                onChange={(event) => updateField("explanation", event.target.value)}
                placeholder="Project explanation"
                className="min-h-32 text-xs leading-relaxed"
              />
              <Input
                value={selectedProject.techStack}
                onChange={(event) => updateField("techStack", event.target.value)}
                placeholder="Tech stack (e.g. React, Node.js, MongoDB)"
                className="h-9 text-xs"
              />
              <Input
                value={selectedProject.link}
                onChange={(event) => updateField("link", event.target.value)}
                placeholder="Project link (optional)"
                className="h-9 text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={selectedProject.fromDate}
                  onChange={(event) => updateField("fromDate", event.target.value)}
                  placeholder="From date"
                  className="h-9 text-xs"
                />
                <Input
                  value={selectedProject.toDate}
                  onChange={(event) => updateField("toDate", event.target.value)}
                  placeholder="To date"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1 border-t mt-4">
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 w-9 text-rose-500 hover:text-rose-600 hover:bg-rose-50 border-rose-100 transition-colors"
                  onClick={deleteSelectedProject}
                  disabled={!canDeleteProject}
                  title="Delete project"
                >
                  <Trash2 className="h-6 w-6" />
                </Button>
                {insertProjectCount > 1 ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 gap-1.5 bg-gradient-to-br from-emerald-500/90 to-emerald-600/90 hover:from-emerald-600 hover:to-emerald-700 text-white border-none shadow-sm transition-all duration-200 active:scale-95 text-[11px] font-bold"
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
                  className="h-9 gap-1.5 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white border-none shadow-sm transition-all duration-200 active:scale-95 text-[11px] font-bold px-4"
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
            className="space-y-3"
          >
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
      "link": "https://github.com/example/ai-resume-analyzer",
      "fromDate": "Jan 2026",
      "toDate": "Apr 2026"
    }
  ]
}`}
              className="min-h-40 font-mono text-[10px] leading-relaxed bg-slate-50/50 border-emerald-100"
            />
            <div className="flex items-center justify-between pt-1">
              {jsonError ? (
                <p className="text-[10px] text-destructive font-bold">{jsonError.toUpperCase()}</p>
              ) : (
                <p className="text-[10px] text-muted-foreground font-medium">
                  PASTE OBJECT OR ARRAY
                </p>
              )}
              <Button
                type="button"
                size="sm"
                className="h-9 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white border-none shadow-sm transition-all duration-200 active:scale-95 text-[11px] font-bold px-6"
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
