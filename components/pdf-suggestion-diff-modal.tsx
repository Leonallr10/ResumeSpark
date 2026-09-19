"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Sparkles, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AiSuggestion } from "@/types/resume";

interface PdfSuggestionDiffModalProps {
  isOpen: boolean;
  suggestions: AiSuggestion[];
  onClose: () => void;
  onApplySuggestion: (suggestion: AiSuggestion) => void;
  onApplyAll: (suggestions: AiSuggestion[]) => void;
}

export function PdfSuggestionDiffModal({
  isOpen,
  suggestions,
  onClose,
  onApplySuggestion,
  onApplyAll,
}: PdfSuggestionDiffModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-card border border-border w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        >
          {/* Header */}
          <div className="p-5 border-b flex items-center justify-between bg-muted/30">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  Review AI Tailoring Suggestions ({suggestions.length})
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Side-by-side diff preview. Guardrail-verified for zero hallucinated facts and metrics.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => onApplyAll(suggestions)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-8 px-3 gap-1.5"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Apply All ({suggestions.length})
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Body List of Diffs */}
          <div className="p-5 overflow-y-auto space-y-4 flex-1 divide-y divide-border">
            {suggestions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
                <p className="text-sm font-medium">No pending suggestions</p>
                <p className="text-xs text-muted-foreground mt-1">Your resume is well aligned with the specified job requirements.</p>
              </div>
            ) : (
              suggestions.map((sug, idx) => (
                <div key={sug.id || idx} className="pt-4 first:pt-0 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[11px] font-mono capitalize">
                        {sug.action.replace("_", " ")}
                      </Badge>
                      <span className="text-xs font-medium text-foreground">{sug.reason}</span>
                    </div>
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                      <ShieldCheck className="w-3 h-3 mr-1 inline" /> {sug.jdMatchReason || "JD Matched"}
                    </Badge>
                  </div>

                  {/* Side-by-side Diff */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Before */}
                    <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-foreground">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 mb-1.5 flex items-center justify-between">
                        <span>Original / Target</span>
                        <span className="font-mono text-[9px] opacity-70">{sug.targetLineId}</span>
                      </div>
                      <p className="line-through text-muted-foreground leading-relaxed">
                        {sug.originalText || "(Target line in document)"}
                      </p>
                    </div>

                    {/* After */}
                    <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/25 text-foreground relative">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1.5 flex items-center justify-between">
                        <span>AI Suggested Replacement</span>
                        <span className="text-[9px] font-medium bg-emerald-500/20 px-1 rounded">STAR</span>
                      </div>
                      <p className="font-medium text-emerald-900 dark:text-emerald-200 leading-relaxed">
                        {sug.suggestedText}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => onApplySuggestion(sug)}
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 px-3"
                    >
                      <Check className="w-3.5 h-3.5" /> Accept Change
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
