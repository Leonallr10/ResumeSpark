import type { ResumeDocumentModel } from "@/server/documents/resume-document-model";
import { normalizeResumeDocument } from "@/server/documents/resume-document-model";
import { TEMPLATE_SPECS, type TemplateSpec } from "./specs";

function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function cleanUrl(url: string): string {
  if (!url) return "";
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

// ==========================================
// TEMPLATE 1 HTML: Classic Traditional
// ==========================================
export function renderTemplate1Html(
  rawModel: ResumeDocumentModel,
  spec: TemplateSpec = TEMPLATE_SPECS["template-1"],
): string {
  const model = normalizeResumeDocument(rawModel);
  const { personalInfo, summary, experience, education, skills, projects, extras, extrasLabel, sectionTitles } = model;

  const contactLinks: string[] = [];
  if (personalInfo.location) contactLinks.push(`<span contenteditable="true" data-field="personalInfo.location">${escapeHtml(personalInfo.location)}</span>`);
  if (personalInfo.email) contactLinks.push(`<a href="mailto:${escapeHtml(personalInfo.email)}" contenteditable="true" data-field="personalInfo.email">${escapeHtml(personalInfo.email)}</a>`);
  if (personalInfo.phone) contactLinks.push(`<span contenteditable="true" data-field="personalInfo.phone">${escapeHtml(personalInfo.phone)}</span>`);
  if (personalInfo.linkedin) contactLinks.push(`<a href="https://${escapeHtml(cleanUrl(personalInfo.linkedin))}" target="_blank" contenteditable="true" data-field="personalInfo.linkedin">${escapeHtml(cleanUrl(personalInfo.linkedin))}</a>`);
  if (personalInfo.github) contactLinks.push(`<a href="https://${escapeHtml(cleanUrl(personalInfo.github))}" target="_blank" contenteditable="true" data-field="personalInfo.github">${escapeHtml(cleanUrl(personalInfo.github))}</a>`);
  if (personalInfo.portfolio) contactLinks.push(`<a href="https://${escapeHtml(cleanUrl(personalInfo.portfolio))}" target="_blank" contenteditable="true" data-field="personalInfo.portfolio">${escapeHtml(cleanUrl(personalInfo.portfolio))}</a>`);

  const summaryHtml = summary?.trim() ? `
    <section class="sec">
      <div class="sec-title">${escapeHtml((sectionTitles?.summary || "Summary").toUpperCase())}</div>
      <hr class="sec-rule" />
      <div class="summary-text" contenteditable="true" data-field="summary">${escapeHtml(summary)}</div>
    </section>
  ` : "";

  const experienceHtml = experience.length > 0 ? `
    <section class="sec">
      <div class="sec-title">${escapeHtml((sectionTitles?.experience || "Work Experience").toUpperCase())}</div>
      <hr class="sec-rule" />
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
            ${exp.bullets && exp.bullets.length > 0 ? `
              <ul class="bullet-list">
                ${exp.bullets.map((b, bIdx) => `
                  <li contenteditable="true" data-field="exp-${exp.id}-bullet-${bIdx}">${escapeHtml(b)}</li>
                `).join("")}
              </ul>
            ` : ""}
          </div>
        `).join("")}
      </div>
    </section>
  ` : "";

  const educationHtml = education.length > 0 ? `
    <section class="sec">
      <div class="sec-title">${escapeHtml((sectionTitles?.education || "Education").toUpperCase())}</div>
      <hr class="sec-rule" />
      <div class="items-list">
        ${education.map((edu) => `
          <div class="subheading-block">
            <div class="row-between">
              <strong class="item-head" contenteditable="true" data-field="edu-${edu.id}-inst">${escapeHtml(edu.institution)}</strong>
              <span class="subtext" contenteditable="true" data-field="edu-${edu.id}-dates">${escapeHtml(edu.startDate)} – ${escapeHtml(edu.endDate)}</span>
            </div>
            <div class="row-between">
              <em class="subtext italic" contenteditable="true" data-field="edu-${edu.id}-degree">${escapeHtml([edu.degree, edu.field].filter(Boolean).join(", "))}</em>
              <em class="subtext italic" contenteditable="true" data-field="edu-${edu.id}-loc">${escapeHtml(edu.location)}</em>
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  ` : "";

  const skillsHtml = skills.length > 0 ? `
    <section class="sec">
      <div class="sec-title">${escapeHtml((sectionTitles?.skills || "Skills").toUpperCase())}</div>
      <hr class="sec-rule" />
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
      <div class="sec-title">${escapeHtml((sectionTitles?.projects || "Projects").toUpperCase())}</div>
      <hr class="sec-rule" />
      <div class="items-list">
        ${projects.map((p) => `
          <div class="subheading-block">
            <div class="row-between">
              <span class="item-head">
                <strong contenteditable="true" data-field="proj-${p.id}-title">${escapeHtml(p.title)}</strong>
                ${p.subtitle ? `<span class="proj-sub" contenteditable="true" data-field="proj-${p.id}-sub"> -- ${escapeHtml(p.subtitle)}</span>` : ""}
              </span>
              <span class="subtext" contenteditable="true" data-field="proj-${p.id}-dates">${escapeHtml([p.startDate, p.endDate].filter(Boolean).join(" – "))}</span>
            </div>
            ${p.bullets && p.bullets.length > 0 ? `
              <ul class="bullet-list">
                ${p.bullets.map((b, bIdx) => `
                  <li contenteditable="true" data-field="proj-${p.id}-bullet-${bIdx}">${escapeHtml(b)}</li>
                `).join("")}
              </ul>
            ` : ""}
          </div>
        `).join("")}
      </div>
    </section>
  ` : "";

  const extrasTitle = sectionTitles?.extras || extrasLabel || spec.defaultExtrasLabel;
  const extrasHtml = extras.length > 0 ? `
    <section class="sec">
      <div class="sec-title">${escapeHtml(extrasTitle.toUpperCase())}</div>
      <hr class="sec-rule" />
      <div class="items-list">
        ${extras.map((a) => `
          <div class="subheading-block">
            <div class="row-between">
              <span class="item-head">
                <strong contenteditable="true" data-field="extra-${a.id}-title">${escapeHtml(a.title)}</strong>
                ${a.subtitle ? `<span class="proj-sub" contenteditable="true" data-field="extra-${a.id}-sub"> -- ${escapeHtml(a.subtitle)}</span>` : ""}
              </span>
              <span class="subtext" contenteditable="true" data-field="extra-${a.id}-date">${escapeHtml(a.date)}</span>
            </div>
            ${a.bullets && a.bullets.length > 0 ? `
              <ul class="bullet-list">
                ${a.bullets.map((b, bIdx) => `
                  <li contenteditable="true" data-field="extra-${a.id}-bullet-${bIdx}">${escapeHtml(b)}</li>
                `).join("")}
              </ul>
            ` : ""}
          </div>
        `).join("")}
      </div>
    </section>
  ` : "";

  const customSections = model.customSections || [];
  const customSectionsHtml = customSections.map((sec) => {
    if (!sec) return "";
    const items = sec.items || [];
    const bullets = sec.bullets || [];
    const secTitle = escapeHtml((sec.title || "Additional Section").toUpperCase());

    return `
    <section class="sec">
      <div class="sec-title">${secTitle}</div>
      <hr class="sec-rule" />
      <div class="items-list">
        ${items.map((item) => `
          <div class="subheading-block">
            <div class="row-between">
              <span class="item-head">
                <strong contenteditable="true" data-field="custom-${sec.id}-${item.id}-title">${escapeHtml(item.title)}</strong>
                ${item.subtitle ? `<span class="proj-sub" contenteditable="true" data-field="custom-${sec.id}-${item.id}-sub"> -- ${escapeHtml(item.subtitle)}</span>` : ""}
              </span>
              <span class="subtext" contenteditable="true" data-field="custom-${sec.id}-${item.id}-date">${escapeHtml(item.date)}</span>
            </div>
            ${item.bullets && item.bullets.length > 0 ? `
              <ul class="bullet-list">
                ${item.bullets.map((b, bIdx) => `
                  <li contenteditable="true" data-field="custom-${sec.id}-${item.id}-bullet-${bIdx}">${escapeHtml(b)}</li>
                `).join("")}
              </ul>
            ` : ""}
          </div>
        `).join("")}
        ${bullets.length > 0 ? `
          <ul class="bullet-list">
            ${bullets.map((b, bIdx) => `
              <li contenteditable="true" data-field="custom-${sec.id}-bullet-${bIdx}">${escapeHtml(b)}</li>
            `).join("")}
          </ul>
        ` : ""}
        ${sec.content ? `<div class="summary-text" contenteditable="true" data-field="custom-${sec.id}-content">${escapeHtml(sec.content)}</div>` : ""}
      </div>
    </section>
    `;
  }).join("\n");

  return `
  <div class="resume-sheet template-classic-traditional">
    <style>
      .template-classic-traditional {
        font-family: 'Times New Roman', Times, serif;
        font-size: 9.5pt;
        line-height: 1.3;
        color: #111827;
        background: #ffffff;
        box-sizing: border-box;
        padding: 0.65in;
        width: 8.5in;
        min-height: 11in;
        margin: 0 auto;
      }
      .template-classic-traditional a { color: #111827; text-decoration: none; }
      .template-classic-traditional a:hover { text-decoration: underline; }
      .template-classic-traditional .header { text-align: center; margin-bottom: 6px; }
      .template-classic-traditional .name { font-size: 16pt; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 3pt; }
      .template-classic-traditional .contact-bar { font-size: 9pt; line-height: 12pt; display: flex; justify-content: center; gap: 6px; flex-wrap: wrap; }
      .template-classic-traditional .divider { color: #4b5563; }
      .template-classic-traditional .sec { margin-top: 8pt; margin-bottom: 3pt; }
      .template-classic-traditional .sec-title { font-size: 11pt; font-weight: bold; text-transform: uppercase; margin: 0 0 2pt 0; }
      .template-classic-traditional .sec-rule { border: none; border-top: 1px solid #111827; margin: 0 0 4pt 0; }
      .template-classic-traditional .row-between { display: flex; justify-content: space-between; align-items: baseline; }
      .template-classic-traditional .item-head { font-size: 9.8pt; font-weight: bold; }
      .template-classic-traditional .subtext { font-size: 9pt; }
      .template-classic-traditional .italic { font-style: italic; }
      .template-classic-traditional .subheading-block { margin-bottom: 4pt; }
      .template-classic-traditional .bullet-list { margin: 2pt 0 4pt 0; padding-left: 0.2in; list-style-type: disc; }
      .template-classic-traditional .bullet-list li { margin-bottom: 1pt; font-size: 9.3pt; text-align: justify; }
      .template-classic-traditional .skills-list { list-style-type: none; padding-left: 0; }
      .template-classic-traditional .skills-list li { margin-bottom: 2pt; }
      .template-classic-traditional .summary-text { font-size: 9.3pt; line-height: 12pt; text-align: justify; margin-bottom: 4pt; }
      .template-classic-traditional [contenteditable="true"]:hover { outline: 1px dashed rgba(16, 185, 129, 0.4); }
      .template-classic-traditional [contenteditable="true"]:focus { outline: 2px solid #059669; background-color: rgba(16, 185, 129, 0.04); }
    </style>
    <div class="header">
      <div class="name" contenteditable="true" data-field="personalInfo.fullName">${escapeHtml(personalInfo.fullName || "YOUR NAME").toUpperCase()}</div>
      <div class="contact-bar">
        ${contactLinks.join(' <span class="divider">|</span> ')}
      </div>
    </div>
    ${summaryHtml}
    ${experienceHtml}
    ${educationHtml}
    ${skillsHtml}
    ${projectsHtml}
    ${extrasHtml}
    ${customSectionsHtml}
  </div>
  `;
}

// ==========================================
// TEMPLATE 2 HTML: Modern Minimal
// ==========================================
export function renderTemplate2Html(
  rawModel: ResumeDocumentModel,
  spec: TemplateSpec = TEMPLATE_SPECS["template-2"],
): string {
  const model = normalizeResumeDocument(rawModel);
  const { personalInfo, summary, experience, education, skills, projects, extras, extrasLabel, sectionTitles } = model;
  const accent = spec.accentColor || "#1B6E5C";

  const contactLinks: string[] = [];
  if (personalInfo.location) contactLinks.push(`<span contenteditable="true" data-field="personalInfo.location">${escapeHtml(personalInfo.location)}</span>`);
  if (personalInfo.email) contactLinks.push(`<a href="mailto:${escapeHtml(personalInfo.email)}" contenteditable="true" data-field="personalInfo.email">${escapeHtml(personalInfo.email)}</a>`);
  if (personalInfo.phone) contactLinks.push(`<span contenteditable="true" data-field="personalInfo.phone">${escapeHtml(personalInfo.phone)}</span>`);
  if (personalInfo.linkedin) contactLinks.push(`<a href="https://${escapeHtml(cleanUrl(personalInfo.linkedin))}" target="_blank" contenteditable="true" data-field="personalInfo.linkedin">${escapeHtml(cleanUrl(personalInfo.linkedin))}</a>`);
  if (personalInfo.github) contactLinks.push(`<a href="https://${escapeHtml(cleanUrl(personalInfo.github))}" target="_blank" contenteditable="true" data-field="personalInfo.github">${escapeHtml(cleanUrl(personalInfo.github))}</a>`);
  if (personalInfo.portfolio) contactLinks.push(`<a href="https://${escapeHtml(cleanUrl(personalInfo.portfolio))}" target="_blank" contenteditable="true" data-field="personalInfo.portfolio">${escapeHtml(cleanUrl(personalInfo.portfolio))}</a>`);

  const headline = personalInfo.headline || model.metadata?.targetRole || "";

  const summaryHtml = summary?.trim() ? `
    <section class="sec">
      <div class="sec-title">${escapeHtml(sectionTitles?.summary || "Summary")}</div>
      <div class="summary-text" contenteditable="true" data-field="summary">${escapeHtml(summary)}</div>
    </section>
  ` : "";

  const experienceHtml = experience.length > 0 ? `
    <section class="sec">
      <div class="sec-title">${escapeHtml(sectionTitles?.experience || "Work Experience")}</div>
      <div class="items-list">
        ${experience.map((exp) => `
          <div class="subheading-block">
            <div class="row-between">
              <strong class="item-head" contenteditable="true" data-field="exp-${exp.id}-company">${escapeHtml(exp.company)}</strong>
              <span class="subtext accent" contenteditable="true" data-field="exp-${exp.id}-dates">${escapeHtml(exp.startDate)} – ${escapeHtml(exp.endDate)}</span>
            </div>
            <div class="row-between">
              <em class="subtext italic" contenteditable="true" data-field="exp-${exp.id}-role">${escapeHtml(exp.role)}</em>
              <em class="subtext italic" contenteditable="true" data-field="exp-${exp.id}-location">${escapeHtml(exp.location)}</em>
            </div>
            ${exp.bullets && exp.bullets.length > 0 ? `
              <ul class="bullet-list">
                ${exp.bullets.map((b, bIdx) => `
                  <li contenteditable="true" data-field="exp-${exp.id}-bullet-${bIdx}">${escapeHtml(b)}</li>
                `).join("")}
              </ul>
            ` : ""}
          </div>
        `).join("")}
      </div>
    </section>
  ` : "";

  const educationHtml = education.length > 0 ? `
    <section class="sec">
      <div class="sec-title">${escapeHtml(sectionTitles?.education || "Education")}</div>
      <div class="items-list">
        ${education.map((edu) => `
          <div class="subheading-block">
            <div class="row-between">
              <strong class="item-head" contenteditable="true" data-field="edu-${edu.id}-inst">${escapeHtml(edu.institution)}</strong>
              <span class="subtext accent" contenteditable="true" data-field="edu-${edu.id}-dates">${escapeHtml(edu.startDate)} – ${escapeHtml(edu.endDate)}</span>
            </div>
            <div class="row-between">
              <em class="subtext italic" contenteditable="true" data-field="edu-${edu.id}-degree">${escapeHtml([edu.degree, edu.field].filter(Boolean).join(", "))}</em>
              <em class="subtext italic" contenteditable="true" data-field="edu-${edu.id}-loc">${escapeHtml(edu.location)}</em>
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  ` : "";

  const skillsHtml = skills.length > 0 ? `
    <section class="sec">
      <div class="sec-title">${escapeHtml(sectionTitles?.skills || "Skills")}</div>
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
      <div class="sec-title">${escapeHtml(sectionTitles?.projects || "Projects")}</div>
      <div class="items-list">
        ${projects.map((p) => `
          <div class="subheading-block">
            <div class="row-between">
              <span class="item-head">
                <strong contenteditable="true" data-field="proj-${p.id}-title">${escapeHtml(p.title)}</strong>
                ${p.subtitle ? `<span class="proj-sub" contenteditable="true" data-field="proj-${p.id}-sub"> -- ${escapeHtml(p.subtitle)}</span>` : ""}
              </span>
              <span class="subtext accent" contenteditable="true" data-field="proj-${p.id}-dates">${escapeHtml([p.startDate, p.endDate].filter(Boolean).join(" – "))}</span>
            </div>
            ${p.bullets && p.bullets.length > 0 ? `
              <ul class="bullet-list">
                ${p.bullets.map((b, bIdx) => `
                  <li contenteditable="true" data-field="proj-${p.id}-bullet-${bIdx}">${escapeHtml(b)}</li>
                `).join("")}
              </ul>
            ` : ""}
          </div>
        `).join("")}
      </div>
    </section>
  ` : "";

  const extrasTitle = sectionTitles?.extras || extrasLabel || spec.defaultExtrasLabel;
  const extrasHtml = extras.length > 0 ? `
    <section class="sec">
      <div class="sec-title">${escapeHtml(extrasTitle)}</div>
      <div class="items-list">
        ${extras.map((a) => `
          <div class="subheading-block">
            <div class="row-between">
              <span class="item-head">
                <strong contenteditable="true" data-field="extra-${a.id}-title">${escapeHtml(a.title)}</strong>
                ${a.subtitle ? `<span class="proj-sub" contenteditable="true" data-field="extra-${a.id}-sub"> -- ${escapeHtml(a.subtitle)}</span>` : ""}
              </span>
              <span class="subtext accent" contenteditable="true" data-field="extra-${a.id}-date">${escapeHtml(a.date)}</span>
            </div>
            ${a.bullets && a.bullets.length > 0 ? `
              <ul class="bullet-list">
                ${a.bullets.map((b, bIdx) => `
                  <li contenteditable="true" data-field="extra-${a.id}-bullet-${bIdx}">${escapeHtml(b)}</li>
                `).join("")}
              </ul>
            ` : ""}
          </div>
        `).join("")}
      </div>
    </section>
  ` : "";

  const customSections = model.customSections || [];
  const customSectionsHtml = customSections.map((sec) => {
    if (!sec) return "";
    const items = sec.items || [];
    const bullets = sec.bullets || [];
    const secTitle = escapeHtml(sec.title || "Additional Section");

    return `
    <section class="sec">
      <div class="sec-title">${secTitle}</div>
      <div class="items-list">
        ${items.map((item) => `
          <div class="subheading-block">
            <div class="row-between">
              <span class="item-head">
                <strong contenteditable="true" data-field="custom-${sec.id}-${item.id}-title">${escapeHtml(item.title)}</strong>
                ${item.subtitle ? `<span class="proj-sub" contenteditable="true" data-field="custom-${sec.id}-${item.id}-sub"> -- ${escapeHtml(item.subtitle)}</span>` : ""}
              </span>
              <span class="subtext accent" contenteditable="true" data-field="custom-${sec.id}-${item.id}-date">${escapeHtml(item.date)}</span>
            </div>
            ${item.bullets && item.bullets.length > 0 ? `
              <ul class="bullet-list">
                ${item.bullets.map((b, bIdx) => `
                  <li contenteditable="true" data-field="custom-${sec.id}-${item.id}-bullet-${bIdx}">${escapeHtml(b)}</li>
                `).join("")}
              </ul>
            ` : ""}
          </div>
        `).join("")}
        ${bullets.length > 0 ? `
          <ul class="bullet-list">
            ${bullets.map((b, bIdx) => `
              <li contenteditable="true" data-field="custom-${sec.id}-bullet-${bIdx}">${escapeHtml(b)}</li>
            `).join("")}
          </ul>
        ` : ""}
        ${sec.content ? `<div class="summary-text" contenteditable="true" data-field="custom-${sec.id}-content">${escapeHtml(sec.content)}</div>` : ""}
      </div>
    </section>
    `;
  }).join("\n");

  return `
  <div class="resume-sheet template-modern-minimal">
    <style>
      .template-modern-minimal {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        font-size: 9.5pt;
        line-height: 1.35;
        color: #1f2937;
        background: #ffffff;
        box-sizing: border-box;
        padding: 0.6in;
        width: 8.5in;
        min-height: 11in;
        margin: 0 auto;
        text-align: left;
      }
      .template-modern-minimal a { color: #1f2937; text-decoration: none; }
      .template-modern-minimal a:hover { text-decoration: underline; }
      .template-modern-minimal .header { text-align: left; margin-bottom: 6px; }
      .template-modern-minimal .name { font-size: 16pt; font-weight: bold; color: ${accent}; text-transform: uppercase; margin-bottom: 1pt; }
      .template-modern-minimal .headline { font-size: 9.5pt; color: #4b5563; margin-bottom: 3pt; }
      .template-modern-minimal .contact-bar { font-size: 8.8pt; line-height: 12pt; display: flex; gap: 6px; flex-wrap: wrap; color: #4b5563; }
      .template-modern-minimal .divider { color: #9ca3af; }
      .template-modern-minimal .header-rule { border: none; border-top: 0.6pt solid #d1d5db; margin: 4pt 0 8pt 0; }
      .template-modern-minimal .sec { margin-top: 11pt; margin-bottom: 4pt; }
      .template-modern-minimal .sec-title { font-size: 10.5pt; font-weight: bold; color: ${accent}; margin: 0 0 5pt 0; }
      .template-modern-minimal .row-between { display: flex; justify-content: space-between; align-items: baseline; }
      .template-modern-minimal .item-head { font-size: 9.5pt; font-weight: bold; }
      .template-modern-minimal .subtext { font-size: 8.8pt; }
      .template-modern-minimal .accent { color: ${accent}; }
      .template-modern-minimal .italic { font-style: italic; color: #4b5563; }
      .template-modern-minimal .subheading-block { margin-bottom: 8pt; }
      .template-modern-minimal .bullet-list { margin: 3pt 0 4pt 0; padding-left: 0.16in; list-style-type: disc; }
      .template-modern-minimal .bullet-list li { margin-bottom: 1pt; font-size: 9pt; text-align: justify; }
      .template-modern-minimal .skills-list { list-style-type: none; padding-left: 0; }
      .template-modern-minimal .skills-list li { margin-bottom: 2pt; font-size: 9pt; }
      .template-modern-minimal .summary-text { font-size: 9pt; line-height: 12.5pt; text-align: justify; margin-bottom: 4pt; }
      .template-modern-minimal [contenteditable="true"]:hover { outline: 1px dashed rgba(27, 110, 92, 0.4); }
      .template-modern-minimal [contenteditable="true"]:focus { outline: 2px solid ${accent}; background-color: rgba(27, 110, 92, 0.04); }
    </style>
    <div class="header">
      <div class="name" contenteditable="true" data-field="personalInfo.fullName">${escapeHtml(personalInfo.fullName || "YOUR NAME").toUpperCase()}</div>
      ${headline ? `<div class="headline" contenteditable="true" data-field="personalInfo.headline">${escapeHtml(headline)}</div>` : ""}
      <div class="contact-bar">
        ${contactLinks.join(' <span class="divider">|</span> ')}
      </div>
      <hr class="header-rule" />
    </div>
    ${summaryHtml}
    ${experienceHtml}
    ${educationHtml}
    ${skillsHtml}
    ${projectsHtml}
    ${extrasHtml}
    ${customSectionsHtml}
  </div>
  `;
}

// ==========================================
// TEMPLATE 3 HTML: Technical Developer
// ==========================================
export function renderTemplate3Html(
  rawModel: ResumeDocumentModel,
  spec: TemplateSpec = TEMPLATE_SPECS["template-3"],
): string {
  const model = normalizeResumeDocument(rawModel);
  const { personalInfo, summary, experience, education, skills, projects, extras, extrasLabel, sectionTitles } = model;
  const nameFormatted = (personalInfo.fullName || "YOUR NAME").toUpperCase().replace(/\s+/g, "_");

  const contactLinks: string[] = [];
  if (personalInfo.location) contactLinks.push(`<span contenteditable="true" data-field="personalInfo.location">${escapeHtml(personalInfo.location)}</span>`);
  if (personalInfo.email) contactLinks.push(`<a href="mailto:${escapeHtml(personalInfo.email)}" contenteditable="true" data-field="personalInfo.email">${escapeHtml(personalInfo.email)}</a>`);
  if (personalInfo.phone) contactLinks.push(`<span contenteditable="true" data-field="personalInfo.phone">${escapeHtml(personalInfo.phone)}</span>`);
  if (personalInfo.linkedin) contactLinks.push(`<a href="https://${escapeHtml(cleanUrl(personalInfo.linkedin))}" target="_blank" contenteditable="true" data-field="personalInfo.linkedin">${escapeHtml(cleanUrl(personalInfo.linkedin))}</a>`);
  if (personalInfo.github) contactLinks.push(`<a href="https://${escapeHtml(cleanUrl(personalInfo.github))}" target="_blank" contenteditable="true" data-field="personalInfo.github">${escapeHtml(cleanUrl(personalInfo.github))}</a>`);
  if (personalInfo.portfolio) contactLinks.push(`<a href="https://${escapeHtml(cleanUrl(personalInfo.portfolio))}" target="_blank" contenteditable="true" data-field="personalInfo.portfolio">${escapeHtml(cleanUrl(personalInfo.portfolio))}</a>`);

  const summaryHtml = summary?.trim() ? `
    <section class="sec">
      <div class="sec-title"><span class="prefix">//</span> ${escapeHtml((sectionTitles?.summary || "SUMMARY").toUpperCase().replace(/\s+/g, "_"))}</div>
      <div class="summary-text" contenteditable="true" data-field="summary">${escapeHtml(summary)}</div>
    </section>
  ` : "";

  const experienceHtml = experience.length > 0 ? `
    <section class="sec">
      <div class="sec-title"><span class="prefix">//</span> ${escapeHtml((sectionTitles?.experience || "WORK_EXPERIENCE").toUpperCase().replace(/\s+/g, "_"))}</div>
      <div class="items-list">
        ${experience.map((exp) => `
          <div class="subheading-block">
            <div class="dot-row">
              <strong class="item-head" contenteditable="true" data-field="exp-${exp.id}-company">${escapeHtml(exp.company)}</strong>
              <span class="dots"></span>
              <span class="subtext mono" contenteditable="true" data-field="exp-${exp.id}-dates">${escapeHtml(exp.startDate)} – ${escapeHtml(exp.endDate)}</span>
            </div>
            <div class="dot-row">
              <em class="subtext italic" contenteditable="true" data-field="exp-${exp.id}-role">${escapeHtml(exp.role)}</em>
              <span class="dots"></span>
              <span class="subtext mono" contenteditable="true" data-field="exp-${exp.id}-location">${escapeHtml(exp.location)}</span>
            </div>
            ${exp.bullets && exp.bullets.length > 0 ? `
              <ul class="bullet-list">
                ${exp.bullets.map((b, bIdx) => `
                  <li contenteditable="true" data-field="exp-${exp.id}-bullet-${bIdx}">${escapeHtml(b)}</li>
                `).join("")}
              </ul>
            ` : ""}
          </div>
        `).join("")}
      </div>
    </section>
  ` : "";

  const educationHtml = education.length > 0 ? `
    <section class="sec">
      <div class="sec-title"><span class="prefix">//</span> ${escapeHtml((sectionTitles?.education || "EDUCATION").toUpperCase().replace(/\s+/g, "_"))}</div>
      <div class="items-list">
        ${education.map((edu) => `
          <div class="subheading-block">
            <div class="dot-row">
              <strong class="item-head" contenteditable="true" data-field="edu-${edu.id}-inst">${escapeHtml(edu.institution)}</strong>
              <span class="dots"></span>
              <span class="subtext mono" contenteditable="true" data-field="edu-${edu.id}-dates">${escapeHtml(edu.startDate)} – ${escapeHtml(edu.endDate)}</span>
            </div>
            <div class="dot-row">
              <em class="subtext italic" contenteditable="true" data-field="edu-${edu.id}-degree">${escapeHtml([edu.degree, edu.field].filter(Boolean).join(", "))}</em>
              <span class="dots"></span>
              <span class="subtext mono" contenteditable="true" data-field="edu-${edu.id}-loc">${escapeHtml(edu.location)}</span>
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  ` : "";

  const allSkills = skills.flatMap((s) => s.skills).filter(Boolean);
  const skillsHtml = allSkills.length > 0 ? `
    <section class="sec">
      <div class="sec-title"><span class="prefix">//</span> ${escapeHtml((sectionTitles?.skills || "SKILLS").toUpperCase().replace(/\s+/g, "_"))}</div>
      <div class="skill-tags">
        ${allSkills.map((s) => `<span class="skill-pill">[${escapeHtml(s)}]</span>`).join(" ")}
      </div>
    </section>
  ` : "";

  const projectsHtml = projects.length > 0 ? `
    <section class="sec">
      <div class="sec-title"><span class="prefix">//</span> ${escapeHtml((sectionTitles?.projects || "PROJECTS").toUpperCase().replace(/\s+/g, "_"))}</div>
      <div class="items-list">
        ${projects.map((p) => `
          <div class="subheading-block">
            <div class="dot-row">
              <span class="item-head">
                <strong contenteditable="true" data-field="proj-${p.id}-title">${escapeHtml(p.title)}</strong>
                ${p.subtitle ? `<span class="proj-sub" contenteditable="true" data-field="proj-${p.id}-sub"> -- ${escapeHtml(p.subtitle)}</span>` : ""}
              </span>
              <span class="dots"></span>
              <span class="subtext mono" contenteditable="true" data-field="proj-${p.id}-dates">${escapeHtml([p.startDate, p.endDate].filter(Boolean).join(" – "))}</span>
            </div>
            ${p.bullets && p.bullets.length > 0 ? `
              <ul class="bullet-list">
                ${p.bullets.map((b, bIdx) => `
                  <li contenteditable="true" data-field="proj-${p.id}-bullet-${bIdx}">${escapeHtml(b)}</li>
                `).join("")}
              </ul>
            ` : ""}
          </div>
        `).join("")}
      </div>
    </section>
  ` : "";

  const extrasTitle = (sectionTitles?.extras || extrasLabel || spec.defaultExtrasLabel).toUpperCase().replace(/\s+/g, "_");
  const extrasHtml = extras.length > 0 ? `
    <section class="sec">
      <div class="sec-title"><span class="prefix">//</span> ${escapeHtml(extrasTitle)}</div>
      <div class="items-list">
        ${extras.map((a) => `
          <div class="subheading-block">
            <div class="dot-row">
              <span class="item-head">
                <strong contenteditable="true" data-field="extra-${a.id}-title">${escapeHtml(a.title)}</strong>
                ${a.subtitle ? `<span class="proj-sub" contenteditable="true" data-field="extra-${a.id}-sub"> -- ${escapeHtml(a.subtitle)}</span>` : ""}
              </span>
              <span class="dots"></span>
              <span class="subtext mono" contenteditable="true" data-field="extra-${a.id}-date">${escapeHtml(a.date)}</span>
            </div>
            ${a.bullets && a.bullets.length > 0 ? `
              <ul class="bullet-list">
                ${a.bullets.map((b, bIdx) => `
                  <li contenteditable="true" data-field="extra-${a.id}-bullet-${bIdx}">${escapeHtml(b)}</li>
                `).join("")}
              </ul>
            ` : ""}
          </div>
        `).join("")}
      </div>
    </section>
  ` : "";

  const customSections = model.customSections || [];
  const customSectionsHtml = customSections.map((sec) => {
    if (!sec) return "";
    const items = sec.items || [];
    const bullets = sec.bullets || [];
    const secTitle = escapeHtml((sec.title || "ADDITIONAL_SECTION").toUpperCase().replace(/\s+/g, "_"));

    return `
    <section class="sec">
      <div class="sec-title"><span class="prefix">//</span> ${secTitle}</div>
      <div class="items-list">
        ${items.map((item) => `
          <div class="subheading-block">
            <div class="dot-row">
              <span class="item-head">
                <strong contenteditable="true" data-field="custom-${sec.id}-${item.id}-title">${escapeHtml(item.title)}</strong>
                ${item.subtitle ? `<span class="proj-sub" contenteditable="true" data-field="custom-${sec.id}-${item.id}-sub"> -- ${escapeHtml(item.subtitle)}</span>` : ""}
              </span>
              <span class="dots"></span>
              <span class="subtext mono" contenteditable="true" data-field="custom-${sec.id}-${item.id}-date">${escapeHtml(item.date)}</span>
            </div>
            ${item.bullets && item.bullets.length > 0 ? `
              <ul class="bullet-list">
                ${item.bullets.map((b, bIdx) => `
                  <li contenteditable="true" data-field="custom-${sec.id}-${item.id}-bullet-${bIdx}">${escapeHtml(b)}</li>
                `).join("")}
              </ul>
            ` : ""}
          </div>
        `).join("")}
        ${bullets.length > 0 ? `
          <ul class="bullet-list">
            ${bullets.map((b, bIdx) => `
              <li contenteditable="true" data-field="custom-${sec.id}-bullet-${bIdx}">${escapeHtml(b)}</li>
            `).join("")}
          </ul>
        ` : ""}
        ${sec.content ? `<div class="summary-text" contenteditable="true" data-field="custom-${sec.id}-content">${escapeHtml(sec.content)}</div>` : ""}
      </div>
    </section>
    `;
  }).join("\n");

  return `
  <div class="resume-sheet template-technical-developer">
    <style>
      .template-technical-developer {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 9pt;
        line-height: 1.3;
        color: #111827;
        background: #ffffff;
        box-sizing: border-box;
        padding: 0.45in 0.55in;
        width: 8.5in;
        min-height: 11in;
        margin: 0 auto;
        text-align: left;
      }
      .template-technical-developer a { color: #111827; text-decoration: none; }
      .template-technical-developer a:hover { text-decoration: underline; }
      .template-technical-developer .header { margin-bottom: 4px; }
      .template-technical-developer .name { font-size: 15pt; font-weight: bold; letter-spacing: 0.5px; margin-bottom: 2pt; }
      .template-technical-developer .contact-bar { font-size: 8.5pt; display: flex; gap: 6px; flex-wrap: wrap; color: #374151; }
      .template-technical-developer .divider { color: #9ca3af; }
      .template-technical-developer .sec { margin-top: 7pt; margin-bottom: 2pt; }
      .template-technical-developer .sec-title { font-size: 10pt; font-weight: bold; margin: 0 0 3pt 0; color: #111827; }
      .template-technical-developer .prefix { color: #0f766e; font-weight: bold; }
      .template-technical-developer .dot-row { display: flex; align-items: baseline; width: 100%; }
      .template-technical-developer .dots { flex-grow: 1; border-bottom: 1px dotted #9ca3af; margin: 0 4px; height: 1em; }
      .template-technical-developer .item-head { font-size: 9pt; font-weight: bold; white-space: nowrap; }
      .template-technical-developer .subtext { font-size: 8.5pt; white-space: nowrap; }
      .template-technical-developer .mono { font-family: ui-monospace, monospace; }
      .template-technical-developer .italic { font-style: italic; color: #4b5563; }
      .template-technical-developer .subheading-block { margin-bottom: 3pt; }
      .template-technical-developer .bullet-list { margin: 1pt 0 3pt 0; padding-left: 0.18in; list-style-type: disc; }
      .template-technical-developer .bullet-list li { margin-bottom: 1pt; font-size: 8.8pt; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: justify; }
      .template-technical-developer .skill-tags { display: flex; flex-wrap: wrap; gap: 4px; margin: 3pt 0; }
      .template-technical-developer .skill-pill { font-size: 8.5pt; color: #0f766e; font-weight: 500; }
      .template-technical-developer .summary-text { font-size: 8.8pt; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 12pt; text-align: justify; margin-bottom: 3pt; }
      .template-technical-developer [contenteditable="true"]:hover { outline: 1px dashed rgba(15, 118, 110, 0.4); }
      .template-technical-developer [contenteditable="true"]:focus { outline: 2px solid #0f766e; background-color: rgba(15, 118, 110, 0.04); }
    </style>
    <div class="header">
      <div class="name" contenteditable="true" data-field="personalInfo.fullName">${escapeHtml(nameFormatted)}</div>
      <div class="contact-bar">
        ${contactLinks.join(' <span class="divider">|</span> ')}
      </div>
    </div>
    ${summaryHtml}
    ${experienceHtml}
    ${educationHtml}
    ${skillsHtml}
    ${projectsHtml}
    ${extrasHtml}
    ${customSectionsHtml}
  </div>
  `;
}

// ==========================================
// TEMPLATE 4 HTML: Elegant Formal
// ==========================================
export function renderTemplate4Html(
  rawModel: ResumeDocumentModel,
  spec: TemplateSpec = TEMPLATE_SPECS["template-4"],
): string {
  const model = normalizeResumeDocument(rawModel);
  const { personalInfo, summary, experience, education, skills, projects, extras, extrasLabel, sectionTitles } = model;

  const links: string[] = [];
  if (personalInfo.email) links.push(`<a href="mailto:${escapeHtml(personalInfo.email)}" contenteditable="true" data-field="personalInfo.email">${escapeHtml(personalInfo.email)}</a>`);
  if (personalInfo.phone) links.push(`<span contenteditable="true" data-field="personalInfo.phone">${escapeHtml(personalInfo.phone)}</span>`);
  if (personalInfo.linkedin) links.push(`<a href="https://${escapeHtml(cleanUrl(personalInfo.linkedin))}" target="_blank" contenteditable="true" data-field="personalInfo.linkedin">${escapeHtml(cleanUrl(personalInfo.linkedin))}</a>`);
  if (personalInfo.github) links.push(`<a href="https://${escapeHtml(cleanUrl(personalInfo.github))}" target="_blank" contenteditable="true" data-field="personalInfo.github">${escapeHtml(cleanUrl(personalInfo.github))}</a>`);
  if (personalInfo.portfolio) links.push(`<a href="https://${escapeHtml(cleanUrl(personalInfo.portfolio))}" target="_blank" contenteditable="true" data-field="personalInfo.portfolio">${escapeHtml(cleanUrl(personalInfo.portfolio))}</a>`);

  const summaryHtml = summary?.trim() ? `
    <section class="sec">
      <div class="sec-title">${escapeHtml(sectionTitles?.summary || "Summary")}</div>
      <div class="double-rule"></div>
      <div class="summary-text centered-text" contenteditable="true" data-field="summary">${escapeHtml(summary)}</div>
    </section>
  ` : "";

  const experienceHtml = experience.length > 0 ? `
    <section class="sec">
      <div class="sec-title">${escapeHtml(sectionTitles?.experience || "Work Experience")}</div>
      <div class="double-rule"></div>
      <div class="items-list">
        ${experience.map((exp) => `
          <div class="subheading-block">
            <div class="centered-head">
              <strong class="item-head" contenteditable="true" data-field="exp-${exp.id}-company">${escapeHtml(exp.company)}</strong>
              <span class="dash"> — </span>
              <span class="subtext" contenteditable="true" data-field="exp-${exp.id}-dates">${escapeHtml(exp.startDate)} – ${escapeHtml(exp.endDate)}</span>
            </div>
            <div class="centered-head">
              <em class="subtext italic" contenteditable="true" data-field="exp-${exp.id}-role">${escapeHtml(exp.role)}</em>,
              <em class="subtext italic" contenteditable="true" data-field="exp-${exp.id}-location"> ${escapeHtml(exp.location)}</em>
            </div>
            ${exp.bullets && exp.bullets.length > 0 ? `
              <ul class="bullet-list">
                ${exp.bullets.map((b, bIdx) => `
                  <li contenteditable="true" data-field="exp-${exp.id}-bullet-${bIdx}">${escapeHtml(b)}</li>
                `).join("")}
              </ul>
            ` : ""}
          </div>
        `).join("")}
      </div>
    </section>
  ` : "";

  const educationHtml = education.length > 0 ? `
    <section class="sec">
      <div class="sec-title">${escapeHtml(sectionTitles?.education || "Education")}</div>
      <div class="double-rule"></div>
      <div class="items-list">
        ${education.map((edu) => `
          <div class="subheading-block">
            <div class="centered-head">
              <strong class="item-head" contenteditable="true" data-field="edu-${edu.id}-inst">${escapeHtml(edu.institution)}</strong>
              <span class="dash"> — </span>
              <span class="subtext" contenteditable="true" data-field="edu-${edu.id}-dates">${escapeHtml(edu.startDate)} – ${escapeHtml(edu.endDate)}</span>
            </div>
            <div class="centered-head">
              <em class="subtext italic" contenteditable="true" data-field="edu-${edu.id}-degree">${escapeHtml([edu.degree, edu.field].filter(Boolean).join(", "))}</em>,
              <em class="subtext italic" contenteditable="true" data-field="edu-${edu.id}-loc"> ${escapeHtml(edu.location)}</em>
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  ` : "";

  const skillsHtml = skills.length > 0 ? `
    <section class="sec">
      <div class="sec-title">${escapeHtml(sectionTitles?.skills || "Skills")}</div>
      <div class="double-rule"></div>
      <div class="skills-centered">
        ${skills.map((s) => `
          <div class="skill-row">
            <strong contenteditable="true" data-field="skill-${s.id}-cat">${escapeHtml(s.category)}:</strong>
            <span contenteditable="true" data-field="skill-${s.id}-items">${escapeHtml(s.skills.join(", "))}</span>
          </div>
        `).join("")}
      </div>
    </section>
  ` : "";

  const projectsHtml = projects.length > 0 ? `
    <section class="sec">
      <div class="sec-title">${escapeHtml(sectionTitles?.projects || "Projects")}</div>
      <div class="double-rule"></div>
      <div class="items-list">
        ${projects.map((p) => `
          <div class="subheading-block">
            <div class="centered-head">
              <strong contenteditable="true" data-field="proj-${p.id}-title">${escapeHtml(p.title)}</strong>
              ${p.subtitle ? `<span class="proj-sub" contenteditable="true" data-field="proj-${p.id}-sub"> -- ${escapeHtml(p.subtitle)}</span>` : ""}
              <span class="dash"> — </span>
              <span class="subtext" contenteditable="true" data-field="proj-${p.id}-dates">${escapeHtml([p.startDate, p.endDate].filter(Boolean).join(" – "))}</span>
            </div>
            ${p.bullets && p.bullets.length > 0 ? `
              <ul class="bullet-list">
                ${p.bullets.map((b, bIdx) => `
                  <li contenteditable="true" data-field="proj-${p.id}-bullet-${bIdx}">${escapeHtml(b)}</li>
                `).join("")}
              </ul>
            ` : ""}
          </div>
        `).join("")}
      </div>
    </section>
  ` : "";

  const extrasTitle = sectionTitles?.extras || extrasLabel || spec.defaultExtrasLabel;
  const extrasHtml = extras.length > 0 ? `
    <section class="sec">
      <div class="sec-title">${escapeHtml(extrasTitle)}</div>
      <div class="double-rule"></div>
      <div class="items-list">
        ${extras.map((a) => `
          <div class="subheading-block">
            <div class="centered-head">
              <strong contenteditable="true" data-field="extra-${a.id}-title">${escapeHtml(a.title)}</strong>
              ${a.subtitle ? `<span class="proj-sub" contenteditable="true" data-field="extra-${a.id}-sub"> -- ${escapeHtml(a.subtitle)}</span>` : ""}
              <span class="dash"> — </span>
              <span class="subtext" contenteditable="true" data-field="extra-${a.id}-date">${escapeHtml(a.date)}</span>
            </div>
            ${a.bullets && a.bullets.length > 0 ? `
              <ul class="bullet-list">
                ${a.bullets.map((b, bIdx) => `
                  <li contenteditable="true" data-field="extra-${a.id}-bullet-${bIdx}">${escapeHtml(b)}</li>
                `).join("")}
              </ul>
            ` : ""}
          </div>
        `).join("")}
      </div>
    </section>
  ` : "";

  const customSections = model.customSections || [];
  const customSectionsHtml = customSections.map((sec) => {
    if (!sec) return "";
    const items = sec.items || [];
    const bullets = sec.bullets || [];
    const secTitle = escapeHtml(sec.title || "Additional Section");

    return `
    <section class="sec">
      <div class="sec-title">${secTitle}</div>
      <div class="double-rule"></div>
      <div class="items-list">
        ${items.map((item) => `
          <div class="subheading-block">
            <div class="centered-head">
              <strong contenteditable="true" data-field="custom-${sec.id}-${item.id}-title">${escapeHtml(item.title)}</strong>
              ${item.subtitle ? `<span class="proj-sub" contenteditable="true" data-field="custom-${sec.id}-${item.id}-sub"> -- ${escapeHtml(item.subtitle)}</span>` : ""}
              <span class="dash"> — </span>
              <span class="subtext" contenteditable="true" data-field="custom-${sec.id}-${item.id}-date">${escapeHtml(item.date)}</span>
            </div>
            ${item.bullets && item.bullets.length > 0 ? `
              <ul class="bullet-list">
                ${item.bullets.map((b, bIdx) => `
                  <li contenteditable="true" data-field="custom-${sec.id}-${item.id}-bullet-${bIdx}">${escapeHtml(b)}</li>
                `).join("")}
              </ul>
            ` : ""}
          </div>
        `).join("")}
        ${bullets.length > 0 ? `
          <ul class="bullet-list">
            ${bullets.map((b, bIdx) => `
              <li contenteditable="true" data-field="custom-${sec.id}-bullet-${bIdx}">${escapeHtml(b)}</li>
            `).join("")}
          </ul>
        ` : ""}
        ${sec.content ? `<div class="summary-text" contenteditable="true" data-field="custom-${sec.id}-content">${escapeHtml(sec.content)}</div>` : ""}
      </div>
    </section>
    `;
  }).join("\n");

  return `
  <div class="resume-sheet template-elegant-formal">
    <style>
      .template-elegant-formal {
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 9.8pt;
        line-height: 1.35;
        color: #1f2937;
        background: #ffffff;
        box-sizing: border-box;
        padding: 0.75in;
        width: 8.5in;
        min-height: 11in;
        margin: 0 auto;
        text-align: center;
      }
      .template-elegant-formal a { color: #1f2937; text-decoration: none; }
      .template-elegant-formal a:hover { text-decoration: underline; }
      .template-elegant-formal .header { text-align: center; margin-bottom: 8px; }
      .template-elegant-formal .name { font-size: 17pt; font-variant: small-caps; font-weight: bold; letter-spacing: 1px; margin-bottom: 4pt; }
      .template-elegant-formal .location { font-size: 9.5pt; margin-bottom: 2pt; color: #4b5563; }
      .template-elegant-formal .contact-bar { font-size: 9pt; line-height: 12pt; display: flex; justify-content: center; gap: 6px; flex-wrap: wrap; color: #4b5563; }
      .template-elegant-formal .divider { color: #9ca3af; }
      .template-elegant-formal .sec { margin-top: 12pt; margin-bottom: 6pt; }
      .template-elegant-formal .sec-title { font-size: 12pt; font-variant: small-caps; letter-spacing: 0.5px; font-weight: bold; margin: 0 0 2pt 0; text-align: center; }
      .template-elegant-formal .double-rule { border-top: 0.5pt solid #1f2937; border-bottom: 0.5pt solid #1f2937; height: 1.5pt; margin: 2pt 0 6pt 0; }
      .template-elegant-formal .centered-head { text-align: center; margin-bottom: 1pt; }
      .template-elegant-formal .item-head { font-size: 9.8pt; font-weight: bold; }
      .template-elegant-formal .dash { color: #6b7280; font-weight: normal; }
      .template-elegant-formal .subtext { font-size: 9pt; }
      .template-elegant-formal .italic { font-style: italic; }
      .template-elegant-formal .subheading-block { margin-bottom: 8pt; }
      .template-elegant-formal .bullet-list { margin: 3pt auto 4pt auto; padding-left: 0.5in; list-style-type: disc; text-align: left; }
      .template-elegant-formal .bullet-list li { margin-bottom: 2pt; font-size: 9.2pt; text-align: justify; }
      .template-elegant-formal .skills-centered { text-align: center; margin-bottom: 4pt; }
      .template-elegant-formal .skill-row { margin-bottom: 3pt; font-size: 9.2pt; }
      .template-elegant-formal .summary-text { font-size: 9.2pt; line-height: 13pt; text-align: center; margin: 0 auto 4pt auto; max-width: 90%; }
      .template-elegant-formal [contenteditable="true"]:hover { outline: 1px dashed rgba(31, 41, 55, 0.4); }
      .template-elegant-formal [contenteditable="true"]:focus { outline: 2px solid #1f2937; background-color: rgba(31, 41, 55, 0.04); }
    </style>
    <div class="header">
      <div class="name" contenteditable="true" data-field="personalInfo.fullName">${escapeHtml(personalInfo.fullName || "Your Name")}</div>
      ${personalInfo.location ? `<div class="location" contenteditable="true" data-field="personalInfo.location">${escapeHtml(personalInfo.location)}</div>` : ""}
      <div class="contact-bar">
        ${links.join(' <span class="divider">|</span> ')}
      </div>
    </div>
    ${summaryHtml}
    ${experienceHtml}
    ${educationHtml}
    ${skillsHtml}
    ${projectsHtml}
    ${extrasHtml}
    ${customSectionsHtml}
  </div>
  `;
}

/**
 * Dispatches HTML generation by templateId.
 */
export function renderHtmlByTemplateId(
  model: ResumeDocumentModel,
  templateId?: string,
): string {
  const id = templateId || model.templateId || "template-1";
  switch (id) {
    case "template-2":
    case "modern-minimal":
      return renderTemplate2Html(model);
    case "template-3":
    case "technical-developer":
      return renderTemplate3Html(model);
    case "template-4":
    case "elegant-formal":
      return renderTemplate4Html(model);
    case "template-1":
    case "classic-traditional":
    default:
      return renderTemplate1Html(model);
  }
}
