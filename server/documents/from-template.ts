import type { ResumeDocumentModel } from "./resume-document-model";
import type { ResumeSection, ResumeLine } from "@/types/resume";
import { createId } from "@/lib/resume";

/**
 * Converts a structured ResumeDocumentModel into ResumeSection[]
 * with stable IDs and kind tags, preserving section and line layouts.
 */
export function documentModelToSections(model: ResumeDocumentModel): ResumeSection[] {
  const sections: ResumeSection[] = [];
  const { personalInfo, summary, experience, education, projects, skills, achievements } = model;

  // 1. Header Section
  const headerLines: ResumeLine[] = [
    {
      id: createId("line-hdr-name"),
      page: 1,
      sectionId: "header",
      text: personalInfo.fullName,
      kind: "header",
      layout: {
        pageWidth: 595.28,
        pageHeight: 841.89,
        x: 40,
        y: 35,
        width: 515,
        height: 24,
        fontSize: 18,
        fontFamily: "Times New Roman, serif",
        fontWeight: 700,
        lineHeight: 22,
        textAlign: "center",
        variant: "headerName",
      },
    },
  ];

  if (personalInfo.location) {
    headerLines.push({
      id: createId("line-hdr-loc"),
      page: 1,
      sectionId: "header",
      text: personalInfo.location,
      kind: "text",
      layout: {
        pageWidth: 595.28,
        pageHeight: 841.89,
        x: 40,
        y: 60,
        width: 515,
        height: 14,
        fontSize: 9.5,
        fontFamily: "Times New Roman, serif",
        fontWeight: 400,
        lineHeight: 13,
        textAlign: "center",
        variant: "headerSub",
      },
    });
  }

  const contactLinks: string[] = [
    personalInfo.phone,
    personalInfo.email,
    personalInfo.linkedin,
    personalInfo.github,
    personalInfo.portfolio,
  ].filter(Boolean);

  if (contactLinks.length > 0) {
    headerLines.push({
      id: createId("line-hdr-contact"),
      page: 1,
      sectionId: "header",
      text: contactLinks.join(" | "),
      kind: "text",
      layout: {
        pageWidth: 595.28,
        pageHeight: 841.89,
        x: 40,
        y: 75,
        width: 515,
        height: 14,
        fontSize: 9,
        fontFamily: "Times New Roman, serif",
        fontWeight: 400,
        lineHeight: 13,
        textAlign: "center",
        variant: "link",
      },
    });
  }

  sections.push({
    id: "header",
    title: "Header",
    lines: headerLines,
  });

  // 2. Summary Section
  if (summary) {
    sections.push({
      id: "summary",
      title: "Summary",
      lines: [
        {
          id: createId("line-sum-title"),
          page: 1,
          sectionId: "summary",
          text: "SUMMARY",
          kind: "text",
          layout: {
            pageWidth: 595.28,
            pageHeight: 841.89,
            x: 40,
            y: 95,
            width: 515,
            height: 16,
            fontSize: 11,
            fontFamily: "Times New Roman, serif",
            fontWeight: 700,
            lineHeight: 15,
            textAlign: "left",
            variant: "sectionHeading",
          },
        },
        {
          id: createId("line-sum-body"),
          page: 1,
          sectionId: "summary",
          text: summary,
          kind: "text",
          layout: {
            pageWidth: 595.28,
            pageHeight: 841.89,
            x: 40,
            y: 115,
            width: 515,
            height: 30,
            fontSize: 9.5,
            fontFamily: "Times New Roman, serif",
            fontWeight: 400,
            lineHeight: 14,
            textAlign: "left",
            variant: "body",
          },
        },
      ],
    });
  }

  // 3. Experience Section
  if (experience.length > 0) {
    const expLines: ResumeLine[] = [
      {
        id: createId("line-exp-title"),
        page: 1,
        sectionId: "experience",
        text: "WORK EXPERIENCE",
        kind: "text",
        layout: {
          pageWidth: 595.28,
          pageHeight: 841.89,
          x: 40,
          y: 150,
          width: 515,
          height: 16,
          fontSize: 11,
          fontFamily: "Times New Roman, serif",
          fontWeight: 700,
          lineHeight: 15,
          textAlign: "left",
          variant: "sectionHeading",
        },
      },
    ];

    experience.forEach((exp) => {
      expLines.push({
        id: exp.id ? `line-${exp.id}-heading` : createId("line-exp-head"),
        page: 1,
        sectionId: "experience",
        text: exp.company,
        rightText: `${exp.startDate} - ${exp.endDate}`,
        secondaryText: `${exp.role} | ${exp.location}`,
        kind: "subheading",
        layout: {
          pageWidth: 595.28,
          pageHeight: 841.89,
          x: 40,
          y: 170,
          width: 515,
          height: 16,
          fontSize: 10,
          fontFamily: "Times New Roman, serif",
          fontWeight: 700,
          lineHeight: 14,
          textAlign: "left",
          variant: "body",
        },
      });

      exp.bullets.forEach((bullet, bIdx) => {
        expLines.push({
          id: `${exp.id}-bullet-${bIdx}`,
          page: 1,
          sectionId: "experience",
          text: bullet,
          kind: "bullet",
          layout: {
            pageWidth: 595.28,
            pageHeight: 841.89,
            x: 52,
            y: 190 + bIdx * 16,
            width: 503,
            height: 15,
            fontSize: 9.2,
            fontFamily: "Times New Roman, serif",
            fontWeight: 400,
            lineHeight: 13,
            textAlign: "left",
            variant: "body",
          },
        });
      });
    });

    sections.push({
      id: "experience",
      title: "Experience",
      lines: expLines,
    });
  }

  // 4. Education Section
  if (education.length > 0) {
    const eduLines: ResumeLine[] = [
      {
        id: createId("line-edu-title"),
        page: 1,
        sectionId: "education",
        text: "EDUCATION",
        kind: "text",
        layout: {
          pageWidth: 595.28,
          pageHeight: 841.89,
          x: 40,
          y: 400,
          width: 515,
          height: 16,
          fontSize: 11,
          fontFamily: "Times New Roman, serif",
          fontWeight: 700,
          lineHeight: 15,
          textAlign: "left",
          variant: "sectionHeading",
        },
      },
    ];

    education.forEach((edu) => {
      eduLines.push({
        id: edu.id ? `line-${edu.id}-heading` : createId("line-edu-head"),
        page: 1,
        sectionId: "education",
        text: edu.institution,
        rightText: `${edu.startDate} - ${edu.endDate}`,
        secondaryText: `${edu.degree}${edu.location ? ` | ${edu.location}` : ""}`,
        kind: "subheading",
        layout: {
          pageWidth: 595.28,
          pageHeight: 841.89,
          x: 40,
          y: 420,
          width: 515,
          height: 16,
          fontSize: 10,
          fontFamily: "Times New Roman, serif",
          fontWeight: 700,
          lineHeight: 14,
          textAlign: "left",
          variant: "body",
        },
      });
    });

    sections.push({
      id: "education",
      title: "Education",
      lines: eduLines,
    });
  }

  // 5. Skills Section
  if (skills.length > 0) {
    const skillLines: ResumeLine[] = [
      {
        id: createId("line-skl-title"),
        page: 1,
        sectionId: "skills",
        text: "SKILLS",
        kind: "text",
        layout: {
          pageWidth: 595.28,
          pageHeight: 841.89,
          x: 40,
          y: 480,
          width: 515,
          height: 16,
          fontSize: 11,
          fontFamily: "Times New Roman, serif",
          fontWeight: 700,
          lineHeight: 15,
          textAlign: "left",
          variant: "sectionHeading",
        },
      },
    ];

    skills.forEach((s, sIdx) => {
      skillLines.push({
        id: s.id || `line-skill-${sIdx}`,
        page: 1,
        sectionId: "skills",
        text: `${s.category}: ${s.skills.join(", ")}`,
        kind: "bullet",
        layout: {
          pageWidth: 595.28,
          pageHeight: 841.89,
          x: 52,
          y: 500 + sIdx * 15,
          width: 503,
          height: 14,
          fontSize: 9.2,
          fontFamily: "Times New Roman, serif",
          fontWeight: 400,
          lineHeight: 13,
          textAlign: "left",
          variant: "body",
        },
      });
    });

    sections.push({
      id: "skills",
      title: "Skills",
      lines: skillLines,
    });
  }

  // 6. Projects Section
  if (projects.length > 0) {
    const projLines: ResumeLine[] = [
      {
        id: createId("line-prj-title"),
        page: 1,
        sectionId: "projects",
        text: "PROJECTS",
        kind: "text",
        layout: {
          pageWidth: 595.28,
          pageHeight: 841.89,
          x: 40,
          y: 560,
          width: 515,
          height: 16,
          fontSize: 11,
          fontFamily: "Times New Roman, serif",
          fontWeight: 700,
          lineHeight: 15,
          textAlign: "left",
          variant: "sectionHeading",
        },
      },
    ];

    projects.forEach((proj) => {
      projLines.push({
        id: proj.id ? `line-${proj.id}-heading` : createId("line-proj-head"),
        page: 1,
        sectionId: "projects",
        text: proj.title,
        rightText: `${proj.startDate} - ${proj.endDate}`,
        secondaryText: proj.subtitle,
        kind: "projectHeading",
        layout: {
          pageWidth: 595.28,
          pageHeight: 841.89,
          x: 40,
          y: 580,
          width: 515,
          height: 16,
          fontSize: 10,
          fontFamily: "Times New Roman, serif",
          fontWeight: 700,
          lineHeight: 14,
          textAlign: "left",
          variant: "body",
        },
      });

      proj.bullets.forEach((bullet, bIdx) => {
        projLines.push({
          id: `${proj.id}-bullet-${bIdx}`,
          page: 1,
          sectionId: "projects",
          text: bullet,
          kind: "bullet",
          layout: {
            pageWidth: 595.28,
            pageHeight: 841.89,
            x: 52,
            y: 600 + bIdx * 16,
            width: 503,
            height: 15,
            fontSize: 9.2,
            fontFamily: "Times New Roman, serif",
            fontWeight: 400,
            lineHeight: 13,
            textAlign: "left",
            variant: "body",
          },
        });
      });
    });

    sections.push({
      id: "projects",
      title: "Projects",
      lines: projLines,
    });
  }

  // 7. Achievements Section
  if (achievements.length > 0) {
    const achLines: ResumeLine[] = [
      {
        id: createId("line-ach-title"),
        page: 1,
        sectionId: "achievements",
        text: "ACHIEVEMENTS AND ACTIVITIES",
        kind: "text",
        layout: {
          pageWidth: 595.28,
          pageHeight: 841.89,
          x: 40,
          y: 720,
          width: 515,
          height: 16,
          fontSize: 11,
          fontFamily: "Times New Roman, serif",
          fontWeight: 700,
          lineHeight: 15,
          textAlign: "left",
          variant: "sectionHeading",
        },
      },
    ];

    achievements.forEach((ach) => {
      achLines.push({
        id: ach.id || createId("line-ach-item"),
        page: 1,
        sectionId: "achievements",
        text: ach.subtitle ? `${ach.title} -- ${ach.subtitle}` : ach.title,
        rightText: ach.date,
        kind: "bullet",
        layout: {
          pageWidth: 595.28,
          pageHeight: 841.89,
          x: 52,
          y: 740,
          width: 503,
          height: 14,
          fontSize: 9.2,
          fontFamily: "Times New Roman, serif",
          fontWeight: 400,
          lineHeight: 13,
          textAlign: "left",
          variant: "body",
        },
      });
    });

    sections.push({
      id: "achievements",
      title: "Achievements",
      lines: achLines,
    });
  }

  // 7. Custom Sections
  if (model.customSections && model.customSections.length > 0) {
    model.customSections.forEach((sec, sIdx) => {
      const secId = sec.id || `custom-${sIdx + 1}`;
      const lines: ResumeLine[] = [
        {
          id: createId(`line-${secId}-title`),
          page: 1,
          sectionId: secId,
          text: sec.title || "Custom Section",
          kind: "subheading",
          layout: {
            pageWidth: 595.28,
            pageHeight: 841.89,
            x: 40,
            y: 780,
            width: 515,
            height: 16,
            fontSize: 11,
            fontFamily: "Times New Roman, serif",
            fontWeight: 700,
            lineHeight: 15,
            textAlign: "left",
            variant: "sectionHeading",
          },
        },
      ];

      (sec.items || []).forEach((item) => {
        lines.push({
          id: item.id || createId(`line-${secId}-item`),
          page: 1,
          sectionId: secId,
          text: item.subtitle ? `${item.title} -- ${item.subtitle}` : item.title,
          rightText: item.date,
          kind: "subheading",
          layout: {
            pageWidth: 595.28,
            pageHeight: 841.89,
            x: 40,
            y: 795,
            width: 515,
            height: 14,
            fontSize: 10,
            fontFamily: "Times New Roman, serif",
            fontWeight: 700,
            lineHeight: 13,
            textAlign: "left",
            variant: "headerSub",
          },
        });

        (item.bullets || []).forEach((bullet, bIdx) => {
          lines.push({
            id: `${item.id}-bullet-${bIdx}`,
            page: 1,
            sectionId: secId,
            text: bullet,
            kind: "bullet",
            layout: {
              pageWidth: 595.28,
              pageHeight: 841.89,
              x: 52,
              y: 810,
              width: 503,
              height: 14,
              fontSize: 9.1,
              fontFamily: "Times New Roman, serif",
              fontWeight: 400,
              lineHeight: 13,
              textAlign: "left",
              variant: "body",
            },
          });
        });
      });

      sections.push({
        id: secId,
        title: sec.title || "Custom Section",
        lines,
      });
    });
  }

  return sections;
}

