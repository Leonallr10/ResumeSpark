import type { ResumeDocumentModel } from "./resume-document-model";

/**
 * Generates compilable LaTeX source from ResumeDocumentModel.
 * Can format according to Template 1 (Times New Roman Academic) or Template 2 (Trey Hunner CV).
 */
export function generateLatexFromDocumentModel(
  model: ResumeDocumentModel,
  templateVariant: "template-1" | "template-2" = "template-1",
): string {
  if (templateVariant === "template-2" || model.templateId === "template-2") {
    return generateTemplate2Latex(model);
  }
  return generateTemplate1Latex(model);
}

function escapeLatex(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_");
}

function generateTemplate1Latex(model: ResumeDocumentModel): string {
  const { personalInfo, summary, experience, education, skills, projects, achievements } = model;

  const contactLinks: string[] = [];
  if (personalInfo.phone) contactLinks.push(`\\href{tel:${personalInfo.phone}}{${escapeLatex(personalInfo.phone)}}`);
  if (personalInfo.email) contactLinks.push(`\\href{mailto:${personalInfo.email}}{${escapeLatex(personalInfo.email)}}`);
  if (personalInfo.linkedin) contactLinks.push(`\\href{https://${personalInfo.linkedin}}{${escapeLatex(personalInfo.linkedin)}}`);
  if (personalInfo.github) contactLinks.push(`\\href{https://${personalInfo.github}}{${escapeLatex(personalInfo.github)}}`);
  if (personalInfo.portfolio) contactLinks.push(`\\href{https://${personalInfo.portfolio}}{portfolio}`);

  const headerBlock = `\\begin{center}
  {\\namesize\\textbf{${escapeLatex(personalInfo.fullName.toUpperCase())}}}\\\\[2pt]
  {\\fontsize{9}{11}\\selectfont ${escapeLatex(personalInfo.location)}}\\\\[2pt]
  {\\fontsize{9}{12}\\selectfont ${contactLinks.join(" $\\vert$ ")}}
\\end{center}`;

  // Summary Section
  const summaryBlock = summary
    ? `\\section{SUMMARY}
\\itemtext
${escapeLatex(summary)}
\\vspace{2pt}`
    : "";

  // Experience Section
  const expItems = experience
    .map((exp) => {
      const bulletItems = exp.bullets
        .map((b) => `      \\resumeItem{${escapeLatex(b)}}`)
        .join("\n");

      return `  \\resumeSubheading
    {${escapeLatex(exp.company)}}{${escapeLatex(exp.startDate)} -- ${escapeLatex(exp.endDate)}}
    {${escapeLatex(exp.role)}}{${escapeLatex(exp.location)}}
    \\resumeItemListStart
${bulletItems}
    \\resumeItemListEnd`;
    })
    .join("\n\n");

  const experienceBlock = experience.length > 0
    ? `\\section{WORK EXPERIENCE}
\\vspace{2pt}
\\resumeSubHeadingListStart
${expItems}
\\resumeSubHeadingListEnd
\\vspace{2pt}`
    : "";

  // Education Section
  const eduItems = education
    .map((edu) => {
      return `  \\resumeSubheading
    {${escapeLatex(edu.institution)}}{${escapeLatex(edu.startDate)} -- ${escapeLatex(edu.endDate)}}
    {${escapeLatex(edu.degree)}}{${escapeLatex(edu.location)}}`;
    })
    .join("\n\n");

  const educationBlock = education.length > 0
    ? `\\section{EDUCATION}
\\vspace{2pt}
\\resumeSubHeadingListStart
${eduItems}
\\resumeSubHeadingListEnd
\\vspace{2pt}`
    : "";

  // Skills Section
  const skillRows = skills
    .map((s) => `  \\resumeItem{\\textbf{${escapeLatex(s.category)}}: ${escapeLatex(s.skills.join(", "))}}`)
    .join("\n");

  const skillsBlock = skills.length > 0
    ? `\\section{SKILLS}\\vspace{2pt}
\\resumeItemListStart
${skillRows}
\\resumeItemListEnd`
    : "";

  // Projects Section
  const projItems = projects
    .map((proj) => {
      const bulletItems = proj.bullets
        .map((b) => `      \\resumeItem{${escapeLatex(b)}}`)
        .join("\n");

      return `  \\resumeProjectHeading
    {\\textbf{${escapeLatex(proj.title)}}}${proj.subtitle ? ` -- ${escapeLatex(proj.subtitle)}` : ""}{${escapeLatex(proj.startDate)} -- ${escapeLatex(proj.endDate)}}
    \\resumeItemListStart
${bulletItems}
    \\resumeItemListEnd`;
    })
    .join("\n\n");

  const projectsBlock = projects.length > 0
    ? `\\section{PROJECTS}
\\vspace{2pt}
\\resumeSubHeadingListStart
${projItems}
\\vspace{2pt}
\\resumeSubHeadingListEnd`
    : "";

  // Achievements Section
  const achRows = achievements
    .map((ach) => {
      const heading = ach.subtitle
        ? `\\textbf{${escapeLatex(ach.title)}} -- ${escapeLatex(ach.subtitle)}`
        : `\\textbf{${escapeLatex(ach.title)}}`;
      return `\\resumeAchievement{${heading}}{${escapeLatex(ach.date)}}`;
    })
    .join("\n");

  const achievementsBlock = achievements.length > 0
    ? `\\section{ACHIEVEMENTS AND ACTIVITIES} \\vspace{2pt}
\\resumeSubHeadingListStart
${achRows}
\\resumeSubHeadingListEnd`
    : "";

  return `%-------------------------
% Resume in LaTeX - Auto Generated
%------------------------

\\documentclass[letterpaper,11pt]{article}

\\usepackage{latexsym}
\\usepackage[margin=0.55in,top=0.25in,bottom=0.2in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage[english]{babel}
\\usepackage{tabularx}
\\usepackage{mathptmx}

\\pagestyle{empty}
\\urlstyle{same}
\\raggedbottom
\\setlength{\\tabcolsep}{0in}
\\setlength{\\parindent}{0pt}

%----------FONT SIZES----------
\\newcommand{\\namesize}{\\fontsize{17.5}{19}\\selectfont}
\\newcommand{\\itemtext}{\\fontsize{9.1}{10.7}\\selectfont}
\\newcommand{\\subtext}{\\fontsize{9}{10.6}\\selectfont}

%----------SECTION FORMATTING----------
\\titleformat{\\section}{\\bfseries\\raggedright\\fontsize{11}{12.5}\\selectfont}{}{0em}{}[\\vspace{1pt}\\titlerule]
\\titlespacing*{\\section}{0pt}{4pt}{2pt}

%----------CUSTOM COMMANDS----------
\\newcommand{\\resumeItem}[1]{
  \\item{#1}
}

\\newcommand{\\resumeSubheading}[4]{
  \\item
    \\begin{tabular*}{\\linewidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{\\fontsize{10}{11.2}\\selectfont #1} & \\subtext #2 \\\\
      \\textit{\\subtext#3} & \\textit{\\subtext #4} \\\\
    \\end{tabular*}
}

\\newcommand{\\resumeProjectHeading}[2]{
  \\item
    \\begin{tabular*}{\\linewidth}{l@{\\extracolsep{\\fill}}r}
      \\fontsize{10}{11.2}\\selectfont#1 & \\subtext #2 \\\\
    \\end{tabular*}
}

\\newcommand{\\resumeAchievement}[2]{
  \\item
    \\begin{tabular*}{\\linewidth}{l@{\\extracolsep{\\fill}}r}
      \\parbox[t]{0.85\\linewidth}{\\raggedright #1} & \\subtext #2 \\\\
    \\end{tabular*}
}

\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0in, label={}, topsep=0pt, itemsep=2pt, parsep=0pt]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\itemtext\\begin{itemize}[leftmargin=0.16in, itemsep=0pt, parsep=0pt, topsep=1.5pt]}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}}

\\begin{document}
\\sloppy

${headerBlock}

${summaryBlock}

${experienceBlock}

${educationBlock}

${skillsBlock}

${projectsBlock}

${achievementsBlock}

\\end{document}
`;
}

