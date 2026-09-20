import type { ResumeDocumentModel } from "@/server/documents/resume-document-model";
import { TEMPLATE_SPECS, type TemplateSpec } from "./specs";
import {
  renderTemplate1Html,
  renderTemplate2Html,
  renderTemplate3Html,
  renderTemplate4Html,
} from "./html-builders";
import {
  renderTemplate1Latex,
  renderTemplate2Latex,
  renderTemplate3Latex,
  renderTemplate4Latex,
} from "./latex-builders";

export interface ResumeTemplateDefinition {
  id: string;
  name: string;
  category: "Academic & LaTeX" | "Tech & Engineering" | "Executive & Clean" | "Modern Minimal";
  description: string;
  fontFamily: string;
  accentColor: string;
  version: string;
  spec: TemplateSpec;
  renderHtml: (model: ResumeDocumentModel) => string;
  renderLatex: (model: ResumeDocumentModel) => string;
}

// ==========================================
// TEMPLATE REGISTRY
// ==========================================
export const TEMPLATE_REGISTRY: Record<string, ResumeTemplateDefinition> = {
  "template-1": {
    id: "template-1",
    name: "Classic Traditional",
    category: "Academic & LaTeX",
    description: "Centered header, Times New Roman serif typography, tabular row alignment, and single horizontal rules. The safe corporate look.",
    fontFamily: "Times New Roman, serif",
    accentColor: "#111827",
    version: "2.0.0",
    spec: TEMPLATE_SPECS["template-1"],
    renderHtml: (model) => renderTemplate1Html(model, TEMPLATE_SPECS["template-1"]),
    renderLatex: (model) => renderTemplate1Latex(model, TEMPLATE_SPECS["template-1"]),
  },
  "template-2": {
    id: "template-2",
    name: "Modern Minimal",
    category: "Modern Minimal",
    description: "Flush-left layout, crisp sans-serif font, deep pine/teal accents, and airy whitespace separation with high ATS readability.",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    accentColor: "#1B6E5C",
    version: "2.0.0",
    spec: TEMPLATE_SPECS["template-2"],
    renderHtml: (model) => renderTemplate2Html(model, TEMPLATE_SPECS["template-2"]),
    renderLatex: (model) => renderTemplate2Latex(model, TEMPLATE_SPECS["template-2"]),
  },
  "template-3": {
    id: "template-3",
    name: "Technical Developer",
    category: "Tech & Engineering",
    description: "Developer/terminal aesthetic with // code-comment headers, dotted leader rows for dates, and bracketed skill tags.",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    accentColor: "#0f766e",
    version: "2.0.0",
    spec: TEMPLATE_SPECS["template-3"],
    renderHtml: (model) => renderTemplate3Html(model, TEMPLATE_SPECS["template-3"]),
    renderLatex: (model) => renderTemplate3Latex(model, TEMPLATE_SPECS["template-3"]),
  },
  "template-4": {
    id: "template-4",
    name: "Elegant Formal",
    category: "Executive & Clean",
    description: "Centered layout throughout, small-caps headers, double horizontal rules under sections, and dignified executive presence.",
    fontFamily: "Georgia, 'Times New Roman', serif",
    accentColor: "#1f2937",
    version: "2.0.0",
    spec: TEMPLATE_SPECS["template-4"],
    renderHtml: (model) => renderTemplate4Html(model, TEMPLATE_SPECS["template-4"]),
    renderLatex: (model) => renderTemplate4Latex(model, TEMPLATE_SPECS["template-4"]),
  },
};

export function getTemplateDefinition(templateId: string): ResumeTemplateDefinition {
  return TEMPLATE_REGISTRY[templateId] || TEMPLATE_REGISTRY["template-1"];
}

export function getTemplateRenderer(templateId: string): (model: ResumeDocumentModel) => string {
  const t = getTemplateDefinition(templateId);
  return t.renderHtml;
}

export function getTemplateLatexRenderer(templateId: string): (model: ResumeDocumentModel) => string {
  const t = getTemplateDefinition(templateId);
  return t.renderLatex;
}

// Backwards-compatible aliases for legacy imports
export {
  renderTemplate1Html as renderTemplate1Academic,
  renderTemplate2Html as renderTemplate2Classic,
  renderTemplate3Html as renderTemplate3ModernTech,
  renderTemplate4Html as renderTemplate4Minimal,
};
