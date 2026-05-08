import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { z } from "zod";

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
      available: Boolean(engine),
      compiler: engine ?? null,
      candidates: compilerCandidates,
      message: engine
        ? `LaTeX compiler found: ${engine}.`
        : "No LaTeX compiler was found. Install MiKTeX, TeX Live, or Tectonic and restart the dev server.",
    },
    { status: engine ? 200 : 503 },
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

  if (!engine) {
    return NextResponse.json(
      {
        error:
          "No LaTeX compiler was found. Install MiKTeX, TeX Live, or Tectonic and make pdflatex, xelatex, or tectonic available on PATH.",
      },
      { status: 503 },
    );
  }

  const workdir = path.join(process.cwd(), "tmp", "latex-compile", randomUUID());
  const sourcePath = path.join(workdir, "resume.tex");
  const pdfPath = path.join(workdir, "resume.pdf");
  const logPath = path.join(workdir, "resume.log");

  try {
    await mkdir(workdir, { recursive: true });
    await writeFile(sourcePath, normalizeLatexForPdf(parsedRequest.data.latex, engine), "utf8");

    const firstRun = await runCompiler(engine, sourcePath, workdir);

    if (!firstRun.ok) {
      const log = await readCompilerLog(logPath, firstRun.output);

      return NextResponse.json(
        {
          error: "LaTeX compilation failed.",
          compiler: engine,
          details: trimLog(log),
        },
        { status: 422 },
      );
    }

    if (engine !== "tectonic" && !engine.includes("tectonic")) {
      await runCompiler(engine, sourcePath, workdir);
    }

    const pdf = await readFile(pdfPath);

    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="resume.pdf"',
        "Cache-Control": "no-store",
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
      ["--outdir", workdir, "--keep-logs", sourcePath],
      workdir,
      30000,
    );
  }

  return runProcess(
    engine,
    [
      "-interaction=nonstopmode",
      "-halt-on-error",
      "-file-line-error",
      "-no-shell-escape",
      "-output-directory",
      workdir,
      sourcePath,
    ],
    workdir,
    30000,
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
