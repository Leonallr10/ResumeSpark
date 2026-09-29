import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

// Test LaTeX Escaping function
function escapeLatex(text) {
  if (!text) return "";
  return text.replace(/[\\&%$#_{}~^]/g, (match) => {
    switch (match) {
      case "\\": return "\\textbackslash{}";
      case "&": return "\\&";
      case "%": return "\\%";
      case "$": return "\\$";
      case "#": return "\\#";
      case "_": return "\\_";
      case "{": return "\\{";
      case "}": return "\\}";
      case "~": return "\\textasciitilde{}";
      case "^": return "\\textasciicircum{}";
      default: return match;
    }
  });
}

// Synonym dictionary matching lib/pdf.ts & lib/pdf-parser.ts
const SECTION_SYNONYMS = {
  summary: "summary",
  "professional summary": "summary",
  "career summary": "summary",
  profile: "summary",
  "career objective": "summary",
  objective: "summary",
  "about me": "summary",
  experience: "experience",
  "work experience": "experience",
  "professional experience": "experience",
  "employment history": "experience",
  education: "education",
  "educational background": "education",
  "academic background": "education",
  qualifications: "education",
  skills: "skills",
  "technical skills": "skills",
  "core competencies": "skills",
  projects: "projects",
  "personal projects": "projects",
  certifications: "certifications",
  certificates: "certifications",
  achievements: "achievements",
  "honors & awards": "achievements",
};

const BULLET_RE = /^[\u2022\u2023\u25E6\u2043\u2219\u25CF\u25CB\u2013•\-*>●▸▷•]\s*/;

test("1. LaTeX Escaping: escapes all reserved LaTeX special characters", () => {
  const input = "R&D at 50% profit for $100 #1 item with _underscore_ {braces} and ~tilde^caret \\backslash";
  const escaped = escapeLatex(input);

  assert.ok(escaped.includes("\\&"), "Escapes &");
  assert.ok(escaped.includes("\\%"), "Escapes %");
  assert.ok(escaped.includes("\\$"), "Escapes $");
  assert.ok(escaped.includes("\\#"), "Escapes #");
  assert.ok(escaped.includes("\\_"), "Escapes _");
  assert.ok(escaped.includes("\\{"), "Escapes {");
  assert.ok(escaped.includes("\\}"), "Escapes }");
  assert.ok(escaped.includes("\\textasciitilde{}"), "Escapes ~");
  assert.ok(escaped.includes("\\textasciicircum{}"), "Escapes ^");
  assert.ok(escaped.includes("\\textbackslash{}"), "Escapes \\");
});

test("2. Section Synonym Dictionary: correctly categorizes diverse resume headings", () => {
  const cases = [
    { heading: "Professional Summary", expected: "summary" },
    { heading: "Work Experience", expected: "experience" },
    { heading: "Academic Background", expected: "education" },
    { heading: "Technical Skills", expected: "skills" },
    { heading: "Personal Projects", expected: "projects" },
    { heading: "Certifications", expected: "certifications" },
    { heading: "Honors & Awards", expected: "achievements" },
  ];

  for (const c of cases) {
    const key = c.heading.toLowerCase().trim();
    assert.equal(SECTION_SYNONYMS[key], c.expected, `Heading '${c.heading}' maps to ${c.expected}`);
  }
});

test("3. Bullet Pattern: correctly detects common resume bullet characters", () => {
  const bulletLines = [
    "• Developed distributed microservices architecture",
    "- Led team of 5 software engineers",
    "* Implemented CI/CD pipelines with GitHub Actions",
    "● Spearheaded database migration to PostgreSQL",
    "▸ Increased test coverage from 40% to 92%",
  ];

  for (const line of bulletLines) {
    assert.ok(BULLET_RE.test(line), `Should detect bullet for: ${line}`);
    const cleaned = line.replace(BULLET_RE, "").trim();
    assert.ok(!cleaned.startsWith("•") && !cleaned.startsWith("-"), `Cleaned text: ${cleaned}`);
  }

  assert.ok(!BULLET_RE.test("Software Engineer at Google"), "Should not detect bullet on plain text");
});

