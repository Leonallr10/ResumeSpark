import { z } from "zod";

export const resumeLineSchema = z.object({
  id: z.string().min(1),
  page: z.number().int().positive(),
  sectionId: z.string().min(1),
  text: z.string(),
  rightText: z.string().optional(),
  secondaryText: z.string().optional(),
  sourceLine: z.number().int().nonnegative().optional(),
  sourceEndLine: z.number().int().nonnegative().optional(),
  sourceText: z.string().optional(),
  kind: z
    .enum(["header", "text", "bullet", "projectHeading", "subheading"])
    .optional(),
  layout: z
    .object({
      pageWidth: z.number().positive(),
      pageHeight: z.number().positive(),
      pageBackground: z.string().optional(),
      x: z.number(),
      y: z.number(),
      width: z.number().positive(),
      height: z.number().positive(),
      fontSize: z.number().positive(),
      fontFamily: z.string().min(1),
      fontWeight: z.number().positive(),
      lineHeight: z.number().positive(),
      textAlign: z.enum(["left", "center", "right"]),
      color: z.string().min(1).optional(),
      fontStyle: z.enum(["normal", "italic"]).optional(),
      variant: z
        .enum(["body", "sectionHeading", "headerName", "headerSub", "link"])
        .optional(),
    })
    .optional(),
});

export const resumeSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  lines: z.array(resumeLineSchema),
});

export const suggestionRequestSchema = z.object({
  resumeSections: z.array(resumeSectionSchema).min(1),
  project: z.string().min(1).max(12000),
  companyRole: z.string().min(1).max(300),
  jd: z.string().min(1).max(20000),
});

export const aiSuggestionSchema = z.object({
  id: z.string().min(1),
  targetLineId: z.string().min(1),
  sectionId: z.string().min(1),
  action: z.enum(["replace", "insert_before", "insert_after", "delete"]),
  originalText: z.string().optional(),
  suggestedText: z.string(),
  reason: z.string().min(1),
  jdMatchReason: z.string().min(1),
});

export const sectionReviewSchema = z.object({
  sectionId: z.string().min(1),
  status: z.enum(["strong", "needs_changes", "missing_jd_keywords", "not_relevant"]),
  summary: z.string().min(1),
});

export const suggestionResponseSchema = z.object({
  suggestions: z.array(aiSuggestionSchema),
  sectionReviews: z.array(sectionReviewSchema),
});
