"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Save, Trash2 } from "lucide-react";

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
      return;
    }

    onProjectsChange(parsedProjects.projects);
    setSelectedProjectIndex(0);
    setJsonValue(formatProjectJson(parsedProjects.projects));
    setJsonError(null);
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
  }

  function deleteSelectedProject() {
    const nextIndex = Math.min(selectedProjectIndex, Math.max(activeProjects.length - 2, 0));
    onDeleteProject(selectedProjectIndex);
    setSelectedProjectIndex(nextIndex);
    setJsonError(null);
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
              className={`h-7 px-3 text-xs ${inputMode === "form"
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
              className={`h-7 px-3 text-xs ${inputMode === "json"
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
                  className="h-9 w-9 shrink-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0 flex-1">
                  <select
                    value={selectedProjectIndex}
                    onChange={(event) => setSelectedProjectIndex(Number(event.target.value))}
                    className="h-9 min-w-0 w-full rounded-md border border-input bg-background px-3 text-sm"
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
                  className="h-9 w-9 shrink-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {selectedProjectIndex + 1} / {activeProjects.length}
                </p>
              </div>
            ) : (
              <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                Editing {selectedProject.heading.trim() || "Project 1"}
              </p>
            )}
            <Button type="button" size="sm" variant="outline" onClick={addProjectDraft}>
              <Plus className="h-4 w-4" />
              New
            </Button>
          </div>
          <Input
            value={selectedProject.heading}
            onChange={(event) => updateField("heading", event.target.value)}
            placeholder="Project heading"
          />
          <Textarea
            value={selectedProject.explanation}
            onChange={(event) => updateField("explanation", event.target.value)}
            placeholder="Project explanation"
            className="min-h-44"
          />
          <Input
            value={selectedProject.techStack}
            onChange={(event) => updateField("techStack", event.target.value)}
            placeholder="Tech stack, for example React, Node.js, MongoDB"
          />
          <Input
            value={selectedProject.link}
            onChange={(event) => updateField("link", event.target.value)}
            placeholder="Project link (optional)"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={selectedProject.fromDate}
              onChange={(event) => updateField("fromDate", event.target.value)}
              placeholder="From date"
            />
            <Input
              value={selectedProject.toDate}
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
      "link": "https://github.com/example/ai-resume-analyzer",
      "fromDate": "Jan 2026",
      "toDate": "Apr 2026"
    },
    {
      "heading": "Portfolio CMS",
      "explanation": "Built a content dashboard for publishing case studies and project pages.",
      "techStack": "Next.js, MongoDB, Tailwind CSS",
      "link": "https://portfolio.example.com",
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

      {inputMode === "form" && (
        <div className="flex items-center justify-end gap-2">
          <div className="flex flex-wrap justify-end gap-2">

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={deleteSelectedProject}
              disabled={!canDeleteProject}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            {insertProjectCount > 1 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onInsertSingleProject(selectedProjectIndex)}
                disabled={!canInsertProject(selectedProject)}
              >
                <Plus className="h-4 w-4" />
                Add this project
              </Button>
            ) : null}
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
      )}
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
