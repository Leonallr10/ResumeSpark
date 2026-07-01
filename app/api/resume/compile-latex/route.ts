import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { parseLatexLog } from "@/lib/latex-log-parser";
import { generatePreviewId, storePdf } from "@/lib/pdf-cache";

export const runtime = "nodejs";

const CLOUD_LATEX_URL = "https://texlive.net/cgi-bin/latexcgi";
const CLOUD_TIMEOUT_MS = 45000;

const compileRequestSchema = z.object({
  latex: z.string().min(1).max(250000),
});

export async function GET() {
  return NextResponse.json(
    {
      available: true,
      compiler: "texlive.net (cloud)",
      message: "LaTeX compilation is handled via texlive.net cloud service.",
    },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  const parsedRequest = compileRequestSchema.safeParse(await request.json());

  if (!parsedRequest.success) {
    return NextResponse.json(
      {
        error: "Invalid LaTeX compile payload.",
        details: parsedRequest.error.flatten(),
      },
      { status: 400 },
    );
  }

  return compileViaCloud(parsedRequest.data.latex);
}

async function compileViaCloud(latex: string) {
  const normalizedLatex = normalizeLatexForPdf(latex);
  const lineOffset = normalizedLatex.split("\n").length - latex.split("\n").length;

  const formData = new FormData();
  formData.append(
    "filecontents[]",
    new Blob([normalizedLatex], { type: "text/plain" }),
    "document.tex",
  );
  formData.append("filename[]", "document.tex");
  formData.append("engine", "pdflatex");
  formData.append("return", "pdf");

  try {
    const response = await fetch(CLOUD_LATEX_URL, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(CLOUD_TIMEOUT_MS),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        {
          error: "Cloud LaTeX compilation failed.",
          compiler: "texlive.net",
          details: text.slice(-500),
          diagnostics: parseLatexLog(text, lineOffset),
        },
        { status: 422 },
      );
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.includes("pdf")) {
      const text = await response.text();
      const logLines = text
        .split("\n")
        .filter((l) => l.includes("!") || l.includes("Error"))
        .slice(0, 20);
      return NextResponse.json(
        {
          error: "LaTeX compilation failed.",
          compiler: "texlive.net",
          details: logLines.join("\n") || text.slice(-500),
          diagnostics: parseLatexLog(text, lineOffset),
        },
        { status: 422 },
      );
    }

    const pdf = Buffer.from(await response.arrayBuffer());
    const previewId = generatePreviewId();
    storePdf(previewId, pdf);

    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="resume.pdf"',
        "Cache-Control": "no-store",
        "X-Preview-Id": previewId,
        "X-Compiler": "texlive.net",
        "X-Synctex-Available": "0",
      },
    });
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.message.includes("timeout"));

    return NextResponse.json(
      {
        error: isTimeout
          ? "Cloud LaTeX compilation timed out. Your document may be too large or complex."
          : "Cloud LaTeX service unavailable. Please try again in a moment.",
        compiler: "texlive.net",
        details: error instanceof Error ? error.message : "Network error",
      },
      { status: 503 },
    );
  }
}

// ---------------------------------------------------------------------------
// LaTeX normalisation helpers
// ---------------------------------------------------------------------------

function normalizeLatexForPdf(source: string): string {
  let latex = source;

  // Strip leading backslash-space before bare URLs (e.g. "\ https://...")
  latex = latex.replace(/\\\s+(?=https?:\/\/)/g, "");

  // Wrap bare URLs so pdflatex handles them correctly
  latex = wrapBareUrlsWithLatexUrl(latex);

  // Inject ATS-compatibility unicode mapping required by pdflatex
  latex = injectAtsCompatibility(latex);

  return latex;
}

function injectAtsCompatibility(source: string): string {
  let latex = source;

  const hasGlyphtounicode = /\\input\{glyphtounicode\}/i.test(latex);
  const hasPdfgentounicode = /\\pdfgentounicode\s*=\s*1/.test(latex);

  if (!hasPdfgentounicode) {
    const atsBlock = [
      ...(!hasGlyphtounicode ? ["\\input{glyphtounicode}"] : []),
      "\\pdfgentounicode=1",
    ].join("\n");

    if (hasGlyphtounicode) {
      latex = latex.replace(
        /(\\input\{glyphtounicode\})/i,
        `$1\n\\pdfgentounicode=1`,
      );
    } else {
      latex = latex.replace(
        /\\begin\{document\}/,
        `${atsBlock}\n\\begin{document}`,
      );
    }
  }

  return latex;
}

function wrapBareUrlsWithLatexUrl(source: string): string {
  const urlPattern = /https?:\/\/[^\s}]+/g;

  return source.replace(urlPattern, (url, offset, whole) => {
    const contextBefore = whole.slice(Math.max(0, offset - 40), offset);

    // Skip URLs already inside \url{...} or \href{...}
    if (/\\(?:url|href)\{[^}]*$/u.test(contextBefore)) {
      return url;
    }

    return `\\url{${url}}`;
  });
}
