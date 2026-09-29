import fs from "node:fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const SECTION_SYNONYMS = {
  summary: "summary",
  "professional summary": "summary",
  "career summary": "summary",
  profile: "summary",
  "career objective": "summary",
  objective: "summary",
  "about me": "summary",
  overview: "summary",
  "personal statement": "summary",
  experience: "experience",
  "work experience": "experience",
  "professional experience": "experience",
  "employment history": "experience",
  "work history": "experience",
  career: "experience",
  "job history": "experience",
  internships: "experience",
  internship: "experience",
  education: "education",
  "educational background": "education",
  "academic background": "education",
  qualifications: "education",
  academics: "education",
  "academic history": "education",
  skills: "skills",
  "technical skills": "skills",
  "core competencies": "skills",
  competencies: "skills",
  technologies: "skills",
  "key skills": "skills",
  expertise: "skills",
  "skills & technologies": "skills",
  "tools & technologies": "skills",
  "languages & frameworks": "skills",
  projects: "projects",
  "personal projects": "projects",
  "open source": "projects",
  "open-source projects": "projects",
  "side projects": "projects",
  portfolio: "projects",
  "notable projects": "projects",
  certifications: "certifications",
  certificates: "certifications",
  "licenses & certifications": "certifications",
  "professional certifications": "certifications",
  "licenses and certifications": "certifications",
  achievements: "achievements",
  "achievements & activities": "achievements",
  "honors & awards": "achievements",
  "awards & recognition": "achievements",
  "awards & honors": "achievements",
  "awards and honors": "achievements",
  awards: "achievements",
  honors: "achievements",
  recognition: "achievements",
  activities: "achievements",
  "volunteer experience": "achievements",
  publications: "achievements",
  "extracurricular activities": "achievements",
  contact: "header",
  "contact info": "header",
  "contact details": "header",
  "contact information": "header",
  header: "header",
};

const BULLET_RE = /^[\u2022\u2023\u25E6\u2043\u2219\u25CF\u25CB\u2013•\-*>●▸▷•]\s*/;
const DATE_PATTERN =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b|\b(?:19|20)\d{2}\b|present|current/i;

function detectColumnSplit(items, pageWidth) {
  if (items.length < 12) return null;
  const boxes = items.map((it) => {
    const x = it.transform[4];
    return {
      x,
      right: x + Math.max(it.width, 1),
      width: it.width,
      baselineY: it.transform[5],
    };
  });
  const maxBaselineY = Math.max(...boxes.map((b) => b.baselineY));
  const bodyBoxes = boxes.filter(
    (b) => !(b.baselineY > maxBaselineY - 80 && b.width > pageWidth * 0.45),
  );
  if (bodyBoxes.length < 10) return null;

  let bestSplitX = null;
  let minCrossing = Infinity;
  let maxSeparation = 0;
  const step = 4;
  const startX = Math.round(pageWidth * 0.20);
  const endX = Math.round(pageWidth * 0.75);

  for (let candX = startX; candX <= endX; candX += step) {
    let leftCount = 0;
    let rightCount = 0;
    let crossingCount = 0;
    let maxLeftEdge = 0;
    let minRightEdge = pageWidth;

    for (const b of bodyBoxes) {
      if (b.right <= candX + 4) {
        leftCount++;
        if (b.right > maxLeftEdge) maxLeftEdge = b.right;
      } else if (b.x >= candX - 4) {
        rightCount++;
        if (b.x < minRightEdge) minRightEdge = b.x;
      } else {
        crossingCount++;
      }
    }

    const total = bodyBoxes.length;
    if (leftCount / total >= 0.15 && rightCount / total >= 0.20) {
      const separation = Math.max(0, minRightEdge - maxLeftEdge);
      if (
        crossingCount < minCrossing ||
        (crossingCount === minCrossing && separation > maxSeparation)
      ) {
        minCrossing = crossingCount;
        maxSeparation = separation;
        bestSplitX = candX;
      }
    }
  }

  if (
    bestSplitX !== null &&
    (minCrossing <= 2 || minCrossing / bodyBoxes.length <= 0.03)
  ) {
    return bestSplitX;
  }
  return null;
}

function groupByBaseline(items) {
  const grouped = new Map();
  for (const item of items) {
    const [, , , , x, baselineY] = item.transform;
    const existingY = [...grouped.keys()].find((k) => Math.abs(k - baselineY) <= 3);
    const key = existingY ?? baselineY;
    grouped.set(key, [...(grouped.get(key) ?? []), { ...item, x }]);
  }
  return grouped;
}

function joinItems(items) {
  return items.reduce((acc, item, idx) => {
    if (idx === 0) return item.str;
    const prev = items[idx - 1];
    const gap = item.x - (prev.x + prev.width);
    const sep = gap > 2 ? " " : "";
    return acc + sep + item.str;
  }, "");
}

