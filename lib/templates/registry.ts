import type { ResumeDocumentModel } from "@/server/documents/resume-document-model";

export interface ResumeTemplateDefinition {
  id: string;
  name: string;
  category: "Academic & LaTeX" | "Tech & Engineering" | "Executive & Clean" | "Modern Minimal";
  description: string;
  fontFamily: string;
  accentColor: string;
  version: string;
  renderHtml: (model: ResumeDocumentModel) => string;
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ==========================================
// TEMPLATE 1: Academic & LaTeX Ivy (template1.tex fidelity)
// ==========================================
export function renderTemplate1Academic(model: ResumeDocumentModel): string {
  const { personalInfo, summary, experience, education, skills, projects, achievements } = model;

  const contactLinks: string[] = [];
  if (personalInfo.phone) contactLinks.push(`<a href="tel:${escapeHtml(personalInfo.phone)}">${escapeHtml(personalInfo.phone)}</a>`);
  if (personalInfo.email) contactLinks.push(`<a href="mailto:${escapeHtml(personalInfo.email)}">${escapeHtml(personalInfo.email)}</a>`);
  if (personalInfo.linkedin) contactLinks.push(`<a href="https://${escapeHtml(personalInfo.linkedin)}" target="_blank">${escapeHtml(personalInfo.linkedin)}</a>`);
  if (personalInfo.github) contactLinks.push(`<a href="https://${escapeHtml(personalInfo.github)}" target="_blank">${escapeHtml(personalInfo.github)}</a>`);
  if (personalInfo.portfolio) contactLinks.push(`<a href="https://${escapeHtml(personalInfo.portfolio)}" target="_blank">portfolio</a>`);

  const summaryHtml = summary ? `
    <section class="sec">
      <h2 class="sec-title">SUMMARY</h2>
      <div class="summary-text" contenteditable="true" data-field="summary">${escapeHtml(summary)}</div>
    </section>
  ` : "";

  const experienceHtml = experience.length > 0 ? `
    <section class="sec">
      <h2 class="sec-title">WORK EXPERIENCE</h2>
      <div class="items-list">
        ${experience.map((exp) => `
          <div class="subheading-block">
            <div class="row-between">
              <strong class="item-head" contenteditable="true" data-field="exp-${exp.id}-company">${escapeHtml(exp.company)}</strong>
              <span class="subtext" contenteditable="true" data-field="exp-${exp.id}-dates">${escapeHtml(exp.startDate)} – ${escapeHtml(exp.endDate)}</span>
            </div>
            <div class="row-between">
              <em class="subtext italic" contenteditable="true" data-field="exp-${exp.id}-role">${escapeHtml(exp.role)}</em>
              <em class="subtext italic" contenteditable="true" data-field="exp-${exp.id}-location">${escapeHtml(exp.location)}</em>
            </div>
            <ul class="bullet-list">
              ${exp.bullets.map((b, bIdx) => `
                <li contenteditable="true" data-field="exp-${exp.id}-bullet-${bIdx}">${escapeHtml(b)}</li>
              `).join("")}
            </ul>
          </div>
        `).join("")}
      </div>
    </section>
  ` : "";

  const educationHtml = education.length > 0 ? `
    <section class="sec">
      <h2 class="sec-title">EDUCATION</h2>
      <div class="items-list">
        ${education.map((edu) => `
          <div class="subheading-block">
            <div class="row-between">
              <strong class="item-head" contenteditable="true" data-field="edu-${edu.id}-inst">${escapeHtml(edu.institution)}</strong>
              <span class="subtext" contenteditable="true" data-field="edu-${edu.id}-dates">${escapeHtml(edu.startDate)} – ${escapeHtml(edu.endDate)}</span>
            </div>
            <div class="row-between">
              <em class="subtext italic" contenteditable="true" data-field="edu-${edu.id}-degree">${escapeHtml(edu.degree)}${edu.field ? `, ${escapeHtml(edu.field)}` : ""}</em>
              <em class="subtext italic" contenteditable="true" data-field="edu-${edu.id}-loc">${escapeHtml(edu.location)}</em>
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  ` : "";

  const skillsHtml = skills.length > 0 ? `
    <section class="sec">
      <h2 class="sec-title">SKILLS</h2>
      <ul class="bullet-list skills-list">
        ${skills.map((s) => `
          <li>
            <strong contenteditable="true" data-field="skill-${s.id}-cat">${escapeHtml(s.category)}:</strong>
            <span contenteditable="true" data-field="skill-${s.id}-items">${escapeHtml(s.skills.join(", "))}</span>
          </li>
        `).join("")}
      </ul>
    </section>
  ` : "";

  const projectsHtml = projects.length > 0 ? `
    <section class="sec">
      <h2 class="sec-title">PROJECTS</h2>
      <div class="items-list">
        ${projects.map((p) => `
          <div class="subheading-block">
            <div class="row-between">
              <span class="item-head">
                <strong contenteditable="true" data-field="proj-${p.id}-title">${escapeHtml(p.title)}</strong>
                ${p.subtitle ? `<span class="proj-sub"> -- ${escapeHtml(p.subtitle)}</span>` : ""}
              </span>
              <span class="subtext" contenteditable="true" data-field="proj-${p.id}-dates">${escapeHtml(p.startDate)} – ${escapeHtml(p.endDate)}</span>
            </div>
            <ul class="bullet-list">
              ${p.bullets.map((b, bIdx) => `
                <li contenteditable="true" data-field="proj-${p.id}-bullet-${bIdx}">${escapeHtml(b)}</li>
              `).join("")}
            </ul>
          </div>
        `).join("")}
      </div>
    </section>
  ` : "";

  const achievementsHtml = achievements.length > 0 ? `
    <section class="sec">
      <h2 class="sec-title">ACHIEVEMENTS AND ACTIVITIES</h2>
      <div class="items-list">
        ${achievements.map((a) => `
          <div class="row-between ach-row">
            <div class="ach-text">
              <strong contenteditable="true" data-field="ach-${a.id}-title">${escapeHtml(a.title)}</strong>
              ${a.subtitle ? ` -- <span contenteditable="true" data-field="ach-${a.id}-sub">${escapeHtml(a.subtitle)}</span>` : ""}
            </div>
            <span class="subtext" contenteditable="true" data-field="ach-${a.id}-date">${escapeHtml(a.date)}</span>
          </div>
        `).join("")}
      </div>
    </section>
  ` : "";

  return `
  <div class="resume-sheet template-academic">
    <style>
      .template-academic {
        font-family: 'Times New Roman', Times, serif;
        font-size: 9.2pt;
        line-height: 1.35;
        color: #111827;
        background: #ffffff;
        box-sizing: border-box;
        padding: 0.35in 0.55in;
        width: 8.5in;
        min-height: 11in;
        margin: 0 auto;
      }
      .template-academic a { color: #111827; text-decoration: none; }
      .template-academic a:hover { text-decoration: underline; }
      .template-academic .header { text-align: center; margin-bottom: 6px; }
      .template-academic .name { font-size: 17.5pt; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 2px; }
      .template-academic .loc { font-size: 9pt; margin-bottom: 2px; }
      .template-academic .contact-bar { font-size: 9pt; display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; }
      .template-academic .divider { color: #4b5563; }
      .template-academic .sec { margin-top: 6px; margin-bottom: 4px; }
      .template-academic .sec-title {
        font-size: 11pt;
        font-weight: bold;
        text-transform: uppercase;
        border-bottom: 1px solid #111827;
        padding-bottom: 1px;
        margin: 0 0 3px 0;
        letter-spacing: 0.3px;
      }
      .template-academic .row-between { display: flex; justify-content: space-between; align-items: baseline; }
      .template-academic .item-head { font-size: 10pt; font-weight: bold; }
      .template-academic .subtext { font-size: 9pt; }
      .template-academic .italic { font-style: italic; }
      .template-academic .subheading-block { margin-bottom: 4px; }
      .template-academic .bullet-list { margin: 2px 0 3px 0; padding-left: 16px; list-style-type: disc; }
      .template-academic .bullet-list li { margin-bottom: 1.5px; font-size: 9.1pt; line-height: 1.3; }
      .template-academic .skills-list { list-style-type: none; padding-left: 0; }
      .template-academic .skills-list li { margin-bottom: 2px; }
      .template-academic .summary-text { font-size: 9.1pt; line-height: 1.35; margin-bottom: 2px; text-align: justify; }
      .template-academic .ach-row { margin-bottom: 2px; }
      .template-academic [contenteditable="true"]:hover { outline: 1px dashed rgba(16, 185, 129, 0.5); }
      .template-academic [contenteditable="true"]:focus { outline: 2px solid #059669; background-color: rgba(16, 185, 129, 0.05); }
    </style>
    <div class="header">
      <div class="name" contenteditable="true" data-field="personalInfo.fullName">${escapeHtml(personalInfo.fullName || "YOUR NAME")}</div>
      ${personalInfo.location ? `<div class="loc" contenteditable="true" data-field="personalInfo.location">${escapeHtml(personalInfo.location)}</div>` : ""}
      <div class="contact-bar">
        ${contactLinks.join(' <span class="divider">|</span> ')}
      </div>
    </div>
    ${summaryHtml}
    ${experienceHtml}
    ${educationHtml}
    ${skillsHtml}
    ${projectsHtml}
    ${achievementsHtml}
  </div>
  `;
}

// ==========================================
// TEMPLATE 2: Trey Hunner Classic CV (template2.tex fidelity)
// ==========================================
export function renderTemplate2Classic(model: ResumeDocumentModel): string {
  const { personalInfo, experience, education, skills, projects } = model;

  const contactItems: string[] = [
    personalInfo.phone,
    personalInfo.email,
    personalInfo.github,
    personalInfo.linkedin,
  ].filter(Boolean);

  return `
  <div class="resume-sheet template-classic">
    <style>
      .template-classic {
        font-family: 'Times New Roman', Times, serif;
        font-size: 9.5pt;
        line-height: 1.38;
        color: #0f172a;
        background: #ffffff;
        box-sizing: border-box;
        padding: 0.45in 0.7in;
        width: 8.5in;
        min-height: 11in;
        margin: 0 auto;
      }
      .template-classic .cv-name {
        font-size: 20pt;
        font-weight: bold;
        letter-spacing: 1px;
        text-transform: uppercase;
        margin-bottom: 4px;
      }
      .template-classic .cv-address {
        font-size: 9pt;
        color: #334155;
        margin-bottom: 16px;
        line-height: 1.4;
      }
      .template-classic .cv-sec {
        margin-bottom: 12px;
      }
      .template-classic .cv-sec-title {
        font-size: 11pt;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        border-bottom: 1.5px solid #0f172a;
        padding-bottom: 2px;
        margin-bottom: 6px;
      }
      .template-classic .cv-subheading {
        display: flex;
        justify-content: space-between;
        font-weight: bold;
        font-size: 10pt;
      }
      .template-classic .cv-subline {
        display: flex;
        justify-content: space-between;
        font-style: italic;
        font-size: 9pt;
        color: #334155;
        margin-bottom: 3px;
      }
      .template-classic .cv-bullets {
        margin: 2px 0 8px 18px;
        padding-left: 0;
      }
      .template-classic .cv-bullets li {
        margin-bottom: 3px;
      }
      .template-classic .cv-skill-table {
        width: 100%;
        border-collapse: collapse;
      }
      .template-classic .cv-skill-table td {
        padding: 2px 0;
        vertical-align: top;
      }
      .template-classic .cv-skill-table td.cat {
        font-weight: bold;
        width: 25%;
      }
    </style>

    <div class="cv-name" contenteditable="true" data-field="personalInfo.fullName">${escapeHtml(personalInfo.fullName || "First Last")}</div>
    <div class="cv-address" contenteditable="true" data-field="personalInfo.address">
      ${contactItems.map(escapeHtml).join(" &bull; ")}
    </div>

    ${education.length > 0 ? `
      <div class="cv-sec">
        <div class="cv-sec-title">Education</div>
        ${education.map((edu) => `
          <div class="cv-subheading">
            <span contenteditable="true" data-field="edu-${edu.id}-inst">${escapeHtml(edu.institution)}</span>
            <span contenteditable="true" data-field="edu-${edu.id}-dates">${escapeHtml(edu.startDate)} – ${escapeHtml(edu.endDate)}</span>
          </div>
          <div class="cv-subline">
            <span contenteditable="true" data-field="edu-${edu.id}-deg">${escapeHtml(edu.degree)}</span>
            <span contenteditable="true" data-field="edu-${edu.id}-loc">${escapeHtml(edu.location)}</span>
          </div>
        `).join("")}
      </div>
    ` : ""}

    ${experience.length > 0 ? `
      <div class="cv-sec">
        <div class="cv-sec-title">Work Experience</div>
        ${experience.map((exp) => `
          <div class="cv-subheading">
            <span contenteditable="true" data-field="exp-${exp.id}-comp">${escapeHtml(exp.company)}</span>
            <span contenteditable="true" data-field="exp-${exp.id}-dates">${escapeHtml(exp.startDate)} – ${escapeHtml(exp.endDate)}</span>
          </div>
          <div class="cv-subline">
            <span contenteditable="true" data-field="exp-${exp.id}-role">${escapeHtml(exp.role)}</span>
            <span contenteditable="true" data-field="exp-${exp.id}-loc">${escapeHtml(exp.location)}</span>
          </div>
          <ul class="cv-bullets">
            ${exp.bullets.map((b, bIdx) => `
              <li contenteditable="true" data-field="exp-${exp.id}-b-${bIdx}">${escapeHtml(b)}</li>
            `).join("")}
          </ul>
        `).join("")}
      </div>
    ` : ""}

    ${projects.length > 0 ? `
      <div class="cv-sec">
        <div class="cv-sec-title">Projects</div>
        ${projects.map((p) => `
          <div class="cv-subheading">
            <span contenteditable="true" data-field="proj-${p.id}-title">${escapeHtml(p.title)}</span>
            <span contenteditable="true" data-field="proj-${p.id}-dates">${escapeHtml(p.startDate)} – ${escapeHtml(p.endDate)}</span>
          </div>
          ${p.subtitle ? `<div class="cv-subline"><span>${escapeHtml(p.subtitle)}</span></div>` : ""}
          <ul class="cv-bullets">
            ${p.bullets.map((b, bIdx) => `
              <li contenteditable="true" data-field="proj-${p.id}-b-${bIdx}">${escapeHtml(b)}</li>
            `).join("")}
          </ul>
        `).join("")}
      </div>
    ` : ""}

    ${skills.length > 0 ? `
      <div class="cv-sec">
        <div class="cv-sec-title">Technical Skills</div>
        <table class="cv-skill-table">
          ${skills.map((s) => `
            <tr>
              <td class="cat" contenteditable="true" data-field="skill-${s.id}-cat">${escapeHtml(s.category)}</td>
              <td contenteditable="true" data-field="skill-${s.id}-skills">${escapeHtml(s.skills.join(", "))}</td>
            </tr>
          `).join("")}
        </table>
      </div>
    ` : ""}
  </div>
  `;
}

// ==========================================
// TEMPLATE 3: Modern Tech / Silicon Valley
// ==========================================
export function renderTemplate3ModernTech(model: ResumeDocumentModel): string {
  const { personalInfo, summary, experience, education, skills, projects, achievements } = model;

  return `
  <div class="resume-sheet template-tech">
    <style>
      .template-tech {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        font-size: 9.3pt;
        line-height: 1.4;
        color: #1e293b;
        background: #ffffff;
        box-sizing: border-box;
        padding: 0.45in 0.55in;
        width: 8.5in;
        min-height: 11in;
        margin: 0 auto;
      }
      .template-tech .tech-header {
        border-bottom: 2px solid #0f766e;
        padding-bottom: 12px;
        margin-bottom: 12px;
      }
      .template-tech .tech-name {
        font-size: 22pt;
        font-weight: 800;
        color: #0f172a;
        letter-spacing: -0.5px;
        margin-bottom: 2px;
      }
      .template-tech .tech-role {
        font-size: 11pt;
        font-weight: 600;
        color: #0f766e;
        margin-bottom: 6px;
      }
      .template-tech .tech-contacts {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        font-size: 8.8pt;
        color: #64748b;
      }
      .template-tech .tech-sec-title {
        font-size: 11pt;
        font-weight: 700;
        text-transform: uppercase;
        color: #0f766e;
        letter-spacing: 0.5px;
        margin: 12px 0 6px 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .template-tech .tech-sec-title::after {
        content: '';
        flex: 1;
        height: 1px;
        background: #e2e8f0;
      }
      .template-tech .tech-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 2px;
      }
      .template-tech .tech-bold { font-weight: 700; color: #0f172a; }
      .template-tech .tech-sub { color: #64748b; font-size: 8.8pt; }
      .template-tech .tech-bullets {
        margin: 3px 0 8px 18px;
        padding-left: 0;
      }
      .template-tech .tech-bullets li {
        margin-bottom: 2.5px;
      }
      .template-tech .skill-badge {
        display: inline-block;
        background: #f0fdfa;
        border: 1px solid #ccfbf1;
        color: #0f766e;
        font-weight: 500;
        padding: 1px 6px;
        border-radius: 4px;
        margin: 2px;
        font-size: 8.5pt;
      }
    </style>

    <div class="tech-header">
      <div class="tech-name" contenteditable="true" data-field="personalInfo.fullName">${escapeHtml(personalInfo.fullName)}</div>
      <div class="tech-role" contenteditable="true" data-field="metadata.targetRole">${escapeHtml(model.metadata.targetRole || "Software & AI Engineer")}</div>
      <div class="tech-contacts">
        ${personalInfo.email ? `<span>✉ ${escapeHtml(personalInfo.email)}</span>` : ""}
        ${personalInfo.phone ? `<span>☎ ${escapeHtml(personalInfo.phone)}</span>` : ""}
        ${personalInfo.location ? `<span>📍 ${escapeHtml(personalInfo.location)}</span>` : ""}
        ${personalInfo.github ? `<span>⌥ ${escapeHtml(personalInfo.github)}</span>` : ""}
        ${personalInfo.linkedin ? `<span>in ${escapeHtml(personalInfo.linkedin)}</span>` : ""}
      </div>
    </div>

    ${summary ? `
      <div class="tech-sec">
        <div class="tech-sec-title">About</div>
        <div style="font-size: 9.1pt; line-height: 1.4;" contenteditable="true" data-field="summary">${escapeHtml(summary)}</div>
      </div>
    ` : ""}

    ${experience.length > 0 ? `
      <div class="tech-sec">
        <div class="tech-sec-title">Experience</div>
        ${experience.map((exp) => `
          <div style="margin-bottom: 8px;">
            <div class="tech-row">
              <span class="tech-bold">${escapeHtml(exp.company)} — <span style="font-weight: 500; color: #334155;">${escapeHtml(exp.role)}</span></span>
              <span class="tech-sub">${escapeHtml(exp.startDate)} - ${escapeHtml(exp.endDate)}</span>
            </div>
            <ul class="tech-bullets">
              ${exp.bullets.map((b, bIdx) => `
                <li contenteditable="true" data-field="exp-${exp.id}-b-${bIdx}">${escapeHtml(b)}</li>
              `).join("")}
            </ul>
          </div>
        `).join("")}
      </div>
    ` : ""}

    ${projects.length > 0 ? `
      <div class="tech-sec">
        <div class="tech-sec-title">Featured Projects</div>
        ${projects.map((p) => `
          <div style="margin-bottom: 8px;">
            <div class="tech-row">
              <span class="tech-bold">${escapeHtml(p.title)}</span>
              <span class="tech-sub">${escapeHtml(p.startDate)} - ${escapeHtml(p.endDate)}</span>
            </div>
            <ul class="tech-bullets">
              ${p.bullets.map((b, bIdx) => `
                <li contenteditable="true" data-field="proj-${p.id}-b-${bIdx}">${escapeHtml(b)}</li>
              `).join("")}
            </ul>
          </div>
        `).join("")}
      </div>
    ` : ""}

    ${skills.length > 0 ? `
      <div class="tech-sec">
        <div class="tech-sec-title">Skills & Technologies</div>
        ${skills.map((s) => `
          <div style="margin-bottom: 4px;">
            <strong style="font-size: 8.8pt; color: #334155;">${escapeHtml(s.category)}:</strong>
            ${s.skills.map((skill) => `<span class="skill-badge">${escapeHtml(skill)}</span>`).join("")}
          </div>
        `).join("")}
      </div>
    ` : ""}

    ${education.length > 0 ? `
      <div class="tech-sec">
        <div class="tech-sec-title">Education</div>
        ${education.map((edu) => `
          <div class="tech-row">
            <span class="tech-bold">${escapeHtml(edu.institution)} (${escapeHtml(edu.degree)})</span>
            <span class="tech-sub">${escapeHtml(edu.startDate)} - ${escapeHtml(edu.endDate)}</span>
          </div>
        `).join("")}
      </div>
    ` : ""}
  </div>
  `;
}

// ==========================================
// TEMPLATE 4: Minimalist Executive
// ==========================================
export function renderTemplate4Minimal(model: ResumeDocumentModel): string {
  const { personalInfo, summary, experience, education, skills, projects } = model;

  return `
  <div class="resume-sheet template-minimal">
    <style>
      .template-minimal {
        font-family: 'Georgia', serif;
        font-size: 9.3pt;
        line-height: 1.42;
        color: #262626;
        background: #ffffff;
        box-sizing: border-box;
        padding: 0.5in 0.65in;
        width: 8.5in;
        min-height: 11in;
        margin: 0 auto;
      }
      .template-minimal .min-header { text-align: left; margin-bottom: 14px; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px; }
      .template-minimal .min-name { font-size: 21pt; font-weight: normal; letter-spacing: 0.5px; color: #171717; }
      .template-minimal .min-contact { font-size: 8.8pt; color: #737373; margin-top: 4px; }
      .template-minimal .min-sec-title { font-size: 10.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #404040; margin: 12px 0 6px 0; }
      .template-minimal .min-row { display: flex; justify-content: space-between; font-weight: 600; font-size: 9.5pt; }
      .template-minimal .min-sub { color: #737373; font-style: italic; font-size: 8.8pt; }
      .template-minimal .min-bullets { margin: 3px 0 8px 18px; padding-left: 0; }
      .template-minimal .min-bullets li { margin-bottom: 2.5px; }
    </style>

    <div class="min-header">
      <div class="min-name" contenteditable="true" data-field="personalInfo.fullName">${escapeHtml(personalInfo.fullName)}</div>
      <div class="min-contact">
        ${[personalInfo.email, personalInfo.phone, personalInfo.location, personalInfo.linkedin].filter(Boolean).map(escapeHtml).join(" &nbsp;|&nbsp; ")}
      </div>
    </div>

    ${summary ? `
      <div>
        <div class="min-sec-title">Profile</div>
        <p style="margin: 0 0 10px 0;">${escapeHtml(summary)}</p>
      </div>
    ` : ""}

    ${experience.length > 0 ? `
      <div>
        <div class="min-sec-title">Experience</div>
        ${experience.map((exp) => `
          <div style="margin-bottom: 8px;">
            <div class="min-row">
              <span>${escapeHtml(exp.company)} — ${escapeHtml(exp.role)}</span>
              <span>${escapeHtml(exp.startDate)} – ${escapeHtml(exp.endDate)}</span>
            </div>
            <ul class="min-bullets">
              ${exp.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}
            </ul>
          </div>
        `).join("")}
      </div>
    ` : ""}

    ${projects.length > 0 ? `
      <div>
        <div class="min-sec-title">Selected Projects</div>
        ${projects.map((p) => `
          <div style="margin-bottom: 8px;">
            <div class="min-row">
              <span>${escapeHtml(p.title)}</span>
              <span>${escapeHtml(p.startDate)} – ${escapeHtml(p.endDate)}</span>
            </div>
            <ul class="min-bullets">
              ${p.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}
            </ul>
          </div>
        `).join("")}
      </div>
    ` : ""}

    ${skills.length > 0 ? `
      <div>
        <div class="min-sec-title">Competencies</div>
        <ul class="min-bullets" style="list-style-type: none; padding-left: 0; margin-left: 0;">
          ${skills.map((s) => `<li><strong>${escapeHtml(s.category)}:</strong> ${escapeHtml(s.skills.join(", "))}</li>`).join("")}
        </ul>
      </div>
    ` : ""}

    ${education.length > 0 ? `
      <div>
        <div class="min-sec-title">Education</div>
        ${education.map((edu) => `
          <div class="min-row">
            <span>${escapeHtml(edu.institution)} — ${escapeHtml(edu.degree)}</span>
            <span>${escapeHtml(edu.startDate)} – ${escapeHtml(edu.endDate)}</span>
          </div>
        `).join("")}
      </div>
    ` : ""}
  </div>
  `;
}

// ==========================================
// TEMPLATE REGISTRY
// ==========================================
export const TEMPLATE_REGISTRY: Record<string, ResumeTemplateDefinition> = {
  "template-1": {
    id: "template-1",
    name: "Ivy Academic / Times New Roman",
    category: "Academic & LaTeX",
    description: "Faithful rendering of template1.tex with centered header, tabular subheadings, and dense STAR bullets.",
    fontFamily: "Times New Roman, serif",
    accentColor: "#111827",
    version: "1.0.0",
    renderHtml: renderTemplate1Academic,
  },
  "template-2": {
    id: "template-2",
    name: "Trey Hunner Classic CV",
    category: "Academic & LaTeX",
    description: "Faithful rendering of template2.tex (resume.cls) with left-aligned header and high ATS score.",
    fontFamily: "Times New Roman, serif",
    accentColor: "#0f172a",
    version: "1.0.0",
    renderHtml: renderTemplate2Classic,
  },
  "template-3": {
    id: "template-3",
    name: "Silicon Valley Tech Lead",
    category: "Tech & Engineering",
    description: "Modern tech aesthetic with emerald accents, interactive skill pills, and crisp sans-serif typography.",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    accentColor: "#0f766e",
    version: "1.0.0",
    renderHtml: renderTemplate3ModernTech,
  },
  "template-4": {
    id: "template-4",
    name: "Minimalist Executive",
    category: "Executive & Clean",
    description: "Editorial Georgia typography with balanced whitespace and dignified executive presence.",
    fontFamily: "Georgia, serif",
    accentColor: "#262626",
    version: "1.0.0",
    renderHtml: renderTemplate4Minimal,
  },
};

export function getTemplateRenderer(templateId: string): (model: ResumeDocumentModel) => string {
  const t = TEMPLATE_REGISTRY[templateId] || TEMPLATE_REGISTRY["template-1"];
  return t.renderHtml;
}
