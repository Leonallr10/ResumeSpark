/**
 * lib/resume-extract.ts
 *
 * Unified text extraction for PDF, DOCX, and image files.
 * Pipeline Step 1, 2, 3 of the "any resume in → my template out" pipeline.
 *
 * PDF   → pdfjs-dist legacy with multi-column split detection
 * DOCX  → mammoth
 * Image → base64 payload for vision-model OCR
 */

// ─────────────────────────── Types ────────────────────────────

export type SupportedMimeType =
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "application/msword"
  | "image/jpeg"
  | "image/jpg"
  | "image/png"
  | "image/webp";

const SUPPORTED_TYPES: SupportedMimeType[] = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

const IMAGE_TYPES: SupportedMimeType[] = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export function isSupportedType(mimeType: string): mimeType is SupportedMimeType {
  return (SUPPORTED_TYPES as string[]).includes(mimeType);
}

export function isImageType(mimeType: string): boolean {
  return (IMAGE_TYPES as string[]).includes(mimeType);
}

// ─────────────────────────── PDF Extraction (Node) ────────────────────────────

/**
 * Extract plain text from a PDF buffer in Node.js, preserving reading order
 * and handling multi-column layouts.
 */
export async function extractPdfText(buffer: Buffer): Promise<{ text: string; pages: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const path = await import("path");
  const { pathToFileURL } = await import("url");
  const workerPath = path.resolve(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items = (tc.items as Array<{ str?: string; transform?: number[]; width?: number }>).filter(
      (i): i is { str: string; transform: number[]; width: number } =>
        typeof i.str === "string" && i.str.trim().length > 0 && Array.isArray(i.transform),
    );

    if (items.length === 0) continue;

    // Detect column split if page has 2-column layout (scan 20% to 75% width)
    const gutterLeft = vp.width * 0.2;
    const gutterRight = vp.width * 0.75;
    let bestSplitX: number | null = null;
    let minCrossing = Infinity;

    for (let x = gutterLeft; x <= gutterRight; x += 4) {
      const crossing = items.filter(
        (it) => it.transform[4] < x && it.transform[4] + it.width > x,
      ).length;
      if (crossing < minCrossing) {
        minCrossing = crossing;
        bestSplitX = x;
      }
    }

    const sortGroup = (group: typeof items): string => {
      const sorted = [...group].sort((a, b) => {
        const yDiff = b.transform[5] - a.transform[5];
        if (Math.abs(yDiff) > 3) return yDiff;
        return a.transform[4] - b.transform[4];
      });

      let res = "";
      let lastY: number | null = null;
      for (const it of sorted) {
        if (lastY !== null && Math.abs(lastY - it.transform[5]) > 3) {
          res += "\n";
        } else if (res.length > 0 && !res.endsWith("\n")) {
          res += " ";
        }
        res += it.str.trim();
        lastY = it.transform[5];
      }
      return res;
    };

    const leftItems = bestSplitX ? items.filter((it) => it.transform[4] + it.width * 0.5 <= bestSplitX!) : [];
    const rightItems = bestSplitX ? items.filter((it) => it.transform[4] + it.width * 0.5 > bestSplitX!) : [];
    const isMultiColumn =
      bestSplitX !== null &&
      (minCrossing <= 2 || minCrossing / items.length <= 0.03) &&
      leftItems.length >= items.length * 0.15 &&
      rightItems.length >= items.length * 0.15;

    if (isMultiColumn && bestSplitX !== null) {
      const maxY = Math.max(...items.map((it) => it.transform[5]));
      const headerThreshold = maxY - 75;
      const headerItems = items.filter(
        (it) =>
          it.transform[5] >= headerThreshold &&
          it.transform[4] < bestSplitX! &&
          it.transform[4] + it.width > bestSplitX! + 15,
      );
      const colLeft = items.filter(
        (it) => !headerItems.includes(it) && it.transform[4] + it.width * 0.5 <= bestSplitX!,
      );
      const colRight = items.filter(
        (it) => !headerItems.includes(it) && it.transform[4] + it.width * 0.5 > bestSplitX!,
      );

      const headerText = headerItems.length > 0 ? sortGroup(headerItems) : "";
      const leftText = sortGroup(colLeft);
      const rightText = sortGroup(colRight);

      pageTexts.push([headerText, leftText, rightText].filter(Boolean).join("\n\n"));
    } else {
      pageTexts.push(sortGroup(items));
    }
  }

  return {
    text: pageTexts.join("\n\n"),
    pages: doc.numPages,
  };
}

// ─────────────────────────── DOCX Extraction (Node) ────────────────────────────

/**
 * Extract plain text from a DOCX buffer using mammoth.
 * Call this only in a Node.js server context.
 */
export async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

// ─────────────────────────── Text Cleaning ─────────────────────────────────

/**
 * Step 2: Strip headers, footers, page numbers, and normalise whitespace.
 */
export function cleanExtractedText(raw: string): string {
  return raw
    // Remove standalone page numbers (e.g. "Page 1 of 3", "Page 1 / 3", or just "1" on its own line)
    .replace(/^\s*Page\s+\d+\s*(?:of|\/)\s*\d+\s*$/gim, "")
    .replace(/^\s*\d{1,3}\s*$/gim, "")
    // Collapse runs of 3+ blank lines to 2
    .replace(/\n{3,}/g, "\n\n")
    // Normalise tabs / non-breaking spaces
    .replace(/\t/g, " ")
    .replace(/\u00a0/g, " ")
    // Collapse horizontal whitespace
    .replace(/ {2,}/g, " ")
    .trim();
}

// ─────────────────────────── Regex Contact Pass ────────────────────────────

export type RegexContacts = {
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  portfolio: string;
};

/**
 * Step 3: Pull contact fields directly from text with regex so they are
 * never hallucinated by the LLM.
 */
export function extractContactsViaRegex(text: string): RegexContacts {
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  const phoneMatch = text.match(/(?:\+?\d[\d\s\-().]{7,}\d)/);
  const linkedinMatch = text.match(/(?:https?:\/\/(?:www\.)?linkedin\.com\/in\/[\w-]+|linkedin\.com\/in\/[\w-]+|\bin\/[\w-]+)/i);
  const githubMatch = text.match(/(?:https?:\/\/(?:www\.)?github\.com\/[\w-]+(?:\/[\w-]+)?|github\.com\/[\w-]+(?:\/[\w-]+)?)/i);
  const portfolioMatch = text.match(/(?:https?:\/\/)?[\w.-]+\.(?:vercel\.app|github\.io|netlify\.app|tech|dev|me|io)\b/i);

  let linkedin = linkedinMatch?.[0] ?? "";
  if (linkedin.startsWith("in/")) {
    linkedin = `linkedin.com/${linkedin}`;
  }

  return {
    email: emailMatch?.[0] ?? "",
    phone: phoneMatch?.[0]?.trim() ?? "",
    linkedin,
    github: githubMatch?.[0] ?? "",
    portfolio: portfolioMatch?.[0] ?? "",
  };
}

// ─────────────────────────── Garbled text detection ────────────────────────

/** Returns true if the extracted text is too short or likely garbled/scanned. */
export function isTextGarbledOrEmpty(text: string): boolean {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length < 200) return true;
  // High non-ASCII ratio suggests garbled encoding
  const nonAscii = (clean.match(/[^\x20-\x7E]/g) ?? []).length;
  if (nonAscii / clean.length > 0.2) return true;
  return false;
}
