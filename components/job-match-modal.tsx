"use client";

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Target,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Sparkles,
  RefreshCw,
  FileText,
  BookOpen,
  BarChart3,
  Search,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import type { JobMatchResult, JobMatchKeyword } from "@/types/job-match";
import type { ResumeSection } from "@/types/resume";
import { highlightKeywordsInText, extractLatexSections } from "@/lib/job-match";

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : score >= 40 ? "#f97316" : "#ef4444";

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={6}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s ease" }}
      />
    </svg>
  );
}

// ─── Breakdown bar ────────────────────────────────────────────────────────────

function BreakdownBar({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  const color =
    value >= 80
      ? "from-emerald-500 to-teal-400"
      : value >= 60
        ? "from-amber-500 to-yellow-400"
        : value >= 40
          ? "from-orange-500 to-amber-400"
          : "from-red-500 to-orange-400";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-slate-300 font-medium">
          {icon}
          {label}
        </span>
        <span className="text-slate-400 tabular-nums">{value}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ─── Highlighted text renderer ────────────────────────────────────────────────

function HighlightedText({
  text,
  keywords,
  dimMissing,
}: {
  text: string;
  keywords: string[];
  dimMissing?: boolean;
}) {
  const segments = useMemo(
    () => highlightKeywordsInText(text, keywords),
    [text, keywords],
  );

  return (
    <span>
      {segments.map((seg, i) =>
        seg.highlight ? (
          <mark
            key={i}
            className="bg-yellow-300/25 text-yellow-200 border border-yellow-400/30 rounded px-0.5 font-medium"
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i} className={dimMissing ? "text-slate-400" : "text-slate-300"}>
            {seg.text}
          </span>
        ),
      )}
    </span>
  );
}

// ─── Keyword pill ─────────────────────────────────────────────────────────────

function KeywordPill({ keyword }: { keyword: JobMatchKeyword }) {
  const categoryColor: Record<JobMatchKeyword["category"], string> = {
    technical: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    tool: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    soft: "bg-teal-500/20 text-teal-300 border-teal-500/30",
    qualification: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    domain: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${categoryColor[keyword.category]}`}
    >
      {keyword.found ? (
        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
      ) : (
        <XCircle className="h-3 w-3 text-red-400" />
      )}
      {keyword.keyword}
    </span>
  );
}

// ─── Resume section renderer (uses clean LaTeX-extracted text) ───────────────

function LatexSectionCard({
  section,
  matchedKeywords,
}: {
  section: { title: string; lines: string[] };
  matchedKeywords: string[];
}) {
  if (section.lines.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 border-b border-slate-700/40">
        <FileText className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
          {section.title}
        </span>
      </div>
      <div className="p-3 space-y-1">
        {section.lines.map((line, i) => {
          const isBullet = line.startsWith("•");
          const displayText = isBullet ? line.slice(1).trim() : line;
          return (
            <div key={i} className="text-xs leading-relaxed flex gap-1">
              {isBullet && <span className="text-slate-500 flex-shrink-0 mt-px">•</span>}
              <HighlightedText text={displayText} keywords={matchedKeywords} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

type Tab = "included" | "missing" | "breakdown";

type JobMatchModalProps = {
  isOpen: boolean;
  result: JobMatchResult | null;
  sections: ResumeSection[];
  latexCode: string;
  jd: string;
  companyRole: string;
  isAnalyzing: boolean;
  onClose: () => void;
  onReanalyze: () => void;
};

export function JobMatchModal({
  isOpen,
  result,
  sections,
  latexCode,
  jd,
  companyRole,
  isAnalyzing,
  onClose,
  onReanalyze,
}: JobMatchModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("included");
  const [keywordFilter, setKeywordFilter] = useState<"all" | "matched" | "missing">("all");

  // Use direct LaTeX extraction for display (bypasses AST text issues)
  const latexSections = useMemo(
    () => extractLatexSections(latexCode),
    [latexCode],
  );

  const matchedKeywordStrings = useMemo(
    () => result?.matchedKeywords.map((k) => k.keyword) ?? [],
    [result],
  );

  const displayedKeywords = useMemo(() => {
    if (!result) return [];
    if (keywordFilter === "matched") return result.matchedKeywords;
    if (keywordFilter === "missing") return result.missingKeywords;
    return result.allKeywords;
  }, [result, keywordFilter]);

  const atsColor = useCallback((score: number) => {
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-amber-400";
    if (score >= 40) return "text-orange-400";
    return "text-red-400";
  }, []);

  const atsLabel = useCallback((score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Poor";
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            className="relative z-10 w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 shadow-2xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {/* ── Header ── */}
            <div className="flex-shrink-0 border-b border-slate-700/60 bg-slate-900/80 px-6 py-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/30">
                    <Target className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-100">Job Match & ATS Analysis</h2>
                    {companyRole && (
                      <p className="text-xs text-slate-400 truncate max-w-[280px]">{companyRole}</p>
                    )}
                  </div>
                </div>

                {/* Stats */}
                {result && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <Stat
                      icon={<Search className="h-3.5 w-3.5 text-slate-400" />}
                      label={`${result.totalExtracted} keywords extracted`}
                      color="slate"
                    />
                    <Stat
                      icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                      label={`${result.matchedCount} matches found`}
                      color="emerald"
                    />
                    <Stat
                      icon={<TrendingUp className="h-3.5 w-3.5 text-amber-400" />}
                      label={`Match Rate: ${result.matchRate}%`}
                      color="amber"
                    />
                    <Stat
                      icon={<BarChart3 className="h-3.5 w-3.5 text-blue-400" />}
                      label={`ATS Score: ${result.atsScore}/100`}
                      color="blue"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={onReanalyze}
                    disabled={isAnalyzing}
                    className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-all hover:bg-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isAnalyzing ? "animate-spin" : ""}`} />
                    {isAnalyzing ? "Analyzing…" : "Re-Analyze"}
                  </button>
                  <button
                    onClick={onClose}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/60 text-slate-400 transition-all hover:border-slate-500 hover:text-slate-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Loading state ── */}
            {isAnalyzing && !result && (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                >
                  <Sparkles className="h-10 w-10 text-emerald-400" />
                </motion.div>
                <p className="text-slate-300 font-medium">Analyzing your resume against the JD…</p>
                <p className="text-slate-500 text-sm">Extracting keywords & calculating ATS score</p>
              </div>
            )}

            {/* ── Body ── */}
            {result && (
              <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Left column: ATS score + keyword filter */}
                <div className="w-64 flex-shrink-0 border-r border-slate-700/60 bg-slate-950/30 flex flex-col">
                  {/* Score ring */}
                  <div className="flex flex-col items-center py-6 px-4 border-b border-slate-700/40">
                    <div className="relative">
                      <ScoreRing score={result.atsScore} size={90} />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-2xl font-black ${atsColor(result.atsScore)}`}>
                          {result.atsScore}
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold">ATS</span>
                      </div>
                    </div>
                    <p className={`mt-2 text-sm font-bold ${atsColor(result.atsScore)}`}>
                      {atsLabel(result.atsScore)}
                    </p>
                    <div className="mt-1 flex items-center gap-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span className="text-xs text-slate-400">{result.matchRate}% match rate</span>
                    </div>
                  </div>

                  {/* Keyword filter */}
                  <div className="p-3 border-b border-slate-700/40">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Filter Keywords
                    </p>
                    <div className="flex flex-col gap-1">
                      {(["all", "matched", "missing"] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setKeywordFilter(f)}
                          className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                            keywordFilter === f
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                          }`}
                        >
                          <span className="capitalize">{f}</span>
                          <span className="text-[10px] tabular-nums opacity-70">
                            {f === "all"
                              ? result.totalExtracted
                              : f === "matched"
                                ? result.matchedCount
                                : result.missingKeywords.length}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Keyword pills list */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                    {displayedKeywords.slice(0, 60).map((kw, i) => (
                      <KeywordPill key={i} keyword={kw} />
                    ))}
                  </div>
                </div>

                {/* Center: Split view JD + Resume */}
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  {/* Split panes */}
                  <div className="flex-1 min-h-0 flex overflow-hidden">
                    {/* JD pane */}
                    <div className="flex-1 min-h-0 flex flex-col border-r border-slate-700/60">
                      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-slate-800/50 border-b border-slate-700/40">
                        <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Job Description
                        </span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4">
                        <p className="text-xs leading-relaxed whitespace-pre-wrap">
                          <HighlightedText
                            text={jd}
                            keywords={matchedKeywordStrings}
                          />
                        </p>
                      </div>
                    </div>

                    {/* Resume pane */}
                    <div className="flex-1 min-h-0 flex flex-col">
                      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-slate-800/50 border-b border-slate-700/40">
                        <FileText className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Your Resume
                        </span>
                        <span className="ml-auto text-[10px] text-slate-500 italic">
                          matching keywords highlighted
                        </span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {latexSections.map((section, i) => (
                          <LatexSectionCard
                            key={i}
                            section={section}
                            matchedKeywords={matchedKeywordStrings}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Bottom tabs */}
                  <div className="flex-shrink-0 border-t border-slate-700/60 bg-slate-900/60">
                    {/* Tab bar */}
                    <div className="flex border-b border-slate-700/40">
                      {(
                        [
                          { id: "included", label: "Included in Resume", icon: <CheckCircle2 className="h-3.5 w-3.5" />, count: result.matchedCount, color: "text-emerald-400" },
                          { id: "missing", label: "Missing Requirements", icon: <AlertTriangle className="h-3.5 w-3.5" />, count: result.missingKeywords.length, color: "text-red-400" },
                          { id: "breakdown", label: "ATS Breakdown", icon: <BarChart3 className="h-3.5 w-3.5" />, count: null, color: "text-blue-400" },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as Tab)}
                          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                            activeTab === tab.id
                              ? `border-emerald-500 ${tab.color}`
                              : "border-transparent text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          {tab.icon}
                          {tab.label}
                          {tab.count !== null && (
                            <span className="ml-1 rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] tabular-nums">
                              {tab.count}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Tab content */}
                    <div className="h-32 overflow-y-auto p-4">
                      {activeTab === "included" && (
                        <div className="flex flex-wrap gap-1.5">
                          {result.matchedKeywords.length === 0 ? (
                            <p className="text-xs text-slate-500">No matched keywords found.</p>
                          ) : (
                            result.matchedKeywords.map((kw, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-300"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                {kw.keyword}
                                {kw.resumeSection && (
                                  <span className="text-emerald-500/70 text-[10px]">
                                    · {kw.resumeSection}
                                  </span>
                                )}
                              </span>
                            ))
                          )}
                        </div>
                      )}

                      {activeTab === "missing" && (
                        <div className="space-y-2">
                          {result.missingKeywords.length === 0 ? (
                            <p className="text-xs text-emerald-400 font-semibold">
                              🎉 All extracted requirements are present in your resume!
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {result.missingKeywords.map((kw, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-300"
                                >
                                  <XCircle className="h-3 w-3" />
                                  {kw.keyword}
                                  <span className="text-red-500/60 text-[10px] capitalize">
                                    · {kw.category}
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === "breakdown" && (
                        <div className="grid grid-cols-2 gap-3">
                          <BreakdownBar
                            label="Keyword Match"
                            value={result.atsBreakdown.keywordMatch}
                            icon={<Search className="h-3 w-3 text-slate-400" />}
                          />
                          <BreakdownBar
                            label="Skill Alignment"
                            value={result.atsBreakdown.skillAlignment}
                            icon={<Target className="h-3 w-3 text-slate-400" />}
                          />
                          <BreakdownBar
                            label="Formatting Quality"
                            value={result.atsBreakdown.formattingQuality}
                            icon={<FileText className="h-3 w-3 text-slate-400" />}
                          />
                          <BreakdownBar
                            label="Action Verbs"
                            value={result.atsBreakdown.actionVerbs}
                            icon={<ChevronRight className="h-3 w-3 text-slate-400" />}
                          />
                          <BreakdownBar
                            label="Experience Depth"
                            value={result.atsBreakdown.experienceDepth}
                            icon={<TrendingUp className="h-3 w-3 text-slate-400" />}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Small stat badge ─────────────────────────────────────────────────────────

function Stat({
  icon,
  label,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  color: "slate" | "emerald" | "amber" | "blue";
}) {
  const colorMap = {
    slate: "border-slate-700/60 bg-slate-800/60 text-slate-300",
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${colorMap[color]}`}
    >
      {icon}
      {label}
    </span>
  );
}
