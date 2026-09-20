import type { ResumeDocumentModel, CustomSection } from "./resume-document-model";

/**
 * Generates compilable LaTeX source from ResumeDocumentModel.
 * Supports Template 1 (Ivy Academic), Template 2 (Classic CV),
 * Template 3 (Silicon Valley Tech), and Template 4 (Minimalist Executive).
 */
export function generateLatexFromDocumentModel(
  model: ResumeDocumentModel,
  templateVariant?: string,
): string {
  const variant = templateVariant || model.templateId || "template-1";

  switch (variant) {
    case "template-2":
      return generateTemplate2Latex(model);
    case "template-3":
      return generateTemplate3Latex(model);
    case "template-4":
      return generateTemplate4Latex(model);
    case "template-1":
    default:
      return generateTemplate1Latex(model);
  }
}

function escapeLatex(text: string): string {
  if (!text) return "";
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function renderCustomSectionsTemplate1(customSections: CustomSection[]): string {
  if (!customSections || customSections.length === 0) return "";

  return customSections
    .map((sec) => {
      const sectionTitle = escapeLatex(sec.title || "ADDITIONAL SECTION").toUpperCase();
      let body = "";

      if (sec.items && sec.items.length > 0) {
        const itemRows = sec.items
          .map((item) => {
            const bulletItems = (item.bullets || [])
              .map((b) => `      \\resumeItem{${escapeLatex(b)}}`)
              .join("\n");

            const bulletsBlock =
              bulletItems.length > 0
                ? `    \\resumeItemListStart\n${bulletItems}\n    \\resumeItemListEnd`
                : "";

            return `  \\resumeSubheading
    {${escapeLatex(item.title)}}{${escapeLatex(item.date)}}
    {${escapeLatex(item.subtitle)}}{${escapeLatex("")}}
${bulletsBlock}`;
          })
          .join("\n\n");

        body = `\\resumeSubHeadingListStart\n${itemRows}\n\\resumeSubHeadingListEnd`;
      } else if (sec.bullets && sec.bullets.length > 0) {
        const bulletItems = sec.bullets
          .map((b) => `  \\resumeItem{${escapeLatex(b)}}`)
          .join("\n");
        body = `\\resumeItemListStart\n${bulletItems}\n\\resumeItemListEnd`;
      } else if (sec.content) {
        body = `\\itemtext\n${escapeLatex(sec.content)}`;
      }

      return `\\section{${sectionTitle}}\n\\vspace{2pt}\n${body}\n\\vspace{2pt}`;
    })
    .join("\n\n");
}

function generateTemplate1Latex(model: ResumeDocumentModel): string {
  const { personalInfo, summary, experience, education, skills, projects, achievements, customSections, sectionTitles } = model;

  const titles = {
    summary: (sectionTitles?.summary || "Summary").toUpperCase(),
    experience: (sectionTitles?.experience || "Work Experience").toUpperCase(),
    education: (sectionTitles?.education || "Education").toUpperCase(),
    skills: (sectionTitles?.skills || "Skills").toUpperCase(),
    projects: (sectionTitles?.projects || "Projects").toUpperCase(),
    achievements: (sectionTitles?.achievements || "Achievements and Activities").toUpperCase(),
  };

  const contactLinks: string[] = [];
  if (personalInfo.phone) contactLinks.push(`\\href{tel:${personalInfo.phone}}{${escapeLatex(personalInfo.phone)}}`);
  if (personalInfo.email) contactLinks.push(`\\href{mailto:${personalInfo.email}}{${escapeLatex(personalInfo.email)}}`);
  if (personalInfo.linkedin) contactLinks.push(`\\href{https://${personalInfo.linkedin}}{${escapeLatex(personalInfo.linkedin)}}`);
  if (personalInfo.github) contactLinks.push(`\\href{https://${personalInfo.github}}{${escapeLatex(personalInfo.github)}}`);
  if (personalInfo.portfolio) contactLinks.push(`\\href{https://${personalInfo.portfolio}}{portfolio}`);

  const headerBlock = `\\begin{center}
  {\\namesize\\textbf{${escapeLatex((personalInfo.fullName || "Your Name").toUpperCase())}}}\\\\[2pt]
  ${personalInfo.location ? `{\\fontsize{9}{11}\\selectfont ${escapeLatex(personalInfo.location)}}\\\\[2pt]` : ""}
  {\\fontsize{9}{12}\\selectfont ${contactLinks.join(" $\\vert$ ")}}
\\end{center}`;

  // Summary Section
  const summaryBlock = summary
    ? `\\section{${titles.summary}}
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
    ? `\\section{${titles.experience}}
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
    {${escapeLatex(edu.degree)}${edu.field ? `, ${escapeLatex(edu.field)}` : ""}}{${escapeLatex(edu.location)}}`;
    })
    .join("\n\n");

  const educationBlock = education.length > 0
    ? `\\section{${titles.education}}
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
    ? `\\section{${titles.skills}}\\vspace{2pt}
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
    ? `\\section{${titles.projects}}
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
    ? `\\section{${titles.achievements}} \\vspace{2pt}
\\resumeSubHeadingListStart
${achRows}
\\resumeSubHeadingListEnd`
    : "";

  const customSectionsBlock = renderCustomSectionsTemplate1(customSections);

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

${customSectionsBlock}

\\end{document}
`;
}

function generateTemplate2Latex(model: ResumeDocumentModel): string {
  const { personalInfo, summary, experience, education, skills, projects, achievements, customSections, sectionTitles } = model;

  const titles = {
    summary: sectionTitles?.summary || "Professional Summary",
    experience: sectionTitles?.experience || "Work Experience",
    education: sectionTitles?.education || "Education",
    skills: sectionTitles?.skills || "Technical Skills",
    projects: sectionTitles?.projects || "Projects",
    achievements: sectionTitles?.achievements || "Achievements",
  };

  const contactParts: string[] = [];
  if (personalInfo.phone) contactParts.push(escapeLatex(personalInfo.phone));
  if (personalInfo.email) contactParts.push(escapeLatex(personalInfo.email));
  if (personalInfo.github) contactParts.push(escapeLatex(personalInfo.github));
  if (personalInfo.linkedin) contactParts.push(escapeLatex(personalInfo.linkedin));

  const addressLine = contactParts.join(" $\\cdot$ ");

  // Summary
  const summaryBlock = summary
    ? `\\begin{rSection}{${escapeLatex(titles.summary)}}
${escapeLatex(summary)}
\\end{rSection}`
    : "";

  // Education Section
  const eduItems = education
    .map((edu) => {
      return `\\begin{rSubsection}{${escapeLatex(edu.institution)}}{${escapeLatex(edu.startDate)} -- ${escapeLatex(edu.endDate)}}{${escapeLatex(edu.degree)}${edu.field ? `, ${escapeLatex(edu.field)}` : ""}}{${escapeLatex(edu.location)}}
\\item[]
\\end{rSubsection}`;
    })
    .join("\n");

  const educationBlock = education.length > 0
    ? `\\begin{rSection}{${escapeLatex(titles.education)}}
${eduItems}
\\end{rSection}`
    : "";

  // Work Experience
  const expItems = experience
    .map((exp) => {
      const bullets = exp.bullets.map((b) => `\\item ${escapeLatex(b)}`).join("\n");
      return `\\begin{rSubsection}{${escapeLatex(exp.company)}}{${escapeLatex(exp.startDate)} -- ${escapeLatex(exp.endDate)}}{${escapeLatex(exp.role)}}{${escapeLatex(exp.location)}}
${bullets}
\\end{rSubsection}`;
    })
    .join("\n");

  const experienceBlock = experience.length > 0
    ? `\\begin{rSection}{${escapeLatex(titles.experience)}}
${expItems}
\\end{rSection}`
    : "";

  // Projects
  const projItems = projects
    .map((proj) => {
      const bullets = proj.bullets.map((b) => `\\item ${escapeLatex(b)}`).join("\n");
      return `\\begin{rSubsection}{${escapeLatex(proj.title)}}{${escapeLatex(proj.startDate)} -- ${escapeLatex(proj.endDate)}}{${escapeLatex(proj.subtitle || "Developer")}}{}
${bullets}
\\end{rSubsection}`;
    })
    .join("\n");

  const projectsBlock = projects.length > 0
    ? `\\begin{rSection}{${escapeLatex(titles.projects)}}
${projItems}
\\end{rSection}`
    : "";

  // Skills
  const skillRows = skills
    .map((s) => `${escapeLatex(s.category)} & ${escapeLatex(s.skills.join(", "))} \\\\`)
    .join("\n");

  const skillsBlock = skills.length > 0
    ? `\\begin{rSection}{${escapeLatex(titles.skills)}}
\\begin{tabular}{ @{} >{\\bfseries}l @{\\hspace{4ex}} l }
${skillRows}
\\end{tabular}
\\end{rSection}`
    : "";

  // Achievements
  const achItems = achievements
    .map((a) => `\\item \\textbf{${escapeLatex(a.title)}}${a.subtitle ? ` -- ${escapeLatex(a.subtitle)}` : ""} \\hfill ${escapeLatex(a.date)}`)
    .join("\n");

  const achievementsBlock = achievements.length > 0
    ? `\\begin{rSection}{${escapeLatex(titles.achievements)}}
\\begin{itemize}[leftmargin=*,noitemsep,topsep=0pt]
${achItems}
\\end{itemize}
\\end{rSection}`
    : "";

  // Custom Sections
  const customSectionsBlock = (customSections || [])
    .map((sec) => {
      const items = (sec.items || [])
        .map((item) => {
          const bullets = (item.bullets || []).map((b) => `\\item ${escapeLatex(b)}`).join("\n");
          return `\\begin{rSubsection}{${escapeLatex(item.title)}}{${escapeLatex(item.date)}}{${escapeLatex(item.subtitle)}}{}\n${bullets}\n\\end{rSubsection}`;
        })
        .join("\n");
      return `\\begin{rSection}{${escapeLatex(sec.title || "Additional Section")}}\n${items}\n\\end{rSection}`;
    })
    .join("\n\n");

  return `%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% Classic CV Template (Template 2)
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

\\documentclass[letterpaper,10pt]{article}
\\usepackage[left=0.65in,top=0.4in,right=0.65in,bottom=0.45in]{geometry}
\\usepackage{array}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage{ifthen}
\\usepackage[hidelinks]{hyperref}

\\pagestyle{empty}
\\setlength{\\parindent}{0pt}

% Section formatting
\\newenvironment{rSection}[1]{
  \\vspace{4pt}
  {\\bfseries\\MakeUppercase{#1}}
  \\vspace{-4pt}
  \\hrule height 0.8pt
  \\vspace{4pt}
  \\begin{list}{}{
    \\setlength{\\leftmargin}{0em}
  }
  \\item[]
}{
  \\end{list}
}

\\newenvironment{rSubsection}[4]{
  {\\bfseries #1} \\hfill {#2}
  \\ifthenelse{\\equal{#3}{}}{}{
    \\\\
    {\\em #3} \\hfill {\\em #4}
  }
  \\smallskip
  \\begin{list}{$\\cdot$}{\\leftmargin=1.2em \\itemsep=-0.2em \\topsep=0.1em}
}{
  \\end{list}
  \\vspace{2pt}
}

\\begin{document}

\\begin{center}
  {\\LARGE\\bfseries ${escapeLatex(personalInfo.fullName || "Your Name")}}\\\\[4pt]
  ${addressLine}
\\end{center}

${summaryBlock}

${educationBlock}

${experienceBlock}

${projectsBlock}

${skillsBlock}

${achievementsBlock}

${customSectionsBlock}

\\end{document}
`;
}

function generateTemplate3Latex(model: ResumeDocumentModel): string {
  const { personalInfo, summary, experience, education, skills, projects, achievements, customSections, sectionTitles } = model;

  const titles = {
    summary: (sectionTitles?.summary || "Summary").toUpperCase(),
    experience: (sectionTitles?.experience || "Experience").toUpperCase(),
    education: (sectionTitles?.education || "Education").toUpperCase(),
    skills: (sectionTitles?.skills || "Technical Skills").toUpperCase(),
    projects: (sectionTitles?.projects || "Projects").toUpperCase(),
    achievements: (sectionTitles?.achievements || "Honors & Awards").toUpperCase(),
  };

  const contactLinks: string[] = [];
  if (personalInfo.email) contactLinks.push(`\\href{mailto:${personalInfo.email}}{${escapeLatex(personalInfo.email)}}`);
  if (personalInfo.phone) contactLinks.push(`\\href{tel:${personalInfo.phone}}{${escapeLatex(personalInfo.phone)}}`);
  if (personalInfo.linkedin) contactLinks.push(`\\href{https://${personalInfo.linkedin}}{LinkedIn}`);
  if (personalInfo.github) contactLinks.push(`\\href{https://${personalInfo.github}}{GitHub}`);
  if (personalInfo.portfolio) contactLinks.push(`\\href{https://${personalInfo.portfolio}}{Portfolio}`);

  const summaryBlock = summary
    ? `\\section{${titles.summary}}
${escapeLatex(summary)}
\\vspace{3pt}`
    : "";

  const expItems = experience
    .map((exp) => {
      const bullets = exp.bullets
        .map((b) => `  \\item ${escapeLatex(b)}`)
        .join("\n");

      return `\\textbf{${escapeLatex(exp.role)}} \\hfill {\\small ${escapeLatex(exp.startDate)} -- ${escapeLatex(exp.endDate)}}\\\\
\\textsl{${escapeLatex(exp.company)}} \\hfill {\\small ${escapeLatex(exp.location)}}
\\begin{itemize}[leftmargin=1.2em, itemsep=1pt, topsep=2pt]
${bullets}
\\end{itemize}
\\vspace{3pt}`;
    })
    .join("\n\n");

  const experienceBlock = experience.length > 0
    ? `\\section{${titles.experience}}
${expItems}`
    : "";

  const eduItems = education
    .map((edu) => {
      return `\\textbf{${escapeLatex(edu.institution)}} \\hfill {\\small ${escapeLatex(edu.startDate)} -- ${escapeLatex(edu.endDate)}}\\\\
\\textsl{${escapeLatex(edu.degree)}${edu.field ? `, ${escapeLatex(edu.field)}` : ""}} \\hfill {\\small ${escapeLatex(edu.location)}}
\\vspace{3pt}`;
    })
    .join("\n\n");

  const educationBlock = education.length > 0
    ? `\\section{${titles.education}}
${eduItems}`
    : "";

  const skillRows = skills
    .map((s) => `\\textbf{${escapeLatex(s.category)}:} ${escapeLatex(s.skills.join(", "))}`)
    .join("\\\\\n");

  const skillsBlock = skills.length > 0
    ? `\\section{${titles.skills}}
${skillRows}
\\vspace{3pt}`
    : "";

  const projItems = projects
    .map((proj) => {
      const bullets = proj.bullets
        .map((b) => `  \\item ${escapeLatex(b)}`)
        .join("\n");

      return `\\textbf{${escapeLatex(proj.title)}}${proj.subtitle ? ` -- \\textsl{${escapeLatex(proj.subtitle)}}` : ""} \\hfill {\\small ${escapeLatex(proj.startDate)} -- ${escapeLatex(proj.endDate)}}
\\begin{itemize}[leftmargin=1.2em, itemsep=1pt, topsep=2pt]
${bullets}
\\end{itemize}
\\vspace{3pt}`;
    })
    .join("\n\n");

  const projectsBlock = projects.length > 0
    ? `\\section{${titles.projects}}
${projItems}`
    : "";

  const achRows = achievements
    .map((a) => `\\textbf{${escapeLatex(a.title)}}${a.subtitle ? ` -- ${escapeLatex(a.subtitle)}` : ""} \\hfill {\\small ${escapeLatex(a.date)}}`)
    .join("\\\\\n");

  const achievementsBlock = achievements.length > 0
    ? `\\section{${titles.achievements}}
${achRows}
\\vspace{3pt}`
    : "";

  const customSectionsBlock = (customSections || [])
    .map((sec) => {
      const title = (sec.title || "ADDITIONAL").toUpperCase();
      const items = (sec.items || [])
        .map((item) => {
          const bullets = (item.bullets || []).map((b) => `  \\item ${escapeLatex(b)}`).join("\n");
          return `\\textbf{${escapeLatex(item.title)}}${item.subtitle ? ` -- \\textsl{${escapeLatex(item.subtitle)}}` : ""} \\hfill {\\small ${escapeLatex(item.date)}}\n\\begin{itemize}[leftmargin=1.2em, itemsep=1pt, topsep=2pt]\n${bullets}\n\\end{itemize}\n\\vspace{3pt}`;
        })
        .join("\n\n");
      return `\\section{${escapeLatex(title)}}\n${items}`;
    })
    .join("\n\n");

  return `% Modern Tech Resume (Template 3)
\\documentclass[letterpaper,10pt]{article}
\\usepackage[margin=0.55in,top=0.35in,bottom=0.35in]{geometry}
\\usepackage{helvet}
\\renewcommand{\\familydefault}{\\sfdefault}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}

\\pagestyle{empty}
\\setlength{\\parindent}{0pt}

\\titleformat{\\section}{\\bfseries\\fontsize{11}{13}\\selectfont\\raggedright}{}{0em}{}[\\vspace{1pt}\\hrule height 0.6pt]
\\titlespacing*{\\section}{0pt}{5pt}{3pt}

\\begin{document}

{\\LARGE\\bfseries ${escapeLatex(personalInfo.fullName || "Your Name")}}\\\\[2pt]
{\\small ${contactLinks.join(" $\\cdot$ ")}}\\\\[4pt]

${summaryBlock}

${experienceBlock}

${projectsBlock}

${skillsBlock}

${educationBlock}

${achievementsBlock}

${customSectionsBlock}

\\end{document}
`;
}

function generateTemplate4Latex(model: ResumeDocumentModel): string {
  // Minimalist Executive — Georgia serif, left-aligned, em-dash job rows, minimal visual noise
  const { personalInfo, summary, experience, education, skills, projects, achievements, customSections, sectionTitles } = model;

  const titles = {
    summary: (sectionTitles?.summary || "Profile").toUpperCase(),
    experience: (sectionTitles?.experience || "Experience").toUpperCase(),
    education: (sectionTitles?.education || "Education").toUpperCase(),
    skills: (sectionTitles?.skills || "Competencies").toUpperCase(),
    projects: (sectionTitles?.projects || "Selected Projects").toUpperCase(),
    achievements: (sectionTitles?.achievements || "Achievements").toUpperCase(),
  };

  const contactParts: string[] = [];
  if (personalInfo.email) contactParts.push(escapeLatex(personalInfo.email));
  if (personalInfo.phone) contactParts.push(escapeLatex(personalInfo.phone));
  if (personalInfo.location) contactParts.push(escapeLatex(personalInfo.location));
  if (personalInfo.linkedin) contactParts.push(escapeLatex(personalInfo.linkedin));

  const headerBlock = `{\\fontsize{21}{24}\\selectfont ${escapeLatex(personalInfo.fullName || "Your Name")}}\\\\[4pt]
{\\small\\color{mygray} ${contactParts.join(" \\enspace|\\enspace ")}}
\\vspace{4pt}\\hrule height 0.4pt\\vspace{8pt}`;

  const summaryBlock = summary
    ? `\\minsection{${titles.summary}}
${escapeLatex(summary)}
\\vspace{6pt}`
    : "";

  const expItems = experience
    .map((exp) => {
      const bullets = exp.bullets
        .map((b) => `  \\item ${escapeLatex(b)}`)
        .join("\n");
      return `{\\bfseries ${escapeLatex(exp.company)} --- ${escapeLatex(exp.role)}} \\hfill {\\small ${escapeLatex(exp.startDate)} -- ${escapeLatex(exp.endDate)}}
\\begin{itemize}[leftmargin=1.2em, itemsep=1pt, topsep=2pt, parsep=0pt]
${bullets}
\\end{itemize}
\\vspace{3pt}`;
    })
    .join("\n");

  const experienceBlock = experience.length > 0
    ? `\\minsection{${titles.experience}}
${expItems}`
    : "";

  const projItems = projects
    .map((proj) => {
      const bullets = proj.bullets
        .map((b) => `  \\item ${escapeLatex(b)}`)
        .join("\n");
      return `{\\bfseries ${escapeLatex(proj.title)}}${proj.subtitle ? ` --- {\\itshape ${escapeLatex(proj.subtitle)}}` : ""} \\hfill {\\small ${escapeLatex(proj.startDate)} -- ${escapeLatex(proj.endDate)}}
\\begin{itemize}[leftmargin=1.2em, itemsep=1pt, topsep=2pt, parsep=0pt]
${bullets}
\\end{itemize}
\\vspace{3pt}`;
    })
    .join("\n");

  const projectsBlock = projects.length > 0
    ? `\\minsection{${titles.projects}}
${projItems}`
    : "";

  const skillRows = skills
    .map((s) => `{\\bfseries ${escapeLatex(s.category)}:} ${escapeLatex(s.skills.join(", "))}`)
    .join("\\\\\n");

  const skillsBlock = skills.length > 0
    ? `\\minsection{${titles.skills}}
${skillRows}
\\vspace{4pt}`
    : "";

  const eduItems = education
    .map((edu) => `{\\bfseries ${escapeLatex(edu.institution)} --- ${escapeLatex(edu.degree)}${edu.field ? `, ${escapeLatex(edu.field)}` : ""}} \\hfill {\\small ${escapeLatex(edu.startDate)} -- ${escapeLatex(edu.endDate)}}`)
    .join("\\\\\n");

  const educationBlock = education.length > 0
    ? `\\minsection{${titles.education}}
${eduItems}
\\vspace{4pt}`
    : "";

  const achRows = achievements
    .map((a) => `{\\bfseries ${escapeLatex(a.title)}}${a.subtitle ? ` --- ${escapeLatex(a.subtitle)}` : ""} \\hfill {\\small\\color{mygray} ${escapeLatex(a.date)}}`)
    .join("\\\\\n");

  const achievementsBlock = achievements.length > 0
    ? `\\minsection{${titles.achievements}}
${achRows}
\\vspace{4pt}`
    : "";

  const customSectionsBlock = (customSections || [])
    .map((sec) => {
      const title = (sec.title || "Additional").toUpperCase();
      const items = (sec.items || [])
        .map((item) => {
          const bullets = (item.bullets || []).map((b) => `  \\item ${escapeLatex(b)}`).join("\n");
          return `{\\bfseries ${escapeLatex(item.title)}}${item.subtitle ? ` --- {\\itshape ${escapeLatex(item.subtitle)}}` : ""} \\hfill {\\small ${escapeLatex(item.date)}}
\\begin{itemize}[leftmargin=1.2em, itemsep=1pt, topsep=2pt, parsep=0pt]
${bullets}
\\end{itemize}
\\vspace{3pt}`;
        })
        .join("\n");
      return `\\minsection{${escapeLatex(title)}}
${items}`;
    })
    .join("\n\n");

  return `% Minimalist Executive Resume (Template 4)
\\documentclass[letterpaper,10pt]{article}
\\usepackage[margin=0.65in,top=0.5in,bottom=0.5in]{geometry}
\\usepackage{mathptmx}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{xcolor}

\\definecolor{mygray}{gray}{0.45}
\\pagestyle{empty}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0pt}

\\newcommand{\\minsection}[1]{%
  {\\bfseries\\fontsize{10.5}{13}\\selectfont\\MakeUppercase{#1}}%
  \\vspace{2pt}\\\\[-4pt]%
  \\vspace{6pt}%
}

\\begin{document}

${headerBlock}

${summaryBlock}

${experienceBlock}

${projectsBlock}

${skillsBlock}

${educationBlock}

${achievementsBlock}

${customSectionsBlock}

\\end{document}
`;
}

