import fs from "node:fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const BULLET_RE = /^[\u2022\u2023\u25E6\u2043\u2219\u25CF\u25CB\u2013•\-*>●▸▷•]\s*/;
const DATE_PATTERN =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b|\b\d{1,2}\/\d{2,4}\b|\b(?:19|20)\d{2}\b|present|current/i;

function parseDateRange(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  const rangeMatch = clean.match(
    /(\d{1,2}\/\d{2,4}|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s*\d{2,4}|\b(?:19|20)\d{2}\b)\s*[-–—to]+\s*(\d{1,2}\/\d{2,4}|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s*\d{2,4}|\b(?:19|20)\d{2}\b|present|current)/i
  );
  if (rangeMatch) return { startDate: rangeMatch[1].trim(), endDate: rangeMatch[2].trim() };
  const singleDate = clean.match(/(\d{1,2}\/\d{2,4}|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s*\d{2,4}|\b(?:19|20)\d{2}\b)/i);
  if (singleDate) return { startDate: singleDate[1].trim(), endDate: "" };
  if (/present|current/i.test(clean)) return { startDate: "", endDate: "Present" };
  return { startDate: "", endDate: "" };
}

function splitCompanyAndLocation(text) {
  const commaIdx = text.lastIndexOf(",");
  if (commaIdx > 0) {
    const afterComma = text.slice(commaIdx + 1).trim();
    const beforeComma = text.slice(0, commaIdx).trim();
    const words = beforeComma.split(/\s+/);
    if (words.length > 1) {
      const city = words[words.length - 1];
      const org = words.slice(0, words.length - 1).join(" ");
      return { org, location: `${city}, ${afterComma}` };
    } else {
      return { org: beforeComma, location: afterComma };
    }
  }
  return { org: text, location: "" };
}

