export type ResumeLine = {
  id: string;
  page: number;
  sectionId: string;
  text: string;
  rightText?: string;
  secondaryText?: string;
  sourceLine?: number;
  sourceEndLine?: number;
  sourceText?: string;
  kind?: "header" | "text" | "bullet" | "projectHeading" | "subheading";
  replacedText?: string;
  changeKind?: "replace" | "insert";
  layout?: ResumeLineLayout;
};

export type ResumeSection = {
  id: string;
  title: string;
  lines: ResumeLine[];
};

export type ResumeLineThemeVariant =
  | "body"
  | "sectionHeading"
  | "headerName"
  | "headerSub"
  | "link";

export type ResumeLineLayout = {
  pageWidth: number;
  pageHeight: number;
  pageBackground?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  lineHeight: number;
  renderedTextWidth?: number;
  textScaleX?: number;
  textAlign: "left" | "center" | "right";
  /** Text paint inferred from the PDF, defaulting to black when the extractor does not expose it. */
  color?: string;
  fontStyle?: "normal" | "italic";
  fontVariantCaps?: "normal" | "small-caps";
  variant?: ResumeLineThemeVariant;
};

export type AiSuggestionAction = "replace" | "insert_before" | "insert_after" | "delete";

export type AiSuggestion = {
  id: string;
  targetLineId: string;
  sectionId: string;
  action: AiSuggestionAction;
  originalText?: string;
  suggestedText: string;
  reason: string;
  jdMatchReason: string;
};

export type SectionReviewStatus =
  | "strong"
  | "needs_changes"
  | "missing_jd_keywords"
  | "not_relevant";

export type SectionReview = {
  sectionId: string;
  status: SectionReviewStatus;
  summary: string;
};

export type SuggestionResponse = {
  suggestions: AiSuggestion[];
  sectionReviews: SectionReview[];
};

export type LlmProvider = "gemini" | "groq" | "claude";

export type PolishAction = "improve" | "elaborate" | "professional" | "concise" | "quantify";

export type PolishState = {
  range: { from: number; to: number };
  original: string;
  polished: string | null;
  loading: boolean;
  action: PolishAction;
} | null;
