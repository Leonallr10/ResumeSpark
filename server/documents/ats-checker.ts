import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import type { ResumeDocumentModel } from "./resume-document-model";
import { normalizeResumeDocument } from "./resume-document-model";

const execFileAsync = promisify(execFile);

export interface AtsValidationResult {
  isValid: boolean;
  score: number;
  expectedOrder: string[];
  detectedOrder: string[];
  issues: string[];
  extractedTextSample: string;
}

/**
 * Extracts linear text from a compiled PDF using pdftotext if available,
 * with pdfjs-dist fallback ensuring 100% platform portability.
 */
export async function extractLinearPdfText(pdfBuffer: Buffer): Promise<string> {
  // 1. Attempt system pdftotext
  try {
    const tmpPdf = path.join(os.tmpdir(), `resume-ats-${randomUUID()}.pdf`);
    const tmpTxt = path.join(os.tmpdir(), `resume-ats-${randomUUID()}.txt`);
    await writeFile(tmpPdf, pdfBuffer);

    await execFileAsync("pdftotext", ["-layout", tmpPdf, tmpTxt]);
    const { readFile } = await import("node:fs/promises");
    const text = await readFile(tmpTxt, "utf8");

    await Promise.all([unlink(tmpPdf).catch(() => {}), unlink(tmpTxt).catch(() => {})]);
    if (text && text.trim().length > 20) {
      return text;
    }
  } catch {
    // pdftotext not available on system PATH; fallback to pdfjs-dist
  }

  // 2. Fallback: Pure Node pdfjs-dist text extraction
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const uint8 = new Uint8Array(pdfBuffer);
    const doc = await pdfjs.getDocument({ data: uint8, isEvalSupported: false }).promise;

    const pageTexts: string[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const items = textContent.items as Array<{ str?: string; transform?: number[] }>;

      // Sort items top-to-bottom (Y descending), then left-to-right (X ascending)
      const sorted = [...items].sort((a, b) => {
        const yA = a.transform ? a.transform[5] : 0;
        const yB = b.transform ? b.transform[5] : 0;
        if (Math.abs(yA - yB) > 3) {
          return yB - yA;
        }
        const xA = a.transform ? a.transform[4] : 0;
        const xB = b.transform ? b.transform[4] : 0;
        return xA - xB;
      });

      const lineStrings = sorted
        .map((item) => (item.str || "").trim())
        .filter(Boolean);

      pageTexts.push(lineStrings.join(" "));
    }

    return pageTexts.join("\n\n");
  } catch (err) {
    // Basic fallback: extract raw text streams from PDF buffer
    const rawPdf = pdfBuffer.toString("binary");
    const streamMatches = rawPdf.match(/\(([^)]+)\)\s*Tj/g) || [];
    return streamMatches.map((m) => m.replace(/[()]/g, "").replace(/\s*Tj$/, "")).join(" ");
  }
}

/**
 * Validates that linear text matches the expected chronological schema field sequence.
 */
export function validateAtsReadingOrder(
  linearText: string,
  rawModel: ResumeDocumentModel,
): AtsValidationResult {
  const model = normalizeResumeDocument(rawModel);
  const issues: string[] = [];
  const lowerText = linearText.toLowerCase();

  const sectionsToCheck: { name: string; anchorText: string }[] = [];

  // 1. Contact / Name
  if (model.personalInfo.fullName) {
    sectionsToCheck.push({
      name: "Contact / Full Name",
      anchorText: model.personalInfo.fullName.toLowerCase().replace(/_/g, " "),
    });
  }

  // 2. Summary
  if (model.summary && model.summary.length > 20) {
    sectionsToCheck.push({
      name: "Professional Summary",
      anchorText: model.summary.slice(0, 30).toLowerCase(),
    });
  }

  // 3. Work Experience
  if (model.experience.length > 0) {
    sectionsToCheck.push({
      name: `Experience (${model.experience[0].company})`,
      anchorText: model.experience[0].company.toLowerCase(),
    });

    if (model.experience.length > 1) {
      sectionsToCheck.push({
        name: `Experience (${model.experience[1].company})`,
        anchorText: model.experience[1].company.toLowerCase(),
      });
    }
  }

  // 4. Education
  if (model.education.length > 0) {
    sectionsToCheck.push({
      name: "Education",
      anchorText: model.education[0].institution.toLowerCase(),
    });
  }

  // 5. Skills
  if (model.skills.length > 0) {
    sectionsToCheck.push({
      name: "Skills",
      anchorText: (model.sectionTitles?.skills || "skills").toLowerCase(),
    });
  }

  // 6. Projects
  if (model.projects.length > 0) {
    sectionsToCheck.push({
      name: "Projects",
      anchorText: model.projects[0].title.toLowerCase(),
    });
  }

  // 7. Extras
  if (model.extras.length > 0) {
    sectionsToCheck.push({
      name: model.extrasLabel || "Extras",
      anchorText: model.extras[0].title.toLowerCase(),
    });
  }

  // Find index positions using progressive search to avoid substring collisions
  const sectionPositions: { name: string; index: number }[] = [];
  let searchCursor = 0;

  for (const s of sectionsToCheck) {
    const idx = lowerText.indexOf(s.anchorText, searchCursor);
    if (idx !== -1) {
      sectionPositions.push({ name: s.name, index: idx });
      searchCursor = idx + s.anchorText.length;
    } else {
      // Check from 0 to see if it appeared out-of-order
      const anyIdx = lowerText.indexOf(s.anchorText);
      if (anyIdx !== -1 && anyIdx < searchCursor) {
        sectionPositions.push({ name: s.name, index: anyIdx });
        issues.push(
          `ATS reading order violation: "${s.name}" appeared earlier than expected in the linear text stream.`,
        );
      } else {
        sectionPositions.push({ name: s.name, index: -1 });
        issues.push(`Expected text anchor "${s.anchorText}" for ${s.name} was not found in compiled PDF output.`);
      }
    }
  }

  // Check monotonicity
  let lastPos = -1;
  for (let i = 0; i < sectionPositions.length; i++) {
    const curr = sectionPositions[i];
    if (curr.index !== -1) {
      if (curr.index < lastPos) {
        issues.push(
          `ATS reading order violation: "${curr.name}" appeared before a preceding section in the linear text stream.`,
        );
      }
      lastPos = curr.index;
    }
  }

  const expectedOrder = sectionsToCheck.map((s) => s.name);
  const detectedOrder = [...sectionPositions]
    .filter((p) => p.index !== -1)
    .sort((a, b) => a.index - b.index)
    .map((p) => p.name);

  let score = 100;
  if (issues.length > 0) {
    score = Math.max(20, 100 - issues.length * 20);
  }

  return {
    isValid: issues.length === 0,
    score,
    expectedOrder,
    detectedOrder,
    issues,
    extractedTextSample: linearText.slice(0, 500),
  };
}