/**
 * Patches a ResumeDocumentModel using an AiSuggestion action on a target lineId.
 */
export function applySuggestionToDocumentModel(
  model: ResumeDocumentModel,
  targetLineId: string,
  suggestedText: string,
  action: "replace" | "insert_before" | "insert_after" | "delete",
): ResumeDocumentModel {
  const next = JSON.parse(JSON.stringify(model)) as ResumeDocumentModel;

  // Handle Summary
  if (targetLineId.includes("sum")) {
    if (action === "delete") next.summary = "";
    else next.summary = suggestedText;
    return next;
  }

  // Handle Experience Bullets
  for (const exp of next.experience) {
    const bulletIdx = exp.bullets.findIndex((_, idx) => `${exp.id}-bullet-${idx}` === targetLineId);
    if (bulletIdx !== -1) {
      if (action === "replace") exp.bullets[bulletIdx] = suggestedText;
      else if (action === "delete") exp.bullets.splice(bulletIdx, 1);
      else if (action === "insert_before") exp.bullets.splice(bulletIdx, 0, suggestedText);
      else if (action === "insert_after") exp.bullets.splice(bulletIdx + 1, 0, suggestedText);
      return next;
    }
  }

  // Handle Project Bullets
  for (const proj of next.projects) {
    const bulletIdx = proj.bullets.findIndex((_, idx) => `${proj.id}-bullet-${idx}` === targetLineId);
    if (bulletIdx !== -1) {
      if (action === "replace") proj.bullets[bulletIdx] = suggestedText;
      else if (action === "delete") proj.bullets.splice(bulletIdx, 1);
      else if (action === "insert_before") proj.bullets.splice(bulletIdx, 0, suggestedText);
      else if (action === "insert_after") proj.bullets.splice(bulletIdx + 1, 0, suggestedText);
      return next;
    }
  }

  // Handle Skills
  for (const skill of next.skills) {
    if (skill.id === targetLineId) {
      if (action === "delete") {
        next.skills = next.skills.filter((s) => s.id !== targetLineId);
      } else {
        const parts = suggestedText.split(/:\s*/);
        if (parts.length > 1) {
          skill.category = parts[0].trim();
          skill.skills = parts[1].split(/,\s*/).map((s) => s.trim()).filter(Boolean);
        }
      }
      return next;
    }
  }

  return next;
}
