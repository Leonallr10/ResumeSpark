import type { LatexDiagnostic } from "@/types/latex-diagnostics";

export function parseLatexLog(rawLog: string, lineOffset = 0): LatexDiagnostic[] {
  const diagnostics: LatexDiagnostic[] = [];
  const seen = new Set<string>();

  function add(line: number, severity: "error" | "warning", message: string, context?: string) {
    const adjustedLine = Math.max(1, line - lineOffset);
    const key = `${adjustedLine}:${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    diagnostics.push({ id: "", line: adjustedLine, severity, message, context });
  }

  // 1. File-line-error format: ./resume.tex:42: Undefined control sequence
  const fileLineErrorRe = /^\.\/[^:]+:(\d+):\s*(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = fileLineErrorRe.exec(rawLog)) !== null) {
    add(parseInt(match[1], 10), "error", match[2].trim());
  }

  // 2. Traditional "!" errors: ! Undefined control sequence \n l.42 \badcommand
  const lines = rawLog.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("! ")) {
      const errorMsg = line.slice(2).trim();
      let lineNum = 0;
      let context: string | undefined;

      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const lookAhead = lines[j];
        const lineMatch = lookAhead.match(/^l\.(\d+)\s*(.*)/);
        if (lineMatch) {
          lineNum = parseInt(lineMatch[1], 10);
          context = lineMatch[2].trim() || undefined;
          break;
        }
      }

      if (lineNum > 0) {
        add(lineNum, "error", errorMsg, context);
      } else {
        add(1, "error", errorMsg);
      }
    }
  }

  // 3. LaTeX warnings with optional line numbers
  const warningRe = /LaTeX Warning:\s*(.+?)(?:\s*on input line (\d+))?\.?\s*$/gm;
  while ((match = warningRe.exec(rawLog)) !== null) {
    const lineNum = match[2] ? parseInt(match[2], 10) : 0;
    if (lineNum > 0) {
      add(lineNum, "warning", match[1].trim());
    }
  }

  // 4. Overfull/Underfull box warnings
  const boxRe = /((?:Overfull|Underfull)\s+\\[hv]box\s*.+?)(?:\s+at lines?\s+(\d+))?/gm;
  while ((match = boxRe.exec(rawLog)) !== null) {
    const lineNum = match[2] ? parseInt(match[2], 10) : 0;
    if (lineNum > 0) {
      add(lineNum, "warning", match[1].trim());
    }
  }

  diagnostics.sort((a, b) => a.line - b.line);
  diagnostics.forEach((d, i) => { d.id = `diag-${i + 1}`; });

  return diagnostics;
}
