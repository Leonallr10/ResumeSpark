import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { z } from "zod";

import { parseLatexLog } from "@/lib/latex-log-parser";
import { generatePreviewId, storePdf } from "@/lib/pdf-cache";

export const runtime = "nodejs";

const compileRequestSchema = z.object({
  latex: z.string().min(1).max(250000),
  engine: z.enum(["pdflatex", "xelatex", "tectonic"]).optional(),
});

const compilerCandidates = ["pdflatex", "xelatex", "tectonic"] as const;
type CompilerEngine = (typeof compilerCandidates)[number];

export async function GET() {
  const engine = await resolveCompiler();

  return NextResponse.json(
    {
      available: Boolean(engine) || true,
      compiler: engine ?? "cloud (texlive.net)",
      candidates: compilerCandidates,
      message: engine
        ? `LaTeX compiler found: ${engine}.`
        : "Using cloud LaTeX compilation (texlive.net). Install tectonic locally for faster builds.",
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

  const engine = await resolveCompiler(parsedRequest.data.engine);

  // No local compiler — try cloud LaTeX compilation
  if (!engine) {
    return compileViaCloud(parsedRequest.data.latex);
  }

  const workdir = path.join(process.cwd(), "tmp", "latex-compile", randomUUID());
  const sourcePath = path.join(workdir, "resume.tex");
  const pdfPath = path.join(workdir, "resume.pdf");
  const logPath = path.join(workdir, "resume.log");

  try {
    await mkdir(workdir, { recursive: true });
    const originalLineCount = parsedRequest.data.latex.split("\n").length;
    const normalizedSource = normalizeLatexForPdf(parsedRequest.data.latex, engine);
    const normalizedLineCount = normalizedSource.split("\n").length;
    const lineOffset = normalizedLineCount - originalLineCount;
    await writeFile(sourcePath, normalizedSource, "utf8");

    const firstRun = await runCompiler(engine, sourcePath, workdir);

    if (!firstRun.ok) {
      const log = await readCompilerLog(logPath, firstRun.output);

      return NextResponse.json(
        {
          error: "LaTeX compilation failed.",
          compiler: engine,
          details: trimLog(log),
          diagnostics: parseLatexLog(log, lineOffset),
        },
        { status: 422 },
      );
    }

    if (engine !== "tectonic" && !engine.includes("tectonic")) {
      await runCompiler(engine, sourcePath, workdir);
    }

    const pdf = await readFile(pdfPath);
    const synctexPath = path.join(workdir, "resume.synctex.gz");
    let synctexBuffer: Buffer | null = null;
    try {
      await access(synctexPath);
      synctexBuffer = await readFile(synctexPath);
    } catch {
      // synctex.gz not generated — graceful fallback
    }

    const previewId = generatePreviewId();
    storePdf(previewId, Buffer.from(pdf), synctexBuffer, lineOffset);

    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="resume.pdf"',
        "Cache-Control": "no-store",
        "X-Preview-Id": previewId,
        "X-Synctex-Available": synctexBuffer ? "1" : "0",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to compile LaTeX.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

async function compileViaCloud(latex: string) {
  const normalizedLatex = normalizeLatexForPdf(latex, "pdflatex");
  const lineOffset = normalizedLatex.split("\n").length - latex.split("\n").length;

  const formData = new FormData();
  formData.append("filecontents[]", new Blob([normalizedLatex], { type: "text/plain" }), "document.tex");
  formData.append("filename[]", "document.tex");
  formData.append("engine", "pdflatex");
  formData.append("return", "pdf");

  try {
    const response = await fetch("https://texlive.net/cgi-bin/latexcgi", {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        {
          error: "Cloud LaTeX compilation failed.",
          details: text.slice(-500),
          diagnostics: parseLatexLog(text, lineOffset),
        },
        { status: 422 },
      );
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.includes("pdf")) {
      const text = await response.text();
      const logLines = text.split("\n").filter((l) => l.includes("!") || l.includes("Error")).slice(0, 20);
      return NextResponse.json(
        {
          error: "Cloud LaTeX compilation returned errors.",
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
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Cloud LaTeX service unavailable. Install a local LaTeX compiler (tectonic) for reliable compilation.",
        details: error instanceof Error ? error.message : "Network error",
      },
      { status: 503 },
    );
  }
}

async function resolveCompiler(preferred?: CompilerEngine) {
  const candidates = preferred ? [preferred] : compilerCandidates;

  for (const compiler of candidates) {
    const availability = await runProcess(compiler, ["--version"], process.cwd(), 5000);

    if (availability.ok) {
      return compiler;
    }
  }

  // Check for tectonic in local project directory as fallback
  const localTectonic = path.join(process.cwd(), "tectonic-bin", "tectonic.exe");
  const localAvailability = await runProcess(localTectonic, ["--version"], process.cwd(), 5000);
  if (localAvailability.ok) {
    return localTectonic as unknown as CompilerEngine;
  }

  return undefined;
}

function runCompiler(engine: string, sourcePath: string, workdir: string) {
  if (engine === "tectonic" || engine.includes("tectonic")) {
    return runProcess(
      engine,
      ["--outdir", workdir, "--keep-logs", "--synctex", sourcePath],
      workdir,
      120000,
    );
  }

  return runProcess(
    engine,
    [
      "-interaction=nonstopmode",
      "-halt-on-error",
      "-file-line-error",
      "-no-shell-escape",
      "-synctex=1",
      "-output-directory",
      workdir,
      sourcePath,
    ],
    workdir,
    60000,
  );
}

function runProcess(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      shell: false,
    });
    const output: string[] = [];
    const timer = setTimeout(() => {
      child.kill();
      output.push(`Process timed out after ${timeoutMs}ms.`);
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => output.push(chunk.toString("utf8")));
    child.stderr.on("data", (chunk: Buffer) => output.push(chunk.toString("utf8")));
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, output: error.message });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, output: output.join("") });
    });
  });
}

async function readCompilerLog(logPath: string, fallback: string) {
  try {
    return await readFile(logPath, "utf8");
  } catch {
    return fallback;
  }
}

function trimLog(log: string) {
  return log.split("\n").slice(-80).join("\n").trim();
}

function normalizeLatexForPdf(source: string, engine: string) {
  let latex = source;

  // Users sometimes add "\ https://..." in header lines.
  latex = latex.replace(/\\\s+(?=https?:\/\/)/g, "");

  // Ensure plain URLs are clickable in generated PDF.
  latex = wrapBareUrlsWithLatexUrl(latex);

  // Tectonic/XeTeX handle Unicode natively — strip pdflatex-specific commands.
  // For pdflatex, inject ATS-critical unicode mapping.
  if (engine === "tectonic" || engine === "xelatex" || engine.includes("tectonic")) {
    latex = stripPdflatexUnicodeCommands(latex);
  } else {
    latex = injectAtsCompatibility(latex);
  }

  return latex;
}

function stripPdflatexUnicodeCommands(source: string) {
  return source
    .replace(/\\input\{glyphtounicode\}\s*/gi, "")
    .replace(/\\pdfgentounicode\s*=\s*1\s*/g, "");
}

function injectAtsCompatibility(source: string) {
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

function wrapBareUrlsWithLatexUrl(source: string) {
  const urlPattern = /https?:\/\/[^\s}]+/g;

  return source.replace(urlPattern, (url, offset, whole) => {
    const contextBefore = whole.slice(Math.max(0, offset - 40), offset);

    // Skip URLs that are already inside \url{...} or \href{...}
    if (/\\(?:url|href)\{[^}]*$/u.test(contextBefore)) {
      return url;
    }

    return `\\url{${url}}`;
  });
}