function generateTemplate2Latex(model: ResumeDocumentModel): string {
  const { personalInfo, experience, education, skills, projects } = model;

  const contactParts: string[] = [];
  if (personalInfo.phone) contactParts.push(escapeLatex(personalInfo.phone));
  if (personalInfo.email) contactParts.push(escapeLatex(personalInfo.email));
  if (personalInfo.github) contactParts.push(escapeLatex(personalInfo.github));
  if (personalInfo.linkedin) contactParts.push(escapeLatex(personalInfo.linkedin));

  const addressLine = contactParts.join(" \\\\ ");

  // Education Section
  const eduItems = education
    .map((edu) => {
      return `\\begin{rSubsection}{${escapeLatex(edu.institution)}}{${escapeLatex(edu.startDate)} - ${escapeLatex(edu.endDate)}}{${escapeLatex(edu.degree)}}{${escapeLatex(edu.location)}}
\\item[]
\\end{rSubsection}`;
    })
    .join("\n");

  const educationBlock = education.length > 0
    ? `\\begin{rSection}{Education}
${eduItems}
\\end{rSection}`
    : "";

  // Work Experience
  const expItems = experience
    .map((exp) => {
      const bullets = exp.bullets.map((b) => `\\item ${escapeLatex(b)}`).join("\n");
      return `\\begin{rSubsection}{${escapeLatex(exp.company)}}{${escapeLatex(exp.startDate)} - ${escapeLatex(exp.endDate)}}{${escapeLatex(exp.role)}}{${escapeLatex(exp.location)}}
${bullets}
\\end{rSubsection}`;
    })
    .join("\n");

  const experienceBlock = experience.length > 0
    ? `\\begin{rSection}{Work Experience}
${expItems}
\\end{rSection}`
    : "";

  // Projects
  const projItems = projects
    .map((proj) => {
      const bullets = proj.bullets.map((b) => `\\item ${escapeLatex(b)}`).join("\n");
      return `\\begin{rSubsection}{${escapeLatex(proj.title)}}{${escapeLatex(proj.startDate)} - ${escapeLatex(proj.endDate)}}{${escapeLatex(proj.subtitle || "Developer")}}{}
${bullets}
\\end{rSubsection}`;
    })
    .join("\n");

  const projectsBlock = projects.length > 0
    ? `\\begin{rSection}{Projects}
${projItems}
\\end{rSection}`
    : "";

  // Skills
  const skillRows = skills
    .map((s) => `${escapeLatex(s.category)} & ${escapeLatex(s.skills.join(", "))} \\\\`)
    .join("\n");

  const skillsBlock = skills.length > 0
    ? `\\begin{rSection}{Technical Skills}
\\begin{tabular}{ @{} >{\\bfseries}l @{\\hspace{6ex}} l }
${skillRows}
\\end{tabular}
\\end{rSection}`
    : "";

  return `%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% Medium Length Professional CV
% LaTeX Template (Template 2)
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

\\documentclass{resume}
\\usepackage[left=0.7in,top=0.4in,right=0.7in,bottom=0.5in]{geometry}

\\name{${escapeLatex(personalInfo.fullName)}}
\\address{${addressLine}}

\\begin{document}

${educationBlock}

${experienceBlock}

${projectsBlock}

${skillsBlock}

\\end{document}
`;
}
