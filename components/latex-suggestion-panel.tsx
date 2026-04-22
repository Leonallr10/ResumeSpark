"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AiSuggestion, ResumeLine, ResumeSection, SectionReview } from "@/types/resume";

type LatexSuggestionPanelProps = {
  sections: ResumeSection[];
  suggestions: AiSuggestion[];
  sectionReviews: SectionReview[];
  onAcceptSuggestion: (suggestion: AiSuggestion) => void;
  onDeclineSuggestion: (suggestionId: string) => void;
};

export function LatexSuggestionPanel({
  sections,
  suggestions,
  sectionReviews,
  onAcceptSuggestion,
  onDeclineSuggestion,
}: LatexSuggestionPanelProps) {
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const lineById = new Map(
    sections.flatMap((section) => section.lines.map((line) => [line.id, line] as const)),
  );
  const reviewBySection = new Map(
    sectionReviews.map((review) => [review.sectionId, review]),
  );
  const visibleSuggestions = suggestions.filter((suggestion) => {
    const review = reviewBySection.get(suggestion.sectionId);

    return review?.status !== "strong";
  });

  if (visibleSuggestions.length === 0) {
    return null;
  }

  const groupedSuggestions = visibleSuggestions.reduce<Record<string, AiSuggestion[]>>(
    (groups, suggestion) => {
      groups[suggestion.sectionId] = [
        ...(groups[suggestion.sectionId] ?? []),
        suggestion,
      ];
      return groups;
    },
    {},
  );

  return (
    <div className="space-y-3 rounded-md border bg-slate-950 p-3 text-slate-100">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">LaTeX inline suggestions</p>
          <p className="text-xs text-slate-400">
            Strong sections are hidden. Accepting applies the same resume style.
          </p>
        </div>
        <Badge variant="outline" className="border-slate-600 text-slate-200">
          {visibleSuggestions.length}
        </Badge>
      </div>

      <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1 font-mono text-[11px] leading-relaxed">
        {Object.entries(groupedSuggestions).map(([sectionId, sectionSuggestions]) => {
          const section = sectionById.get(sectionId);

          return (
            <div key={sectionId} className="rounded-sm border border-slate-700 bg-slate-900">
              <div className="border-b border-slate-700 px-2 py-1 text-sky-300">
                \section{"{"}{section?.title ?? "Resume"}{"}"}
              </div>
              <div className="space-y-2 p-2">
                {sectionSuggestions.map((suggestion) => {
                  const currentLine = lineById.get(suggestion.targetLineId);

                  return (
                    <LatexSuggestionItem
                      key={suggestion.id}
                      suggestion={suggestion}
                      currentLine={currentLine}
                      onAcceptSuggestion={onAcceptSuggestion}
                      onDeclineSuggestion={onDeclineSuggestion}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type LatexSuggestionItemProps = {
  suggestion: AiSuggestion;
  currentLine?: ResumeLine;
  onAcceptSuggestion: (suggestion: AiSuggestion) => void;
  onDeclineSuggestion: (suggestionId: string) => void;
};

function LatexSuggestionItem({
  suggestion,
  currentLine,
  onAcceptSuggestion,
  onDeclineSuggestion,
}: LatexSuggestionItemProps) {
  return (
    <div className="rounded-sm border border-slate-700 bg-slate-950/80 p-2">
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <Badge variant="default" className="rounded-sm px-1.5 py-0 text-[10px]">
          {suggestion.action.replace("_", " ")}
        </Badge>
        <span className="truncate text-[10px] text-slate-400">
          {suggestion.jdMatchReason}
        </span>
      </div>

      {suggestion.action !== "insert_before" &&
      suggestion.action !== "insert_after" ? (
        <CodeLine prefix="-" tone="remove">
          {toLatexResumeLine(currentLine?.text ?? suggestion.originalText ?? "")}
        </CodeLine>
      ) : null}

      {suggestion.action !== "delete" ? (
        <CodeLine prefix="+" tone="add">
          {toLatexResumeLine(suggestion.suggestedText)}
        </CodeLine>
      ) : null}

      <p className="mt-1 text-[10px] text-slate-500">{suggestion.reason}</p>

      <div className="mt-2 flex gap-2">
        <Button
          type="button"
          size="sm"
          className="h-7 rounded-sm px-2 text-[11px]"
          onClick={() => onAcceptSuggestion(suggestion)}
        >
          Accept
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 rounded-sm border-slate-600 bg-slate-900 px-2 text-[11px] text-slate-100 hover:bg-slate-800"
          onClick={() => onDeclineSuggestion(suggestion.id)}
        >
          Decline
        </Button>
      </div>
    </div>
  );
}

function CodeLine({
  prefix,
  tone,
  children,
}: {
  prefix: string;
  tone: "add" | "remove";
  children: string;
}) {
  const toneClass = tone === "add" ? "text-emerald-300" : "text-rose-300";

  return (
    <pre className={`overflow-x-auto whitespace-pre-wrap ${toneClass}`}>
      <span className="select-none pr-2 text-slate-500">{prefix}</span>
      {children}
    </pre>
  );
}

function toLatexResumeLine(text: string) {
  return `\\resumeItem{${escapeLatex(text)}}`;
}

function escapeLatex(text: string) {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([{}$%&_#])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}