function parseHeader(lines) {
  const info = {
    fullName: "",
    headline: "",
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    github: "",
    portfolio: "",
    website: "",
  };

  for (let i = 0; i < lines.length; i++) {
    const text = lines[i].text.trim();
    if (!text || /^contact(?:\s+details|\s+info)?$/i.test(text)) continue;

    // 1. Full name
    if (!info.fullName) {
      if (
        i + 1 < lines.length &&
        !text.includes("@") &&
        !text.includes("+") &&
        !DATE_PATTERN.test(text)
      ) {
        const nextText = lines[i + 1].text.trim();
        const isSingleWord = (s) => /^[A-Za-z]+$/.test(s);
        if (
          isSingleWord(text) &&
          isSingleWord(nextText) &&
          !nextText.includes("@") &&
          !nextText.includes("+") &&
          !DATE_PATTERN.test(nextText)
        ) {
          info.fullName = `${text} ${nextText}`;
          i++;
          continue;
        }
      }
      if (!text.includes("@") && !text.includes("+") && !DATE_PATTERN.test(text)) {
        info.fullName = text;
        continue;
      }
    }

    // 2. Headline
    if (
      !info.headline &&
      !text.includes("@") &&
      !text.includes("+") &&
      !/linkedin|github|http/i.test(text)
    ) {
      if (/engineer|developer|architect|designer|scientist|manager|intern|specialist|student|consultant/i.test(text)) {
        info.headline = text;
        continue;
      }
    }

    // 3. Email
    const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
    if (emailMatch && !info.email) {
      info.email = emailMatch[0];
      continue;
    }

    // 4. Phone
    const phoneMatch = text.match(/(?:\+?\d[\d\s\-().]{7,}\d)/);
    if (phoneMatch && !info.phone) {
      info.phone = phoneMatch[0].trim();
      continue;
    }

    // 5. LinkedIn
    if (/linkedin/i.test(text) && !info.linkedin) {
      info.linkedin = text.includes("/") ? text.replace(/^https?:\/\//, "") : "linkedin.com/in/" + info.fullName.toLowerCase().replace(/\s+/g, "");
      continue;
    }

    // 6. GitHub
    if (/github/i.test(text) && !info.github) {
      info.github = text.includes("/") ? text.replace(/^https?:\/\//, "") : "github.com/" + info.fullName.toLowerCase().replace(/\s+/g, "");
      continue;
    }

    // 7. Portfolio
    if (/portfolio|http/i.test(text) && !info.portfolio) {
      info.portfolio = text.includes("/") ? text.replace(/^https?:\/\//, "") : "portfolio";
      continue;
    }

    // 8. Location
    if (
      !info.location &&
      !emailMatch &&
      !phoneMatch &&
      !/linkedin|github|http/i.test(text) &&
      (/[A-Z][a-z]+,?\s+[A-Z]/.test(text) || /India|USA|UK|Remote/i.test(text)) &&
      text.length < 80
    ) {
      info.location = text;
    }
  }

  return info;
}

function parseEducation(lines) {
  // If the entire section is 1 institution (<= 5 lines)
  const allText = lines.map((l) => l.text.trim());
  const dates = parseDateRange(allText.join(" "));
  const instLine = lines.find((l) => /amrita|university|institute|college|school/i.test(l.text)) || lines[0];
  const degLine = lines.find((l) => /b\.tech|bachelor|master|m\.tech|b\.s|m\.s|degree/i.test(l.text)) || lines[1];
  const locLine = lines.find((l) => l !== instLine && l !== degLine && !DATE_PATTERN.test(l.text) && /,/.test(l.text));

  let degree = degLine?.text || "";
  let field = "";
  if (degree.includes(",")) {
    const parts = degree.split(",").map((p) => p.trim());
    degree = parts[0];
    field = parts.slice(1).join(", ");
  }

  return [{
    institution: instLine?.text || "",
    degree,
    field,
    location: locLine?.text || "",
    startDate: dates.startDate,
    endDate: dates.endDate,
    bullets: [],
  }];
}

function parseGenericEntry(lines) {
  const result = {
    title: "",
    org: "",
    startDate: "",
    endDate: "",
    location: "",
    bullets: [],
    raw: lines,
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let text = line.text.trim();
    if (!text) continue;

    if (DATE_PATTERN.test(text) && !result.startDate) {
      const dates = parseDateRange(text);
      result.startDate = dates.startDate;
      result.endDate = dates.endDate;
      text = text
        .replace(/(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s*\d{2,4}/gi, "")
        .replace(/\b\d{1,2}\/\d{2,4}\b/g, "")
        .replace(/\b(?:19|20)\d{2}\b/g, "")
        .replace(/present|current/gi, "")
        .replace(/[-–—]/g, " ")
        .replace(/\(\s*\)/g, "")
        .replace(/\[\s*\]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    if (i === 0) {
      if (text.includes("|")) {
        const parts = text.split("|").map((p) => p.trim());
        result.title = parts[0];
        result.org = parts.slice(1).join(" ");
      } else {
        result.title = text.replace(BULLET_RE, "").trim();
      }
      continue;
    }

    if (i === 1 && !result.org && !line.isBullet && !BULLET_RE.test(text)) {
      // Check if line 1 starts with a verb, which means it's a project bullet, not company/location!
      if (/^(?:built|designed|engineered|developed|created|led|implemented|architected|contributed|integrated)\b/i.test(text)) {
        result.bullets.push(text);
        continue;
      }
      const split = splitCompanyAndLocation(text);
      result.org = split.org;
      result.location = split.location;
      continue;
    }

    if (line.isBullet || BULLET_RE.test(text)) {
      result.bullets.push(text.replace(BULLET_RE, "").trim());
    } else {
      result.bullets.push(text);
    }
  }

  return result;
}

function parseExperience(lines) {
  const avgFs = lines.reduce((s, l) => s + l.fontSize, 0) / lines.length;
  const groups = [];
  let current = [];

  for (const line of lines) {
    const text = line.text.trim();
    const hasDateWithWords = DATE_PATTERN.test(text) && text.replace(DATE_PATTERN, "").replace(/[-–—/()]/g, "").trim().length > 3;
    const isEntryBreak = !line.isBullet && !BULLET_RE.test(text) && (hasDateWithWords || line.isBold || line.fontSize > avgFs * 1.05);

    if (isEntryBreak && current.length > 0) {
      groups.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) groups.push(current);

  return groups.map((g) => {
    const { title, org, startDate, endDate, location, bullets } = parseGenericEntry(g);
    const roleKeywords = /engineer|developer|intern|lead|architect|manager|consultant|analyst|specialist|designer/i;
    let company = org || title;
    let role = org ? title : "";
    if (title && org && roleKeywords.test(title) && !roleKeywords.test(org)) {
      role = title;
      company = org;
    } else if (title && org && roleKeywords.test(org) && !roleKeywords.test(title)) {
      role = org;
      company = title;
    }
    return { company, role, location, startDate, endDate, bullets };
  });
}

function parseProjects(lines) {
  const avgFs = lines.reduce((s, l) => s + l.fontSize, 0) / lines.length;
  const groups = [];
  let current = [];

  for (const line of lines) {
    const text = line.text.trim();
    const hasDateWithWords = DATE_PATTERN.test(text) && text.replace(DATE_PATTERN, "").replace(/[-–—/()]/g, "").trim().length > 3;
    const isEntryBreak = !line.isBullet && !BULLET_RE.test(text) && (hasDateWithWords || line.isBold || line.fontSize > avgFs * 1.05);

    if (isEntryBreak && current.length > 0) {
      groups.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) groups.push(current);

  return groups.map((g) => {
    const { title, org, startDate, endDate, bullets } = parseGenericEntry(g);
    return { title, subtitle: org || "", startDate, endDate, bullets };
  });
}

function parseAchievements(lines) {
  const groups = [];
  let current = [];

  for (const line of lines) {
    const text = line.text.trim();
    const hasDate = DATE_PATTERN.test(text);
    if (hasDate && current.length > 0) {
      groups.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) groups.push(current);

  return groups.map((g) => {
    const fullText = g.map((l) => l.text.trim()).join(" ");
    const dates = parseDateRange(fullText);
    const titleLine = g[0].text.replace(DATE_PATTERN, "").replace(/[-–—()]/g, " ").trim();
    const details = g.slice(1).map((l) => l.text.trim()).join(" ");
    return {
      title: titleLine,
      subtitle: "",
      date: dates.startDate,
      description: details,
      bullets: details ? [details] : [],
    };
  });
}

async function main() {
  const filePath = "C:/Users/thava/.gemini/antigravity-ide/brain/7c7e821c-f25f-4bde-ab21-564e38883cbf/.user_uploaded/media_1790678843171.pdf";
  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdf = await pdfjs.getDocument({ data }).promise;

  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items = content.items.filter((it) => it.str && it.str.trim().length > 0);

  const split = 198;
  const leftItems = items.filter((it) => it.transform[4] + it.width * 0.5 <= split);
  const rightItems = items.filter((it) => it.transform[4] + it.width * 0.5 > split);

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
  function buildLines(sub, col) {
    const grouped = groupByBaseline(sub);
    const lines = [];
    for (const [, lineItems] of [...grouped.entries()].sort(([a], [b]) => b - a)) {
      const sorted = lineItems.sort((a, b) => a.x - b.x);
      const text = sorted.reduce((acc, item, idx) => {
        if (idx === 0) return item.str;
        const prev = sorted[idx - 1];
        const gap = item.x - (prev.x + prev.width);
        return acc + (gap > (item.height || 10) * 0.24 ? " " : "") + item.str;
      }, "").trim();
      if (!text) continue;
      const first = sorted[0];
      lines.push({
        text,
        x: first.x,
        y: Math.max(viewport.height - first.transform[5], 0),
        fontSize: first.height || 10,
        isBold: /bold/i.test(first.fontName || ""),
        isBullet: BULLET_RE.test(text),
        column: col,
      });
    }
    return lines;
  }

  const allLines = [...buildLines(leftItems, 0), ...buildLines(rightItems, 1)];

  // Group sections
  const SECTION_SYNONYMS = {
    summary: "summary",
    experience: "experience",
    "work experience": "experience",
    "work history": "experience",
    education: "education",
    "academic background": "education",
    skills: "skills",
    "technical skills": "skills",
    "core competencies": "skills",
    projects: "projects",
    "personal projects": "projects",
    achievements: "achievements",
    "awards & honors": "achievements",
    contact: "header",
    header: "header",
  };

  const sections = [];
  let currentSection = { canonicalKey: "header", label: "Header", lines: [] };
  const avgFontSize = allLines.reduce((s, l) => s + l.fontSize, 0) / allLines.length;

  for (const line of allLines) {
    const text = line.text.trim().toLowerCase().replace(/[:\-–—]+$/, "").trim();
    let canonical = SECTION_SYNONYMS[text] || null;
    if (!canonical && !line.isBullet && text.length <= 45 && (line.isBold || line.fontSize > avgFontSize * 1.05)) {
      for (const [key, val] of Object.entries(SECTION_SYNONYMS)) {
        if (val !== "header" && (text === key || text.startsWith(key + " ") || text.endsWith(" " + key))) {
          canonical = val;
          break;
        }
      }
    }

    if (canonical) {
      if (currentSection && currentSection.lines.length > 0) sections.push(currentSection);
      currentSection = { canonicalKey: canonical, label: line.text.trim(), lines: [] };
    } else {
      if (currentSection) currentSection.lines.push(line);
    }
  }
  if (currentSection && currentSection.lines.length > 0) sections.push(currentSection);

  const headerLines = sections.filter((s) => s.canonicalKey === "header").flatMap((s) => s.lines);
  const personalInfo = parseHeader(headerLines);
  const education = parseEducation(sections.find((s) => s.canonicalKey === "education")?.lines || []);
  const experience = parseExperience(sections.find((s) => s.canonicalKey === "experience")?.lines || []);
  const projects = parseProjects(sections.find((s) => s.canonicalKey === "projects")?.lines || []);
  const achievements = parseAchievements(sections.find((s) => s.canonicalKey === "achievements")?.lines || []);

  console.log("=== FINAL PARSED PERSONAL INFO ===");
  console.log(JSON.stringify(personalInfo, null, 2));

  console.log("\n=== FINAL PARSED EDUCATION ===");
  console.log(JSON.stringify(education, null, 2));

  console.log("\n=== FINAL PARSED EXPERIENCE ===");
  console.log(JSON.stringify(experience, null, 2));

  console.log("\n=== FINAL PARSED PROJECTS ===");
  console.log(JSON.stringify(projects, null, 2));

  console.log("\n=== FINAL PARSED ACHIEVEMENTS ===");
  console.log(JSON.stringify(achievements, null, 2));
}

main().catch(console.error);
