import fs from "node:fs";
import {
  extractParsedLines,
  groupIntoSections,
  buildDocumentModel,
} from "../lib/pdf-parser";
import { renderTemplate1Latex } from "../lib/templates/latex-builders";

async function run() {
  const filePath = "C:/Users/thava/.gemini/antigravity-ide/brain/7c7e821c-f25f-4bde-ab21-564e38883cbf/.user_uploaded/media_1790678843171.pdf";
  const buf = fs.readFileSync(filePath);
  const file = new File([buf], "leonal-resume.pdf", { type: "application/pdf" });

  console.log("Extracting lines...");
  const { lines, sourceText, annotationUrls } = await extractParsedLines(file);
  console.log(`Extracted ${lines.length} lines. Annotation URLs:`, Array.from(annotationUrls.entries()));

  console.log("\nGrouping into sections...");
  const { sections, unassigned } = groupIntoSections(lines);
  console.log(`Found ${sections.length} sections:`);
  sections.forEach((s) => {
    console.log(`- [${s.canonicalKey}] "${s.label}" (${s.lines.length} lines)`);
    s.lines.forEach((l) => console.log(`    [col ${l.column}] ${l.text}`));
  });

  if (unassigned.length > 0) {
    console.log(`\nUnassigned lines (${unassigned.length}):`);
    unassigned.forEach((l) => console.log(`    [col ${l.column}] ${l.text}`));
  }

  console.log("\nBuilding document model...");
  const { model, confidence } = buildDocumentModel(sections, annotationUrls);
  console.log("Confidence:", confidence);
  console.log("Model JSON:");
  console.log(JSON.stringify(model, null, 2));

  console.log("\nRendering Template 1 LaTeX:");
  const latex = renderTemplate1Latex(model);
  console.log(latex);
}

run().catch(console.error);
