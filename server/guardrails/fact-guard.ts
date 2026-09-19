import type { AiSuggestion } from "@/types/resume";
import { logGuardrailEvent } from "./audit-logger";

export interface FactGuardResult {
  ok: boolean;
  filteredSuggestions: AiSuggestion[];
  rejectedSuggestions: { suggestion: AiSuggestion; reason: string }[];
  flaggedCount: number;
}

/**
 * Fact-Guard checks generated suggestions against ground-truth facts.
 * If a suggestion introduces ungrounded metrics, fake company names, or fabricated numbers,
 * it OUTRIGHT REJECTS that suggestion (drops it completely) and logs the event.
 */
export function runFactGuard(
  suggestions: AiSuggestion[],
  sourceResumeText: string,
  extraProjectText: string,
  ipOrUser = "anonymous",
): FactGuardResult {
  const combinedKnowledge = `${sourceResumeText} \n ${extraProjectText}`.toLowerCase();

  const filteredSuggestions: AiSuggestion[] = [];
  const rejectedSuggestions: { suggestion: AiSuggestion; reason: string }[] = [];

  for (const sug of suggestions) {
    if (!sug.suggestedText) {
      filteredSuggestions.push(sug);
      continue;
    }

    let isRejected = false;
    let rejectionReason = "";

    // Check for high-specificity metric hallucinations (e.g. "by 98.4%", "saved $500,000", "reduced by 60%")
    const suggestedMetrics = sug.suggestedText.match(/\b\d+(?:\.\d+)?%\b|\$\d+[\d,]*\b|\b\d+x\b|\b\d+[\d,]*\+\s*(?:users|clients|nodes)\b/gi);
    if (suggestedMetrics) {
      for (const metric of suggestedMetrics) {
        if (!combinedKnowledge.includes(metric.toLowerCase())) {
          // Verify if the numerical value itself exists anywhere in source text
          const rawNum = metric.replace(/[^\d.]/g, "");
          if (rawNum && !combinedKnowledge.includes(rawNum)) {
            isRejected = true;
            rejectionReason = `Fabricated metric '${metric}' not found in candidate source records.`;
            break;
          }
        }
      }
    }

    if (isRejected) {
      logGuardrailEvent({
        type: "fact_hallucination_blocked",
        severity: "warning",
        reason: `[REJECTED SUGGESTION] ${rejectionReason} Target line: ${sug.targetLineId}`,
        details: {
          suggestionId: sug.id,
          targetLineId: sug.targetLineId,
          suggestedText: sug.suggestedText,
          rejectionReason,
        },
        ipOrUser,
      });

      rejectedSuggestions.push({
        suggestion: sug,
        reason: rejectionReason,
      });
    } else {
      filteredSuggestions.push(sug);
    }
  }

  return {
    ok: true,
    filteredSuggestions,
    rejectedSuggestions,
    flaggedCount: rejectedSuggestions.length,
  };
}