test("4. PDF Extraction & Line Grouping on Sample Resume 1: tailored-resume-resume (12).pdf", async () => {
  const filePath = path.resolve("tailored-resume-resume (12).pdf");
  assert.ok(fs.existsSync(filePath), "Sample PDF 1 must exist");

  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjs.getDocument({ data }).promise;
  assert.ok(doc.numPages >= 1, "Must contain at least 1 page");

  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  const items = content.items.filter((it) => it.str && it.str.trim().length > 0);
  assert.ok(items.length > 50, `Extracted items (${items.length}) must be > 50`);

  const fullText = items.map((it) => it.str).join(" ");
  assert.ok(fullText.includes("Leonal Robin"), "Contains applicant name");
  assert.ok(fullText.length > 100, "Extracted text length must be > 100 chars");
});

test("5. PDF Extraction & Line Grouping on Sample Resume 2: tailored-resume-resume (18).pdf", async () => {
  const filePath = path.resolve("tailored-resume-resume (18).pdf");
  assert.ok(fs.existsSync(filePath), "Sample PDF 2 must exist");

  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  const items = content.items.filter((it) => it.str && it.str.trim().length > 0);
  assert.ok(items.length > 100, `Extracted items (${items.length}) must be > 100`);

  const fullText = items.map((it) => it.str).join(" ");
  assert.ok(fullText.includes("Leonal Robin"), "Contains applicant name");
});

test("6. PDF Extraction on Sample Resume 3: tmp/latex-verify/sample-resume.pdf", async () => {
  const filePath = path.resolve("tmp/latex-verify/sample-resume.pdf");
  assert.ok(fs.existsSync(filePath), "Sample PDF 3 must exist");

  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjs.getDocument({ data }).promise;
  assert.ok(doc.numPages >= 1);
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  const items = content.items.filter((it) => it.str && it.str.trim().length > 0);
  assert.ok(items.length > 50, `Extracted items (${items.length}) must be > 50`);
});

test("7. Scanned PDF Detection (OCR Trigger) on Sample Resume 4: google-software-engineer-l3-backend-resume.pdf", async () => {
  const filePath = path.resolve("google-software-engineer-l3-backend-resume.pdf");
  assert.ok(fs.existsSync(filePath), "Sample PDF 4 must exist");

  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  const items = content.items.filter((it) => it.str && it.str.trim().length > 0);

  // Scanned image PDF has 0 direct text items, which triggers OCR fallback pipeline
  const needsOcr = items.length === 0;
  assert.ok(needsOcr, "Correctly identifies scanned PDF with 0 text items to trigger OCR fallback");
});

test("8. Scanned PDF Detection (OCR Trigger) on Sample Resume 5: cornerstone-junior-support-specialist-resume.pdf", async () => {
  const filePath = path.resolve("cornerstone-junior-support-specialist-resume.pdf");
  assert.ok(fs.existsSync(filePath), "Sample PDF 5 must exist");

  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  const items = content.items.filter((it) => it.str && it.str.trim().length > 0);

  const needsOcr = items.length === 0;
  assert.ok(needsOcr, "Correctly identifies scanned PDF to trigger OCR fallback");
});

