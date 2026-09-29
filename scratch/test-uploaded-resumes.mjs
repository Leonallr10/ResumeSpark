import fs from "node:fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const SECTION_SYNONYMS = {
  // summary
  summary: "summary",
  "professional summary": "summary",
  "career summary": "summary",
  profile: "summary",
  "career objective": "summary",
  objective: "summary",
  "about me": "summary",
  overview: "summary",
  "personal statement": "summary",
  // experience
  experience: "experience",
  "work experience": "experience",
  "professional experience": "experience",
  "employment history": "experience",
  "work history": "experience",
  career: "experience",
  "job history": "experience",
  internships: "experience",
  internship: "experience",
  // education
  education: "education",
  "educational background": "education",
  "academic background": "education",
  qualifications: "education",
  academics: "education",
  "academic history": "education",
  // skills
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
  // projects
  projects: "projects",
  "personal projects": "projects",
  "open source": "projects",
  "open-source projects": "projects",
  "side projects": "projects",
  portfolio: "projects",
  "notable projects": "projects",
  // certifications
  certifications: "certifications",
  certificates: "certifications",
  "licenses & certifications": "certifications",
  "professional certifications": "certifications",
  "licenses and certifications": "certifications",
  // achievements
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
  // contact (header)
  contact: "header",
  "contact info": "header",
  "contact details": "header",
  "contact information": "header",
  header: "header",
};

const BULLET_RE = /^[\u2022\u2023\u25E6\u2043\u2219\u25CF\u25CB\u2013•\-*>●▸▷•]\s*/;

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

function buildLines(items, pageNum, viewportHeight, col) {
  const grouped = groupByBaseline(items);
  const lines = [];
  for (const [, lineItems] of [...grouped.entries()].sort(([a], [b]) => b - a)) {
    const sorted = lineItems.sort((a, b) => a.x - b.x);
    const text = joinItems(sorted).trim();
    if (!text) continue;
    const first = sorted[0];
    const fontSize = first.height || 10;
    lines.push({
      text,
      x: first.x,
      y: Math.max(viewportHeight - first.transform[5], 0),
      fontSize,
      isBold: /bold/i.test(first.fontName || ""),
      isAllCaps: text === text.toUpperCase() && /[A-Z]{2,}/.test(text),
      isBullet: BULLET_RE.test(text),
      column: col,
    });
  }
  return lines;
}

async function testPdf(pdfPath) {
  console.log("=== Testing:", pdfPath);
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjs.getDocument({ data }).promise;
  console.log("Pages:", pdf.numPages);

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items.filter((it) => it.str && it.str.trim().length > 0);
    console.log(`Page ${p} has ${items.length} text items, width: ${viewport.width}, height: ${viewport.height}`);

    const split = detectColumnSplit(items, viewport.width);
    console.log(`Column split: ${split}`);

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

      console.log(`Header items: ${headerItems.length}, Left items: ${leftItems.length}, Right items: ${rightItems.length}`);

      const headerLines = buildLines(headerItems, p, viewport.height, 0);
      const leftLines = buildLines(leftItems, p, viewport.height, 0);
      const rightLines = buildLines(rightItems, p, viewport.height, 1);

      console.log("\n--- HEADER LINES ---");
      headerLines.forEach(l => console.log(`[${l.column}] ${l.text}`));

      console.log("\n--- LEFT LINES (first 15) ---");
      leftLines.slice(0, 15).forEach(l => console.log(`[${l.column}] (size ${l.fontSize}) ${l.text}`));

      console.log("\n--- RIGHT LINES (first 15) ---");
      rightLines.slice(0, 15).forEach(l => console.log(`[${l.column}] (size ${l.fontSize}) ${l.text}`));
    } else {
      const lines = buildLines(items, p, viewport.height, 0);
      console.log("\n--- SINGLE COLUMN LINES (first 25) ---");
      lines.slice(0, 25).forEach(l => console.log(`(size ${l.fontSize}) ${l.text}`));
    }
  }
}

async function main() {
  const p1 = 'C:/Users/thava/.gemini/antigravity-ide/brain/7c7e821c-f25f-4bde-ab21-564e38883cbf/.user_uploaded/media_1790678843171.pdf';
  const p2 = 'C:/Users/thava/.gemini/antigravity-ide/brain/7c7e821c-f25f-4bde-ab21-564e38883cbf/.user_uploaded/media_1790678881374.pdf';
  await testPdf(p1);
  await testPdf(p2);
}

main().catch(console.error);
