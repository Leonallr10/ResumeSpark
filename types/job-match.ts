export type JobMatchKeyword = {
  keyword: string;
  category: "technical" | "soft" | "tool" | "qualification" | "domain";
  found: boolean;
  resumeSection?: string;
  /** Raw match position in the resume text, for highlight purposes */
  resumeMatchIndex?: number;
};

export type AtsScoreBreakdown = {
  keywordMatch: number; // 0–100
  skillAlignment: number; // 0–100
  formattingQuality: number; // 0–100
  actionVerbs: number; // 0–100
  experienceDepth: number; // 0–100
};

export type JobMatchResult = {
  totalExtracted: number;
  matchedCount: number;
  matchRate: number; // 0–100 percentage
  atsScore: number; // 0–100 overall weighted score
  atsBreakdown: AtsScoreBreakdown;
  matchedKeywords: JobMatchKeyword[];
  missingKeywords: JobMatchKeyword[];
  allKeywords: JobMatchKeyword[];
  resumeText: string; // Flat compiled resume text for display
};
