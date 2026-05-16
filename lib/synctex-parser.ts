export type SynctexRect = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SynctexElement = {
  page: number;
  line: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SynctexMapping = {
  forwardMap: Map<number, SynctexRect[]>;
  pageElements: SynctexElement[];
};

type Preamble = {
  magnification: number;
  unit: number;
  xOffset: number;
  yOffset: number;
  pageHeight: number;
};

const DEFAULT_UNIT = 1;
const DEFAULT_MAGNIFICATION = 1000;
const SP_PER_PT = 65536;

export function parseSynctex(raw: string): SynctexMapping {
  const lines = raw.split("\n");
  const preamble = parsePreamble(lines);
  const scale = (preamble.unit / SP_PER_PT) * (1000 / preamble.magnification);

  const forwardMap = new Map<number, SynctexRect[]>();
  const pageElements: SynctexElement[] = [];

  let currentPage = 0;
  let i = 0;

  // Skip to content section
  while (i < lines.length && !lines[i].startsWith("Content:")) {
    i++;
  }
  i++;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("{")) {
      currentPage = parseInt(line.slice(1), 10) || currentPage;
    } else if (line.startsWith("[") || line.startsWith("(")) {
      const el = parseBoxRecord(line, currentPage, scale, preamble);
      if (el) {
        pageElements.push(el);
        const existing = forwardMap.get(el.line) ?? [];
        existing.push({
          page: el.page,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
        });
        forwardMap.set(el.line, existing);
      }
    } else if (line.startsWith("h")) {
      const el = parseKernGlueRecord(line, currentPage, scale, preamble);
      if (el) {
        pageElements.push(el);
        const existing = forwardMap.get(el.line) ?? [];
        existing.push({
          page: el.page,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
        });
        forwardMap.set(el.line, existing);
      }
    }

    i++;
  }

  return { forwardMap, pageElements };
}

function parsePreamble(lines: string[]): Preamble {
  const preamble: Preamble = {
    magnification: DEFAULT_MAGNIFICATION,
    unit: DEFAULT_UNIT,
    xOffset: 0,
    yOffset: 0,
    pageHeight: 841.89,
  };

  for (const line of lines) {
    if (line.startsWith("Content:")) break;
    const [key, val] = line.split(":");
    if (!val) continue;
    const trimmedKey = key.trim().toLowerCase();
    const numVal = parseFloat(val.trim());
    if (Number.isNaN(numVal)) continue;

    if (trimmedKey === "magnification") preamble.magnification = numVal;
    else if (trimmedKey === "unit") preamble.unit = numVal;
    else if (trimmedKey === "x offset") preamble.xOffset = numVal;
    else if (trimmedKey === "y offset") preamble.yOffset = numVal;
  }

  return preamble;
}

// Parses vbox/hbox records like: [tag,line:x,y,w,h,d or (tag,line:x,y,w,h,d
function parseBoxRecord(
  raw: string,
  page: number,
  scale: number,
  preamble: Preamble,
): SynctexElement | null {
  // Skip the opening bracket
  const body = raw.slice(1);
  const colonIdx = body.indexOf(":");
  if (colonIdx < 0) return null;

  const tagLine = body.slice(0, colonIdx);
  const coords = body.slice(colonIdx + 1);

  const commaIdx = tagLine.indexOf(",");
  if (commaIdx < 0) return null;

  const sourceLine = parseInt(tagLine.slice(commaIdx + 1), 10);
  if (Number.isNaN(sourceLine) || sourceLine <= 0) return null;

  const parts = coords.split(",").map((s) => parseFloat(s.trim()));
  if (parts.length < 4) return null;

  const [rawX, rawY, rawW, rawH] = parts;
  const depth = parts[4] ?? 0;

  const x = rawX * scale + preamble.xOffset;
  const y = rawY * scale + preamble.yOffset;
  const width = Math.abs(rawW * scale);
  const height = Math.abs(rawH * scale) + Math.abs(depth * scale);

  if (width === 0 && height === 0) return null;

  return { page, line: sourceLine, x, y: y - Math.abs(rawH * scale), width, height };
}

// Parses horizontal kern/glue records like: htag,line:x,y
function parseKernGlueRecord(
  raw: string,
  page: number,
  scale: number,
  preamble: Preamble,
): SynctexElement | null {
  const body = raw.slice(1);
  const colonIdx = body.indexOf(":");
  if (colonIdx < 0) return null;

  const tagLine = body.slice(0, colonIdx);
  const coords = body.slice(colonIdx + 1);

  const commaIdx = tagLine.indexOf(",");
  if (commaIdx < 0) return null;

  const sourceLine = parseInt(tagLine.slice(commaIdx + 1), 10);
  if (Number.isNaN(sourceLine) || sourceLine <= 0) return null;

  const parts = coords.split(",").map((s) => parseFloat(s.trim()));
  if (parts.length < 2) return null;

  const [rawX, rawY] = parts;
  const x = rawX * scale + preamble.xOffset;
  const y = rawY * scale + preamble.yOffset;

  return { page, line: sourceLine, x, y, width: 10, height: 10 };
}

export function forwardSync(
  mapping: SynctexMapping,
  line: number,
): SynctexRect | null {
  const rects = mapping.forwardMap.get(line);
  if (rects && rects.length > 0) return rects[0];

  // Search nearby lines (within ±5) for the closest match
  for (let delta = 1; delta <= 5; delta++) {
    const above = mapping.forwardMap.get(line - delta);
    if (above && above.length > 0) return above[0];
    const below = mapping.forwardMap.get(line + delta);
    if (below && below.length > 0) return below[0];
  }

  return null;
}

export function inverseSync(
  mapping: SynctexMapping,
  page: number,
  x: number,
  y: number,
): number | null {
  const pageEls = mapping.pageElements.filter((el) => el.page === page);
  if (pageEls.length === 0) return null;

  let bestLine = pageEls[0].line;
  let bestDist = Number.MAX_VALUE;

  for (const el of pageEls) {
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const dist = (x - cx) ** 2 + (y - cy) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      bestLine = el.line;
    }
  }

  return bestLine;
}
