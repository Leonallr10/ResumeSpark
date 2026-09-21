"use client";

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Zap, Star, TrendingUp, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ProjectRankingItem } from "@/lib/schemas";

interface ProjectRankingPanelProps {
  rankedProjects: ProjectRankingItem[];
  /** Compact single-column mode for sidebar panels (LaTeX editor) */
  compact?: boolean;
}

function scoreColor(score: number) {
  if (score >= 75) return { bar: "bg-emerald-500", text: "text-emerald-400", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
  if (score >= 45) return { bar: "bg-amber-400",   text: "text-amber-400",   badge: "bg-amber-400/15  text-amber-400  border-amber-400/30"  };
  return              { bar: "bg-rose-500",         text: "text-rose-400",    badge: "bg-rose-500/15   text-rose-400   border-rose-500/30"   };
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy className="w-3.5 h-3.5 text-yellow-400" />;
  if (rank === 2) return <Star   className="w-3.5 h-3.5 text-slate-300" />;
  if (rank === 3) return <Star   className="w-3.5 h-3.5 text-amber-600" />;
  return <TrendingUp className="w-3 h-3 text-slate-500" />;
}

export const ProjectRankingPanel = memo(function ProjectRankingPanel({
  rankedProjects,
  compact = false,
}: ProjectRankingPanelProps) {
  if (!rankedProjects || rankedProjects.length === 0) return null;

  return (
    <div
      className={
        compact
          ? "rounded-md border border-slate-700 bg-slate-900 p-3 space-y-3"
          : "rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm"
      }
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className={
            compact
              ? "p-1 rounded bg-violet-500/15 text-violet-400"
              : "p-1.5 rounded-md bg-violet-500/10 text-violet-500 dark:text-violet-400"
          }
        >
          <Zap className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
        </div>
        <div>
          <p className={compact ? "text-xs font-semibold text-slate-100" : "text-sm font-semibold text-foreground"}>
            Project Ranking
          </p>
          <p className={compact ? "text-[10px] text-slate-500" : "text-xs text-muted-foreground"}>
            Scored by JD relevance · Call&nbsp;#1
          </p>
        </div>
      </div>

      {/* Project list */}
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {rankedProjects.map((proj, idx) => {
            const c = scoreColor(proj.relevanceScore);

            return (
              <motion.div
                key={proj.projectId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.2 }}
                className={
                  compact
                    ? "rounded border border-slate-700 bg-slate-950/70 p-2 space-y-1.5"
                    : "rounded-lg border border-border bg-muted/40 p-3 space-y-2"
                }
              >
                {/* Row 1: rank icon + title + score badge */}
                <div className="flex items-start gap-2">
                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                    <RankIcon rank={idx + 1} />
                    <span className={compact ? "text-[10px] text-slate-500 font-mono" : "text-xs text-muted-foreground font-mono"}>
                      #{idx + 1}
                    </span>
                  </div>

                  <p
                    className={
                      compact
                        ? "text-[11px] font-medium text-slate-100 leading-tight flex-1 min-w-0 truncate"
                        : "text-sm font-semibold text-foreground leading-tight flex-1 min-w-0"
                    }
                    title={proj.projectId}
                  >
                    {proj.projectId}
                  </p>

                  <Badge
                    variant="outline"
                    className={`shrink-0 text-[10px] font-bold px-1.5 py-0 rounded border ${c.badge}`}
                  >
                    {proj.relevanceScore}
                  </Badge>
                </div>

                {/* Score bar */}
                <div className={compact ? "h-1 rounded-full bg-slate-800 overflow-hidden" : "h-1.5 rounded-full bg-muted overflow-hidden"}>
                  <motion.div
                    className={`h-full rounded-full ${c.bar}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${proj.relevanceScore}%` }}
                    transition={{ duration: 0.5, delay: idx * 0.04 + 0.1 }}
                  />
                </div>

                {/* Reason */}
                {proj.reason && (
                  <p className={compact ? "text-[10px] text-slate-400 leading-snug" : "text-xs text-muted-foreground leading-snug"}>
                    <ChevronRight className="w-3 h-3 inline mr-0.5 opacity-60" />
                    {proj.reason}
                  </p>
                )}

                {/* Matched skills */}
                {proj.matchedSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {proj.matchedSkills.slice(0, compact ? 4 : 6).map((skill) => (
                      <span
                        key={skill}
                        className={
                          compact
                            ? "inline-block text-[9px] px-1.5 py-0 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20"
                            : "inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-500 dark:text-violet-400 border border-violet-500/20 font-medium"
                        }
                      >
                        {skill}
                      </span>
                    ))}
                    {proj.matchedSkills.length > (compact ? 4 : 6) && (
                      <span className={compact ? "text-[9px] text-slate-500" : "text-[10px] text-muted-foreground"}>
                        +{proj.matchedSkills.length - (compact ? 4 : 6)} more
                      </span>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <p className={compact ? "text-[9px] text-slate-600" : "text-[10px] text-muted-foreground/70"}>
        Rankings computed by a dedicated LLM ranker before resume tailoring.
      </p>
    </div>
  );
});
