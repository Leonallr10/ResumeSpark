import type { ResumeDocumentModel } from "@/server/documents/resume-document-model";
import { normalizeResumeDocument } from "@/server/documents/resume-document-model";
import { TEMPLATE_SPECS, type TemplateSpec } from "./specs";

/**
 * Escapes LaTeX special characters ensuring compilable output.
 */
export function escapeLatex(text: string): string {
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

function cleanUrl(url: string): string {
  if (!url) return "";
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

// ==========================================
// TEMPLATE 1: Classic Traditional
// ==========================================
export function renderTemplate1Latex(
  rawModel: ResumeDocumentModel,
  spec: TemplateSpec = TEMPLATE_SPECS["template-1"],
): string {
  const model = normalizeResumeDocument(rawModel);
  const { personalInfo, summary, experience, education, skills, projects, extras, extrasLabel, sectionTitles } = model;

  const contactItems: string[] = [];
  if (personalInfo.location) contactItems.push(escapeLatex(personalInfo.location));
  if (personalInfo.email) contactItems.push(`\\href{mailto:${escapeLatex(personalInfo.email)}}{${escapeLatex(personalInfo.email)}}`);
  if (personalInfo.phone) contactItems.push(escapeLatex(personalInfo.phone));
  if (personalInfo.linkedin) contactItems.push(`\\href{https://${cleanUrl(personalInfo.linkedin)}}{${escapeLatex(cleanUrl(personalInfo.linkedin))}}`);
  if (personalInfo.github) contactItems.push(`\\href{https://${cleanUrl(personalInfo.github)}}{${escapeLatex(cleanUrl(personalInfo.github))}}`);
  if (personalInfo.portfolio) contactItems.push(`\\href{https://${cleanUrl(personalInfo.portfolio)}}{${escapeLatex(cleanUrl(personalInfo.portfolio))}}`);

  const summaryBlock = summary?.trim()
    ? `\\section{${escapeLatex(sectionTitles?.summary || "Summary")}}
${escapeLatex(summary)}`
    : "";

  const experienceItems = experience.map((exp) => {
    const bullets = exp.bullets.filter(Boolean).map((b) => `    \\resumeItem{${escapeLatex(b)}}`).join("\n");
    const bulletsBlock = bullets
      ? `  \\itemListStart
${bullets}
  \\itemListEnd`
      : "";

    return `  \\resumeSubheading{${escapeLatex(exp.company)}}{${escapeLatex(exp.startDate)} -- ${escapeLatex(exp.endDate)}}{${escapeLatex(exp.role)}}{${escapeLatex(exp.location)}}
${bulletsBlock}`;
  }).join("\n");

  const experienceBlock = experience.length > 0
    ? `\\section{${escapeLatex(sectionTitles?.experience || "Work Experience")}}
\\listStart
${experienceItems}
\\listEnd`
    : "";

  const educationItems = education.map((edu) => {
    const degreeLine = [edu.degree, edu.field].filter(Boolean).join(", ");
    return `  \\resumeSubheading{${escapeLatex(edu.institution)}}{${escapeLatex(edu.startDate)} -- ${escapeLatex(edu.endDate)}}{${escapeLatex(degreeLine)}}{${escapeLatex(edu.location)}}`;
  }).join("\n");

  const educationBlock = education.length > 0
    ? `\\section{${escapeLatex(sectionTitles?.education || "Education")}}
\\listStart
${educationItems}
\\listEnd`
    : "";

  const skillItems = skills.map((s) => {
    const list = s.skills.filter(Boolean).map(escapeLatex).join(", ");
    return `  \\resumeItem{\\textbf{${escapeLatex(s.category)}:} ${list}}`;
  }).join("\n");

  const skillsBlock = skills.length > 0
    ? `\\section{${escapeLatex(sectionTitles?.skills || "Skills")}}
\\itemListStart
${skillItems}
\\itemListEnd`
    : "";

  const projectItems = projects.map((p) => {
    const heading = p.subtitle
      ? `\\textbf{${escapeLatex(p.title)}} -- ${escapeLatex(p.subtitle)}`
      : `\\textbf{${escapeLatex(p.title)}}`;
    const dates = [p.startDate, p.endDate].filter(Boolean).join(" -- ");
    const bullets = p.bullets.filter(Boolean).map((b) => `    \\resumeItem{${escapeLatex(b)}}`).join("\n");
    const bulletsBlock = bullets
      ? `  \\itemListStart
${bullets}
  \\itemListEnd`
      : "";

    return `  \\resumeProjectHeading{${heading}}{${escapeLatex(dates)}}
${bulletsBlock}`;
  }).join("\n");

  const projectsBlock = projects.length > 0
    ? `\\section{${escapeLatex(sectionTitles?.projects || "Projects")}}
\\listStart
${projectItems}
\\listEnd`
    : "";

  const extraItems = extras.map((item) => {
    const heading = item.subtitle
      ? `\\textbf{${escapeLatex(item.title)}} -- ${escapeLatex(item.subtitle)}`
      : `\\textbf{${escapeLatex(item.title)}}`;
    const bullets = (item.bullets || []).filter(Boolean).map((b) => `    \\resumeItem{${escapeLatex(b)}}`).join("\n");
    const bulletsBlock = bullets
      ? `  \\itemListStart
${bullets}
  \\itemListEnd`
      : "";

    return `  \\resumeProjectHeading{${heading}}{${escapeLatex(item.date)}}
${bulletsBlock}`;
  }).join("\n");

  const extrasTitle = sectionTitles?.extras || extrasLabel || spec.defaultExtrasLabel;
  const extrasBlock = extras.length > 0
    ? `\\section{${escapeLatex(extrasTitle)}}
\\listStart
${extraItems}
\\listEnd`
    : "";

  const customSections = model.customSections || [];
  const customSectionsBlock = customSections.map((sec) => {
    if (!sec) return "";
    const items = (sec.items || []).map((item) => {
      const heading = item.subtitle
        ? `\\textbf{${escapeLatex(item.title)}} -- ${escapeLatex(item.subtitle)}`
        : `\\textbf{${escapeLatex(item.title)}}`;
      const bullets = (item.bullets || []).filter(Boolean).map((b) => `    \\resumeItem{${escapeLatex(b)}}`).join("\n");
      const bulletsBlock = bullets ? `  \\itemListStart\n${bullets}\n  \\itemListEnd` : "";
      return `  \\resumeProjectHeading{${heading}}{${escapeLatex(item.date)}}\n${bulletsBlock}`;
    }).join("\n");
    return `\\section{${escapeLatex(sec.title || "Additional Section")}}\n\\listStart\n${items}\n\\listEnd`;
  }).filter(Boolean).join("\n\n");

  const bodySections = [summaryBlock, experienceBlock, educationBlock, skillsBlock, projectsBlock, extrasBlock, customSectionsBlock]
    .filter(Boolean)
    .join("\n\n");

  return `${spec.marker}
% Style: centered header, serif (Times-like), tabular row alignment,
% single horizontal rule under each section header. The "safe corporate" look.
\\documentclass[letterpaper,11pt]{article}
\\usepackage[margin=0.65in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{mathptmx}

\\pagestyle{empty}
\\urlstyle{same}
\\raggedbottom
\\setlength{\parindent}{0pt}
\\setlength{\tabcolsep}{0in}

\\titleformat{\\section}{\\large\\bfseries\\raggedright}{}{0em}{}[\\titlerule]
\\titlespacing*{\\section}{0pt}{8pt}{4pt}

\\newcommand{\\resumeItem}[1]{\\item #1}
\\newcommand{\\resumeSubheading}[4]{%
  \\item
  \\begin{tabular*}{\\linewidth}[t]{l@{\\extracolsep{\\fill}}r}
    \\textbf{#1} & #2 \\\\
    \\textit{#3} & \\textit{#4} \\\\
  \\end{tabular*}%
}
\\newcommand{\\resumeProjectHeading}[2]{%
  \\item
  \\begin{tabular*}{\\linewidth}{l@{\\extracolsep{\\fill}}r}
    #1 & #2 \\\\
  \\end{tabular*}%
}
\\newcommand{\\listStart}{\\begin{itemize}[leftmargin=0in, label={}, topsep=2pt, itemsep=4pt]}
\\newcommand{\\listEnd}{\\end{itemize}}
\\newcommand{\\itemListStart}{\\begin{itemize}[leftmargin=0.2in, topsep=2pt, itemsep=1pt]}
\\newcommand{\\itemListEnd}{\\end{itemize}}

\\begin{document}
\\begin{center}
  {\\Large\\textbf{${escapeLatex(personalInfo.fullName || "YOUR NAME").toUpperCase()}}}\\\\[3pt]
  ${contactItems.join(" \\ $\\vert$ \\ ")}
\\end{center}

${bodySections}

\\end{document}
`;
}

// ==========================================
// TEMPLATE 2: Modern Minimal
// ==========================================
export function renderTemplate2Latex(
  rawModel: ResumeDocumentModel,
  spec: TemplateSpec = TEMPLATE_SPECS["template-2"],
): string {
  const model = normalizeResumeDocument(rawModel);
  const { personalInfo, summary, experience, education, skills, projects, extras, extrasLabel, sectionTitles } = model;

  const contactItems: string[] = [];
  if (personalInfo.location) contactItems.push(escapeLatex(personalInfo.location));
  if (personalInfo.email) contactItems.push(`\\href{mailto:${escapeLatex(personalInfo.email)}}{${escapeLatex(personalInfo.email)}}`);
  if (personalInfo.phone) contactItems.push(escapeLatex(personalInfo.phone));
  if (personalInfo.linkedin) contactItems.push(`\\href{https://${cleanUrl(personalInfo.linkedin)}}{${escapeLatex(cleanUrl(personalInfo.linkedin))}}`);
  if (personalInfo.github) contactItems.push(`\\href{https://${cleanUrl(personalInfo.github)}}{${escapeLatex(cleanUrl(personalInfo.github))}}`);
  if (personalInfo.portfolio) contactItems.push(`\\href{https://${cleanUrl(personalInfo.portfolio)}}{${escapeLatex(cleanUrl(personalInfo.portfolio))}}`);

  const headline = personalInfo.headline || model.metadata?.targetRole || "";

  const summaryBlock = summary?.trim()
    ? `\\section{${escapeLatex(sectionTitles?.summary || "Summary")}}
${escapeLatex(summary)}`
    : "";

  const experienceItems = experience.map((exp) => {
    const bullets = exp.bullets.filter(Boolean).map((b) => `    \\resumeItem{${escapeLatex(b)}}`).join("\n");
    const bulletsBlock = bullets
      ? `  \\itemListStart
${bullets}
  \\itemListEnd`
      : "";

    return `  \\resumeSubheading{${escapeLatex(exp.company)}}{${escapeLatex(exp.startDate)} -- ${escapeLatex(exp.endDate)}}{${escapeLatex(exp.role)}}{${escapeLatex(exp.location)}}
${bulletsBlock}`;
  }).join("\n");

  const experienceBlock = experience.length > 0
    ? `\\section{${escapeLatex(sectionTitles?.experience || "Work Experience")}}
\\listStart
${experienceItems}
\\listEnd`
    : "";

  const educationItems = education.map((edu) => {
    const degreeLine = [edu.degree, edu.field].filter(Boolean).join(", ");
    return `  \\resumeSubheading{${escapeLatex(edu.institution)}}{${escapeLatex(edu.startDate)} -- ${escapeLatex(edu.endDate)}}{${escapeLatex(degreeLine)}}{${escapeLatex(edu.location)}}`;
  }).join("\n");

  const educationBlock = education.length > 0
    ? `\\section{${escapeLatex(sectionTitles?.education || "Education")}}
\\listStart
${educationItems}
\\listEnd`
    : "";

  const skillItems = skills.map((s) => {
    const list = s.skills.filter(Boolean).map(escapeLatex).join(", ");
    return `  \\resumeItem{\\textbf{${escapeLatex(s.category)}:} ${list}}`;
  }).join("\n");

  const skillsBlock = skills.length > 0
    ? `\\section{${escapeLatex(sectionTitles?.skills || "Skills")}}
\\itemListStart
${skillItems}
\\itemListEnd`
    : "";

  const projectItems = projects.map((p) => {
    const heading = p.subtitle
      ? `\\textbf{${escapeLatex(p.title)}} -- ${escapeLatex(p.subtitle)}`
      : `\\textbf{${escapeLatex(p.title)}}`;
    const dates = [p.startDate, p.endDate].filter(Boolean).join(" -- ");
    const bullets = p.bullets.filter(Boolean).map((b) => `    \\resumeItem{${escapeLatex(b)}}`).join("\n");
    const bulletsBlock = bullets
      ? `  \\itemListStart
${bullets}
  \\itemListEnd`
      : "";

    return `  \\resumeProjectHeading{${heading}}{${escapeLatex(dates)}}
${bulletsBlock}`;
  }).join("\n");

  const projectsBlock = projects.length > 0
    ? `\\section{${escapeLatex(sectionTitles?.projects || "Projects")}}
\\listStart
${projectItems}
\\listEnd`
    : "";

  const extraItems = extras.map((item) => {
    const heading = item.subtitle
      ? `\\textbf{${escapeLatex(item.title)}} -- ${escapeLatex(item.subtitle)}`
      : `\\textbf{${escapeLatex(item.title)}}`;
    const bullets = (item.bullets || []).filter(Boolean).map((b) => `    \\resumeItem{${escapeLatex(b)}}`).join("\n");
    const bulletsBlock = bullets
      ? `  \\itemListStart
${bullets}
  \\itemListEnd`
      : "";

    return `  \\resumeProjectHeading{${heading}}{${escapeLatex(item.date)}}
${bulletsBlock}`;
  }).join("\n");

  const extrasTitle = sectionTitles?.extras || extrasLabel || spec.defaultExtrasLabel;
  const extrasBlock = extras.length > 0
    ? `\\section{${escapeLatex(extrasTitle)}}
\\listStart
${extraItems}
\\listEnd`
    : "";

  const customSections = model.customSections || [];
  const customSectionsBlock = customSections.map((sec) => {
    if (!sec) return "";
    const items = (sec.items || []).map((item) => {
      const heading = item.subtitle
        ? `\\textbf{${escapeLatex(item.title)}} -- ${escapeLatex(item.subtitle)}`
        : `\\textbf{${escapeLatex(item.title)}}`;
      const bullets = (item.bullets || []).filter(Boolean).map((b) => `    \\resumeItem{${escapeLatex(b)}}`).join("\n");
      const bulletsBlock = bullets ? `  \\itemListStart\n${bullets}\n  \\itemListEnd` : "";
      return `  \\resumeProjectHeading{${heading}}{${escapeLatex(item.date)}}\n${bulletsBlock}`;
    }).join("\n");
    return `\\section{${escapeLatex(sec.title || "Additional Section")}}\n\\listStart\n${items}\n\\listEnd`;
  }).filter(Boolean).join("\n\n");

  const bodySections = [summaryBlock, experienceBlock, educationBlock, skillsBlock, projectsBlock, extrasBlock, customSectionsBlock]
    .filter(Boolean)
    .join("\n\n");

  return `${spec.marker}
% Style: everything flush-left (not centered), sans-serif, accent-colored
% headers, NO rule lines under sections (whitespace does the separating),
% job entries use plain \\hfill lines instead of tabular. Open, airy feel.
\\documentclass[letterpaper,10.5pt]{article}
\\usepackage[margin=0.6in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{helvet}
\\renewcommand{\\familydefault}{\\sfdefault}
\\usepackage{xcolor}
\\definecolor{accent}{HTML}{1B6E5C}

\\pagestyle{empty}
\\urlstyle{same}
\\raggedbottom
\\setlength{\\parindent}{0pt}

\\titleformat{\\section}{\\bfseries\\color{accent}\\fontsize{11}{13}\\selectfont}{}{0em}{}
\\titlespacing*{\\section}{0pt}{11pt}{5pt}

\\newcommand{\\resumeItem}[1]{\\item #1}
\\newcommand{\\resumeSubheading}[4]{%
  \\item
  \\textbf{#1} \\hfill \\textcolor{accent}{\\small #2}\\\\
  \\textit{\\small #3} \\hfill \\textit{\\small #4}%
}
\\newcommand{\\resumeProjectHeading}[2]{%
  \\item
  #1 \\hfill \\textcolor{accent}{\\small #2}%
}
\\newcommand{\\listStart}{\\begin{itemize}[leftmargin=0in, label={}, topsep=1pt, itemsep=8pt]}
\\newcommand{\\listEnd}{\\end{itemize}}
\\newcommand{\\itemListStart}{\\begin{itemize}[leftmargin=0.16in, topsep=3pt, itemsep=1pt]}
\\newcommand{\\itemListEnd}{\\end{itemize}}

\\begin{document}
\\noindent{\\Large\\bfseries\\color{accent} ${escapeLatex(personalInfo.fullName || "YOUR NAME").toUpperCase()}}\\\\[1pt]
${headline ? `{\\small ${escapeLatex(headline)}}\\\\[3pt]` : ""}
{\\small ${contactItems.join(" \\ $\\vert$ \\ ")}}
\\vspace{2pt}
\\hrule height 0.6pt
\\vspace{4pt}

${bodySections}

\\end{document}
`;
}

// ==========================================
// TEMPLATE 3: Technical Developer
// ==========================================
export function renderTemplate3Latex(
  rawModel: ResumeDocumentModel,
  spec: TemplateSpec = TEMPLATE_SPECS["template-3"],
): string {
  const model = normalizeResumeDocument(rawModel);
  const { personalInfo, summary, experience, education, skills, projects, extras, extrasLabel, sectionTitles } = model;

  const contactItems: string[] = [];
  if (personalInfo.location) contactItems.push(escapeLatex(personalInfo.location));
  if (personalInfo.email) contactItems.push(`\\href{mailto:${escapeLatex(personalInfo.email)}}{${escapeLatex(personalInfo.email)}}`);
  if (personalInfo.phone) contactItems.push(escapeLatex(personalInfo.phone));
  if (personalInfo.linkedin) contactItems.push(`\\href{https://${cleanUrl(personalInfo.linkedin)}}{${escapeLatex(cleanUrl(personalInfo.linkedin))}}`);
  if (personalInfo.github) contactItems.push(`\\href{https://${cleanUrl(personalInfo.github)}}{${escapeLatex(cleanUrl(personalInfo.github))}}`);
  if (personalInfo.portfolio) contactItems.push(`\\href{https://${cleanUrl(personalInfo.portfolio)}}{${escapeLatex(cleanUrl(personalInfo.portfolio))}}`);

  const nameFormatted = (personalInfo.fullName || "YOUR NAME").toUpperCase().replace(/\s+/g, "_");

  const summaryBlock = summary?.trim()
    ? `\\section{${escapeLatex((sectionTitles?.summary || "SUMMARY").toUpperCase().replace(/\s+/g, "_"))}}
${escapeLatex(summary)}`
    : "";

  const experienceItems = experience.map((exp) => {
    const bullets = exp.bullets.filter(Boolean).map((b) => `    \\resumeItem{${escapeLatex(b)}}`).join("\n");
    const bulletsBlock = bullets
      ? `  \\itemListStart
${bullets}
  \\itemListEnd`
      : "";

    return `  \\resumeSubheading{${escapeLatex(exp.company)}}{${escapeLatex(exp.startDate)} -- ${escapeLatex(exp.endDate)}}{${escapeLatex(exp.role)}}{${escapeLatex(exp.location)}}
${bulletsBlock}`;
  }).join("\n");

  const experienceBlock = experience.length > 0
    ? `\\section{${escapeLatex((sectionTitles?.experience || "WORK_EXPERIENCE").toUpperCase().replace(/\s+/g, "_"))}}
\\listStart
${experienceItems}
\\listEnd`
    : "";

  const educationItems = education.map((edu) => {
    const degreeLine = [edu.degree, edu.field].filter(Boolean).join(", ");
    return `  \\resumeSubheading{${escapeLatex(edu.institution)}}{${escapeLatex(edu.startDate)} -- ${escapeLatex(edu.endDate)}}{${escapeLatex(degreeLine)}}{${escapeLatex(edu.location)}}`;
  }).join("\n");

  const educationBlock = education.length > 0
    ? `\\section{${escapeLatex((sectionTitles?.education || "EDUCATION").toUpperCase().replace(/\s+/g, "_"))}}
\\listStart
${educationItems}
\\listEnd`
    : "";

  // Template 3 renders skills as bracket tags: \texttt{[JavaScript]} \texttt{[TypeScript]} ...
  const allSkills = skills.flatMap((s) => s.skills).filter(Boolean);
  const skillTags = allSkills.map((s) => `\\texttt{[${escapeLatex(s)}]}`).join(" ");

  const skillsBlock = allSkills.length > 0
    ? `\\section{${escapeLatex((sectionTitles?.skills || "SKILLS").toUpperCase().replace(/\s+/g, "_"))}}
\\vspace{2pt}
${skillTags}
\\vspace{4pt}`
    : "";

  const projectItems = projects.map((p) => {
    const heading = p.subtitle
      ? `\\textbf{${escapeLatex(p.title)}} -- ${escapeLatex(p.subtitle)}`
      : `\\textbf{${escapeLatex(p.title)}}`;
    const dates = [p.startDate, p.endDate].filter(Boolean).join(" -- ");
    const bullets = p.bullets.filter(Boolean).map((b) => `    \\resumeItem{${escapeLatex(b)}}`).join("\n");
    const bulletsBlock = bullets
      ? `  \\itemListStart
${bullets}
  \\itemListEnd`
      : "";

    return `  \\resumeProjectHeading{${heading}}{${escapeLatex(dates)}}
${bulletsBlock}`;
  }).join("\n");

  const projectsBlock = projects.length > 0
    ? `\\section{${escapeLatex((sectionTitles?.projects || "PROJECTS").toUpperCase().replace(/\s+/g, "_"))}}
\\listStart
${projectItems}
\\listEnd`
    : "";

  const extraItems = extras.map((item) => {
    const heading = item.subtitle
      ? `\\textbf{${escapeLatex(item.title)}} -- ${escapeLatex(item.subtitle)}`
      : `\\textbf{${escapeLatex(item.title)}}`;
    const bullets = (item.bullets || []).filter(Boolean).map((b) => `    \\resumeItem{${escapeLatex(b)}}`).join("\n");
    const bulletsBlock = bullets
      ? `  \\itemListStart
${bullets}
  \\itemListEnd`
      : "";

    return `  \\resumeProjectHeading{${heading}}{${escapeLatex(item.date)}}
${bulletsBlock}`;
  }).join("\n");

  const extrasTitle = (sectionTitles?.extras || extrasLabel || spec.defaultExtrasLabel).toUpperCase().replace(/\s+/g, "_");
  const extrasBlock = extras.length > 0
    ? `\\section{${escapeLatex(extrasTitle)}}
\\listStart
${extraItems}
\\listEnd`
    : "";

  const customSections = model.customSections || [];
  const customSectionsBlock = customSections.map((sec) => {
    if (!sec) return "";
    const items = (sec.items || []).map((item) => {
      const heading = item.subtitle
        ? `\\textbf{${escapeLatex(item.title)}} -- ${escapeLatex(item.subtitle)}`
        : `\\textbf{${escapeLatex(item.title)}}`;
      const bullets = (item.bullets || []).filter(Boolean).map((b) => `    \\resumeItem{${escapeLatex(b)}}`).join("\n");
      const bulletsBlock = bullets ? `  \\itemListStart\n${bullets}\n  \\itemListEnd` : "";
      return `  \\resumeProjectHeading{${heading}}{${escapeLatex(item.date)}}\n${bulletsBlock}`;
    }).join("\n");
    const secTitle = escapeLatex((sec.title || "ADDITIONAL_SECTION").toUpperCase().replace(/\s+/g, "_"));
    return `\\section{${secTitle}}\n\\listStart\n${items}\n\\listEnd`;
  }).filter(Boolean).join("\n\n");

  const bodySections = [summaryBlock, experienceBlock, educationBlock, skillsBlock, projectsBlock, extrasBlock, customSectionsBlock]
    .filter(Boolean)
    .join("\n\n");

  return `${spec.marker}
% Style: "developer/terminal" aesthetic -- monospace section headers
% prefixed like code comments, dotted leaders for dates, skills shown
% as bracket tags. Dense spacing. Still single column, plain text.
\\documentclass[letterpaper,10pt]{article}
\\usepackage[margin=0.55in,top=0.45in,bottom=0.45in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}

\\pagestyle{empty}
\\urlstyle{same}
\\raggedbottom
\\setlength{\\parindent}{0pt}

\\titleformat{\\section}{\\ttfamily\\bfseries\\fontsize{10}{12}\\selectfont}{}{0em}{\\textbf{//} }
\\titlespacing*{\\section}{0pt}{7pt}{2pt}

\\newcommand{\\resumeItem}[1]{\\item #1}
\\newcommand{\\resumeSubheading}[4]{%
  \\item
  \\textbf{#1} \\dotfill \\ttfamily\\small #2 \\normalfont\\\\
  \\textit{#3} \\dotfill \\ttfamily\\small #4%
}
\\newcommand{\\resumeProjectHeading}[2]{%
  \\item
  #1 \\dotfill \\ttfamily\\small #2%
}
\\newcommand{\\listStart}{\\begin{itemize}[leftmargin=0in, label={}, topsep=1pt, itemsep=3pt, parsep=0pt]}
\\newcommand{\\listEnd}{\\end{itemize}}
\\newcommand{\\itemListStart}{\\small\\begin{itemize}[leftmargin=0.18in, topsep=1pt, itemsep=0.5pt, parsep=0pt]}
\\newcommand{\\itemListEnd}{\\end{itemize}}

\\begin{document}
\\noindent{\\ttfamily\\Large\\bfseries ${escapeLatex(nameFormatted)}}\\\\[2pt]
{\\small ${contactItems.join(" \\ $\\vert$ \\ ")}}
\\vspace{2pt}

${bodySections}

\\end{document}
`;
}

// ==========================================
// TEMPLATE 4: Elegant Formal
// ==========================================
export function renderTemplate4Latex(
  rawModel: ResumeDocumentModel,
  spec: TemplateSpec = TEMPLATE_SPECS["template-4"],
): string {
  const model = normalizeResumeDocument(rawModel);
  const { personalInfo, summary, experience, education, skills, projects, extras, extrasLabel, sectionTitles } = model;

  const contactLines: string[] = [];
  if (personalInfo.location) contactLines.push(escapeLatex(personalInfo.location));
  
  const links: string[] = [];
  if (personalInfo.email) links.push(`\\href{mailto:${escapeLatex(personalInfo.email)}}{${escapeLatex(personalInfo.email)}}`);
  if (personalInfo.phone) links.push(escapeLatex(personalInfo.phone));
  if (personalInfo.linkedin) links.push(`\\href{https://${cleanUrl(personalInfo.linkedin)}}{${escapeLatex(cleanUrl(personalInfo.linkedin))}}`);
  if (personalInfo.github) links.push(`\\href{https://${cleanUrl(personalInfo.github)}}{${escapeLatex(cleanUrl(personalInfo.github))}}`);
  if (personalInfo.portfolio) links.push(`\\href{https://${cleanUrl(personalInfo.portfolio)}}{${escapeLatex(cleanUrl(personalInfo.portfolio))}}`);
  if (links.length > 0) contactLines.push(links.join(" \\ $\\vert$ \\ "));

  const summaryBlock = summary?.trim()
    ? `\\section{${escapeLatex(sectionTitles?.summary || "Summary")}}
\\begin{center}
${escapeLatex(summary)}
\\end{center}`
    : "";

  const experienceItems = experience.map((exp) => {
    const bullets = exp.bullets.filter(Boolean).map((b) => `    \\resumeItem{${escapeLatex(b)}}`).join("\n");
    const bulletsBlock = bullets
      ? `  \\itemListStart
${bullets}
  \\itemListEnd`
      : "";

    return `  \\resumeSubheading{${escapeLatex(exp.company)}}{${escapeLatex(exp.startDate)} -- ${escapeLatex(exp.endDate)}}{${escapeLatex(exp.role)}}{${escapeLatex(exp.location)}}
${bulletsBlock}`;
  }).join("\n");

  const experienceBlock = experience.length > 0
    ? `\\section{${escapeLatex(sectionTitles?.experience || "Work Experience")}}
\\listStart
${experienceItems}
\\listEnd`
    : "";

  const educationItems = education.map((edu) => {
    const degreeLine = [edu.degree, edu.field].filter(Boolean).join(", ");
    return `  \\resumeSubheading{${escapeLatex(edu.institution)}}{${escapeLatex(edu.startDate)} -- ${escapeLatex(edu.endDate)}}{${escapeLatex(degreeLine)}}{${escapeLatex(edu.location)}}`;
  }).join("\n");

  const educationBlock = education.length > 0
    ? `\\section{${escapeLatex(sectionTitles?.education || "Education")}}
\\listStart
${educationItems}
\\listEnd`
    : "";

  const skillLines = skills.map((s) => {
    const list = s.skills.filter(Boolean).map(escapeLatex).join(", ");
    return `\\textbf{${escapeLatex(s.category)}:} ${list}`;
  }).join("\\\\[3pt]\n");

  const skillsBlock = skills.length > 0
    ? `\\section{${escapeLatex(sectionTitles?.skills || "Skills")}}
\\begin{center}
${skillLines}
\\end{center}`
    : "";

  const projectItems = projects.map((p) => {
    const heading = p.subtitle
      ? `\\textbf{${escapeLatex(p.title)}} -- ${escapeLatex(p.subtitle)}`
      : `\\textbf{${escapeLatex(p.title)}}`;
    const dates = [p.startDate, p.endDate].filter(Boolean).join(" -- ");
    const bullets = p.bullets.filter(Boolean).map((b) => `    \\resumeItem{${escapeLatex(b)}}`).join("\n");
    const bulletsBlock = bullets
      ? `  \\itemListStart
${bullets}
  \\itemListEnd`
      : "";

    return `  \\resumeProjectHeading{${heading}}{${escapeLatex(dates)}}
${bulletsBlock}`;
  }).join("\n");

  const projectsBlock = projects.length > 0
    ? `\\section{${escapeLatex(sectionTitles?.projects || "Projects")}}
\\listStart
${projectItems}
\\listEnd`
    : "";

  const extraItems = extras.map((item) => {
    const heading = item.subtitle
      ? `\\textbf{${escapeLatex(item.title)}} -- ${escapeLatex(item.subtitle)}`
      : `\\textbf{${escapeLatex(item.title)}}`;
    const bullets = (item.bullets || []).filter(Boolean).map((b) => `    \\resumeItem{${escapeLatex(b)}}`).join("\n");
    const bulletsBlock = bullets
      ? `  \\itemListStart
${bullets}
  \\itemListEnd`
      : "";

    return `  \\resumeProjectHeading{${heading}}{${escapeLatex(item.date)}}
${bulletsBlock}`;
  }).join("\n");

  const extrasTitle = sectionTitles?.extras || extrasLabel || spec.defaultExtrasLabel;
  const extrasBlock = extras.length > 0
    ? `\\section{${escapeLatex(extrasTitle)}}
\\listStart
${extraItems}
\\listEnd`
    : "";

  const customSections = model.customSections || [];
  const customSectionsBlock = customSections.map((sec) => {
    if (!sec) return "";
    const items = (sec.items || []).map((item) => {
      const heading = item.subtitle
        ? `\\textbf{${escapeLatex(item.title)}} -- ${escapeLatex(item.subtitle)}`
        : `\\textbf{${escapeLatex(item.title)}}`;
      const bullets = (item.bullets || []).filter(Boolean).map((b) => `    \\resumeItem{${escapeLatex(b)}}`).join("\n");
      const bulletsBlock = bullets ? `  \\itemListStart\n${bullets}\n  \\itemListEnd` : "";
      return `  \\resumeProjectHeading{${heading}}{${escapeLatex(item.date)}}\n${bulletsBlock}`;
    }).join("\n");
    return `\\section{${escapeLatex(sec.title || "Additional Section")}}\n\\listStart\n${items}\n\\listEnd`;
  }).filter(Boolean).join("\n\n");

  const bodySections = [summaryBlock, experienceBlock, educationBlock, skillsBlock, projectsBlock, extrasBlock, customSectionsBlock]
    .filter(Boolean)
    .join("\n\n");

  return `${spec.marker}
% Style: centered layout throughout, small caps, double horizontal rule
% under section headers, generous spacing -- formal/executive feel.
\\documentclass[letterpaper,11pt]{article}
\\usepackage[margin=0.75in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{mathptmx}

\\pagestyle{empty}
\\urlstyle{same}
\\raggedbottom
\\setlength{\\parindent}{0pt}

\\titleformat{\\section}{\\centering\\scshape\\Large}{}{0em}{}[{\\vspace{2pt}\\hrule height 0.5pt\\vspace{1pt}\\hrule height 0.5pt}]
\\titlespacing*{\\section}{0pt}{12pt}{6pt}

\\newcommand{\\resumeItem}[1]{\\item #1}
\\newcommand{\\resumeSubheading}[4]{%
  \\item
  \\begin{center}
    \\textbf{#1} \\quad--\\quad #2\\\\
    \\textit{#3, #4}
  \\end{center}%
}
\\newcommand{\\resumeProjectHeading}[2]{%
  \\item
  \\begin{center}
    #1 \\quad--\\quad #2
  \\end{center}%
}
\\newcommand{\\listStart}{\\begin{itemize}[leftmargin=0.3in, label={}, topsep=4pt, itemsep=9pt]}
\\newcommand{\\listEnd}{\\end{itemize}}
\\newcommand{\\itemListStart}{\\begin{itemize}[leftmargin=0.5in, topsep=3pt, itemsep=2pt]}
\\newcommand{\\itemListEnd}{\\end{itemize}}

\\begin{document}
\\begin{center}
  {\\Large\\scshape\\bfseries ${escapeLatex(personalInfo.fullName || "Your Name")}}\\\\[4pt]
  ${contactLines.join("\\\\[2pt]\n  ")}
\\end{center}

${bodySections}

\\end{document}
`;
}

/**
 * Dispatches LaTeX generation by templateId.
 */
export function renderLatexByTemplateId(
  model: ResumeDocumentModel,
  templateId?: string,
): string {
  const id = templateId || model.templateId || "template-1";
  switch (id) {
    case "template-2":
    case "modern-minimal":
      return renderTemplate2Latex(model);
    case "template-3":
    case "technical-developer":
      return renderTemplate3Latex(model);
    case "template-4":
    case "elegant-formal":
      return renderTemplate4Latex(model);
    case "template-1":
    case "classic-traditional":
    default:
      return renderTemplate1Latex(model);
  }
}
