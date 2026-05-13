export type DiagnosticSeverity = "error" | "warning";

export type LatexDiagnostic = {
  id: string;
  line: number;
  severity: DiagnosticSeverity;
  message: string;
  context?: string;
};
