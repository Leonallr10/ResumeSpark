import type { LatexDiagnostic } from "@/types/latex-diagnostics";

export interface OverflowInfo {
  hasOverflow: boolean;
  overflowPoints?: number;
  message?: string;
}

/**
 * Translates cryptic LaTeX compiler errors into clear, actionable explanations.
 */
export function humanizeLatexMessage(rawMsg: string): string {
  if (/Misplaced alignment tab character &/i.test(rawMsg)) {
    return "Unescaped '&' found. In LaTeX, '&' is reserved for tables; replace with '\\&'.";
  }
  if (/Missing \$ inserted/i.test(rawMsg)) {
    return "Unescaped math/symbol character found (such as '_', '$', or '^'). Special characters must be escaped.";
  }
  if (/macro parameter character #/i.test(rawMsg)) {
    return "Unescaped '#' character found. Replace '#' with '\\#'.";
  }
  if (/Undefined control sequence/i.test(rawMsg)) {
    return "Unrecognized LaTeX command. Check for misspelled macros or unescaped backslashes.";
  }
  if (/File `[^']+' not found/i.test(rawMsg)) {
    return "Missing LaTeX package or font dependency in compiler environment.";
  }
  if (/Emergency stop/i.test(rawMsg)) {
    return "Compilation terminated abruptly. Likely caused by a broken environment or unescaped characters.";
  }
  if (/Runaway argument/i.test(rawMsg)) {
    return "Unclosed brace '{' detected in resume content.";
  }
  return rawMsg;
}

/**
 * Checks compiler log for Overfull \vbox warnings which indicate vertical page overflow.
 */
export function detectPageOverflow(rawLog: string): OverflowInfo {
  const match = rawLog.match(/Overfull \\vbox \(([0-9.]+)pt too high\)/i);
  if (match) {
    const pt = parseFloat(match[1]);
    return {
      hasOverflow: true,
      overflowPoints: pt,
      message: `Resume content exceeds single-page layout by ~${Math.round(pt)}pt. Consider reducing bullet lengths or section spacing to prevent spilling onto a second page.`,
    };
  }

  if (/Output written on .+\((\d+) pages?/i.test(rawLog)) {
    const pageMatch = rawLog.match(/Output written on .+\((\d+) pages?/i);
    const pages = pageMatch ? parseInt(pageMatch[1], 10) : 1;
    if (pages > 1) {
      return {
        hasOverflow: true,
        message: `Resume compiled into ${pages} pages instead of a 1-page target. Shorten experience bullets or condense skills to fit 1 page.`,
      };
    }
  }

  return { hasOverflow: false };
}

/**
 * Generates a clean human-readable summary of compile failures for the UI.
 */
export function formatReadableCompileError(rawLog: string, diagnostics: LatexDiagnostic[]): string {
  const errors = diagnostics.filter((d) => d.severity === "error");
  if (errors.length > 0) {
    const topError = errors[0];
    const friendly = humanizeLatexMessage(topError.message);
    const lineInfo = topError.line ? ` (Line ${topError.line})` : "";
    return `${friendly}${lineInfo}`;
  }

  if (/! LaTeX Error:\s*(.+)/i.test(rawLog)) {
    const match = rawLog.match(/! LaTeX Error:\s*(.+)/i);
    return match ? humanizeLatexMessage(match[1]) : "LaTeX syntax error encountered.";
  }

  if (/! Emergency stop/i.test(rawLog)) {
    return "LaTeX compiler encountered a fatal syntax error. Verify special characters like %, &, and $ are escaped.";
  }

  return "LaTeX compilation failed. Please verify resume syntax.";
}

export function parseLatexLog(rawLog: string, lineOffset = 0): LatexDiagnostic[] {
  const diagnostics: LatexDiagnostic[] = [];
  const seen = new Set<string>();

  function add(line: number, severity: "error" | "warning", message: string, context?: string) {
    const adjustedLine = Math.max(1, line - lineOffset);
    const key = `${adjustedLine}:${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    diagnostics.push({
      id: "",
      line: adjustedLine,
      severity,
      message: humanizeLatexMessage(message),
      context,
    });
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