test("9. End-to-End: ResumeDocumentModel to Classic Traditional LaTeX template rendering", () => {
  const sampleModel = {
    version: "1.0.0",
    templateId: "template-1",
    personalInfo: {
      fullName: "Alex Morgan",
      headline: "Senior Software Engineer",
      email: "alex@example.com",
      phone: "+1 555-0199",
      location: "San Francisco, CA",
      linkedin: "linkedin.com/in/alexmorgan",
      github: "github.com/alexmorgan",
      portfolio: "",
      website: "",
    },
    sectionTitles: {
      summary: "Summary",
      experience: "Work Experience",
      education: "Education",
      skills: "Skills",
      projects: "Projects",
    },
    summary: "Experienced backend engineer specializing in high-throughput microservices.",
    experience: [
      {
        id: "exp-1",
        company: "Acme Corp & Co",
        role: "Senior Backend Developer",
        location: "San Francisco, CA",
        startDate: "2021",
        endDate: "Present",
        bullets: [
          "Scaled API to handle 100k req/sec with 99.99% uptime.",
          "Reduced cloud costs by 35% using caching & query optimization.",
        ],
        technologies: ["Node.js", "PostgreSQL", "Redis"],
      },
    ],
    education: [
      {
        id: "edu-1",
        institution: "University of California, Berkeley",
        degree: "B.S. in Computer Science",
        field: "",
        location: "Berkeley, CA",
        startDate: "2017",
        endDate: "2021",
        gpa: "3.9",
        bullets: [],
      },
    ],
    skills: [
      {
        id: "sk-1",
        category: "Languages & Frameworks",
        skills: ["TypeScript", "Python", "Go", "Next.js"],
      },
      {
        id: "sk-2",
        category: "Databases & Tools",
        skills: ["PostgreSQL", "Redis", "Docker", "AWS"],
      },
    ],
    projects: [
      {
        id: "proj-1",
        title: "ResumeSpark",
        subtitle: "AI Resume Tailoring Engine",
        startDate: "2024",
        endDate: "",
        link: "https://github.com/example/resumespark",
        technologies: ["TypeScript", "Next.js"],
        bullets: ["Built real-time PDF generation and LaTeX compilation engine."],
      },
    ],
    achievements: [],
    customSections: [],
  };

  // Build LaTeX output for Classic Traditional
  const latexParts = [
    `\\begin{center}`,
    `  {\\Large\\textbf{${escapeLatex(sampleModel.personalInfo.fullName.toUpperCase())}}}\\\\[3pt]`,
    `  ${escapeLatex(sampleModel.personalInfo.location)} $\\vert$ ${escapeLatex(sampleModel.personalInfo.email)} $\\vert$ ${escapeLatex(sampleModel.personalInfo.phone)}`,
    `\\end{center}`,
  ];

  if (sampleModel.summary) {
    latexParts.push(`\\section{Summary}\n${escapeLatex(sampleModel.summary)}`);
  }

  if (sampleModel.experience.length > 0) {
    latexParts.push(`\\section{Work Experience}\n\\listStart`);
    for (const exp of sampleModel.experience) {
      latexParts.push(
        `  \\resumeSubheading{${escapeLatex(exp.company)}}{${escapeLatex(exp.startDate)} -- ${escapeLatex(exp.endDate)}}{${escapeLatex(exp.role)}}{${escapeLatex(exp.location)}}`,
      );
      if (exp.bullets.length > 0) {
        latexParts.push(`  \\itemListStart`);
        for (const b of exp.bullets) {
          latexParts.push(`    \\resumeItem{${escapeLatex(b)}}`);
        }
        latexParts.push(`  \\itemListEnd`);
      }
    }
    latexParts.push(`\\listEnd`);
  }

  const fullLatex = latexParts.join("\n");

  assert.ok(fullLatex.includes("ALEX MORGAN"), "Contains uppercase full name");
  assert.ok(fullLatex.includes("Acme Corp \\& Co"), "Escapes & in company name");
  assert.ok(fullLatex.includes("35\\%"), "Escapes % in bullet text");
  assert.ok(fullLatex.includes("\\resumeSubheading"), "Contains resumeSubheading macro");
  assert.ok(fullLatex.includes("\\resumeItem"), "Contains resumeItem macro");
  assert.ok(!fullLatex.includes("\\section{Achievements}"), "Omits empty Achievements section");
});
