export interface TemplateSpec {
  templateId: string;
  name: string;
  category: "Academic & LaTeX" | "Tech & Engineering" | "Executive & Clean" | "Modern Minimal";
  description: string;
  marker: string;
  fontFamily: string;
  fontSize: string;
  accentColor: string;
  margins: {
    margin?: string;
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
  sectionRule: "single" | "none" | "prefix" | "double";
  subheadingLayout: "tabular" | "hfill" | "dotfill" | "centered";
  skillsLayout: "categorized-bullets" | "bracket-tags" | "centered-categories";
  headerLayout: "centered" | "flush-left" | "monospace" | "small-caps-centered";
  defaultExtrasLabel: string;
}

export const TEMPLATE_SPECS: Record<string, TemplateSpec> = {
  "template-1": {
    templateId: "template-1",
    name: "Classic Traditional",
    category: "Academic & LaTeX",
    description: "Centered header, serif Times typography, tabular row alignment, single horizontal rule under section headers. The safe corporate look.",
    marker: "% RTAI-TEMPLATE: classic-traditional v2",
    fontFamily: "Times New Roman, serif",
    fontSize: "11pt",
    accentColor: "#111827",
    margins: { margin: "0.65in" },
    sectionRule: "single",
    subheadingLayout: "tabular",
    skillsLayout: "categorized-bullets",
    headerLayout: "centered",
    defaultExtrasLabel: "Achievements and Activities",
  },
  "template-2": {
    templateId: "template-2",
    name: "Modern Minimal",
    category: "Modern Minimal",
    description: "Flush-left alignment, sans-serif typography, pine/teal accent colors, whitespace separation without rule lines.",
    marker: "% RTAI-TEMPLATE: modern-minimal v2",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    fontSize: "10.5pt",
    accentColor: "#1B6E5C",
    margins: { margin: "0.6in" },
    sectionRule: "none",
    subheadingLayout: "hfill",
    skillsLayout: "categorized-bullets",
    headerLayout: "flush-left",
    defaultExtrasLabel: "Key Achievements",
  },
  "template-3": {
    templateId: "template-3",
    name: "Technical Developer",
    category: "Tech & Engineering",
    description: "Developer/terminal aesthetic with // code-comment headers, dotted leaders for dates, and bracketed skill tags.",
    marker: "% RTAI-TEMPLATE: technical-developer v2",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "10pt",
    accentColor: "#0f766e",
    margins: { margin: "0.55in", top: "0.45in", bottom: "0.45in" },
    sectionRule: "prefix",
    subheadingLayout: "dotfill",
    skillsLayout: "bracket-tags",
    headerLayout: "monospace",
    defaultExtrasLabel: "ACHIEVEMENTS",
  },
  "template-4": {
    templateId: "template-4",
    name: "Elegant Formal",
    category: "Executive & Clean",
    description: "Centered layout throughout, small-caps headers, double horizontal rule under sections, dignified executive presence.",
    marker: "% RTAI-TEMPLATE: elegant-formal v2",
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: "11pt",
    accentColor: "#1f2937",
    margins: { margin: "0.75in" },
    sectionRule: "double",
    subheadingLayout: "centered",
    skillsLayout: "centered-categories",
    headerLayout: "small-caps-centered",
    defaultExtrasLabel: "Certifications",
  },
};