function buildLinesFromGroup(items, pageNum, viewportHeight, column) {
  const grouped = groupByBaseline(items);
  const lines = [];

  for (const [, lineItems] of [...grouped.entries()].sort(([a], [b]) => b - a)) {
    const sorted = lineItems.sort((a, b) => a.x - b.x);
    const text = joinItems(sorted);
    if (!text.trim()) continue;

    const first = sorted[0];
    const fontSize = first.height || 10;
    const isBold = /bold/i.test(first.fontName || "");

    lines.push({
      text: text.trim(),
      x: first.x,
      y: Math.max(viewportHeight - first.transform[5], 0),
      page: pageNum,
      width: Math.max(...sorted.map((it) => it.x + it.width)) - first.x,
      height: Math.max(fontSize * 1.2, ...sorted.map((it) => it.height)),
      fontSize,
      fontWeight: isBold ? 700 : 400,
      isBold,
      isAllCaps: text.trim() === text.trim().toUpperCase() && /[A-Z]{2,}/.test(text.trim()),
      isBullet: BULLET_RE.test(text.trim()),
      column,
    });
  }

  return lines;
}

function detectSectionHeading(line, avgFontSize) {
  const text = line.text.trim().toLowerCase().replace(/[:\-–—]+$/, "").trim();
  const canonical = SECTION_SYNONYMS[text];
  if (canonical && canonical !== "header") return canonical;

  if (!line.isBullet && text.length <= 45 && (line.isBold || line.isAllCaps || line.fontSize > avgFontSize * 1.05)) {
    for (const [key, val] of Object.entries(SECTION_SYNONYMS)) {
      if (val !== "header" && (text === key || text.startsWith(key + " ") || text.endsWith(" " + key))) {
        return val;
      }
    }
  }
  return null;
}

function groupIntoSections(lines) {
  const sections = [];
  const unassigned = [];
  let currentSection = {
    canonicalKey: "header",
    label: "Header",
    lines: [],
  };

  const avgFontSize = lines.reduce((s, l) => s + l.fontSize, 0) / Math.max(lines.length, 1);

  for (const line of lines) {
    const canonical = detectSectionHeading(line, avgFontSize);
    if (canonical) {
      if (currentSection && currentSection.lines.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { canonicalKey: canonical, label: line.text.trim(), lines: [] };
    } else {
      if (currentSection) {
        currentSection.lines.push(line);
      } else {
        unassigned.push(line);
      }
    }
  }

  if (currentSection && currentSection.lines.length > 0) {
    sections.push(currentSection);
  }

  return { sections, unassigned };
}

async function run() {
  const filePath = "C:/Users/thava/.gemini/antigravity-ide/brain/7c7e821c-f25f-4bde-ab21-564e38883cbf/.user_uploaded/media_1790678843171.pdf";
  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdf = await pdfjs.getDocument({ data }).promise;

  const allLines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items.filter((it) => it.str && it.str.trim().length > 0);
    const split = detectColumnSplit(items, viewport.width);
    if (split !== null) {
      const maxY = Math.max(...items.map((it) => it.transform[5]));
      const headerThreshold = maxY - 75;
      const headerItems = items.filter(
        (it) =>
          it.transform[5] >= headerThreshold &&
          it.transform[4] < split &&
          it.transform[4] + it.width > split + 15,
      );
      const leftItems = items.filter(
        (it) => !headerItems.includes(it) && it.transform[4] + it.width * 0.5 <= split,
      );
      const rightItems = items.filter(
        (it) => !headerItems.includes(it) && it.transform[4] + it.width * 0.5 > split,
      );

      const headerLines = buildLinesFromGroup(headerItems, p, viewport.height, 0);
      const leftLines = buildLinesFromGroup(leftItems, p, viewport.height, 0);
      const rightLines = buildLinesFromGroup(rightItems, p, viewport.height, 0);
      allLines.push(...headerLines, ...leftLines, ...rightLines);
    } else {
      allLines.push(...buildLinesFromGroup(items, p, viewport.height, 0));
    }
  }

  console.log(`Total extracted lines: ${allLines.length}`);
  const { sections, unassigned } = groupIntoSections(allLines);
  console.log(`Sections detected (${sections.length}):`);
  for (const s of sections) {
    console.log(`\n=== Section: [${s.canonicalKey}] "${s.label}" (${s.lines.length} lines) ===`);
    for (const l of s.lines) {
      console.log(`  - "${l.text}" (bold=${l.isBold}, caps=${l.isAllCaps}, size=${l.fontSize.toFixed(1)})`);
    }
  }
}

run().catch(console.error);
