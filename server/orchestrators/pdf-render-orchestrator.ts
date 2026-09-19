import type { ResumeDocumentModel } from "@/server/documents/resume-document-model";
import { getTemplateRenderer } from "@/lib/templates/registry";

/**
 * Orchestrator that compiles a ResumeDocumentModel into a styled, printable HTML document.
 */
export async function orchestratePdfTemplateRender(
  model: ResumeDocumentModel,
  templateId?: string,
): Promise<{ html: string; title: string }> {
  const chosenTemplate = templateId || model.templateId || "template-1";
  const renderer = getTemplateRenderer(chosenTemplate);
  const bodyHtml = renderer(model);

  const title = `${model.personalInfo.fullName || "Resume"} - Tailored`;

  const fullHtmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    @page {
      size: letter;
      margin: 0;
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      background: #f1f5f9;
      display: flex;
      justify-content: center;
    }
    @media print {
      body {
        background: transparent;
      }
    }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;

  return {
    html: fullHtmlDocument,
    title,
  };
}
