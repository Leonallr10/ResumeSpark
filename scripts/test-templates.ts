import { TEMPLATE_REGISTRY } from "../lib/templates/registry";
import { escapeLatex } from "../lib/templates/latex-builders";
import { createEmptyResumeDocument, createSampleResumeTemplate1 } from "../server/documents/resume-document-model";
import { parseLatexToDocumentModel, analyzeLatexStructure } from "../server/documents/from-latex";
import { validateAtsReadingOrder } from "../server/documents/ats-checker";

async function runTests() {
  console.log("==================================================");
  console.log("   RUNNING RESUME TEMPLATE ENGINE TEST SUITE      ");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, extra?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${name} ${extra ? `(${extra})` : ""}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // TEST 1: Template Registry Integrity
  // ----------------------------------------------------
  console.log("Test Suite 1: Template Registry Verification");
  const templateIds = ["template-1", "template-2", "template-3", "template-4"];
  for (const id of templateIds) {
    const tpl = TEMPLATE_REGISTRY[id];
    assert(`Registry contains ${id} (${tpl?.name})`, !!tpl);
    assert(`${id} defines spec, renderHtml, and renderLatex`, !!tpl.spec && typeof tpl.renderHtml === "function" && typeof tpl.renderLatex === "function");
  }

  // ----------------------------------------------------
  // TEST 2: Special Characters Escaping
  // ----------------------------------------------------
  console.log("\nTest Suite 2: LaTeX Special Characters Escaping");
  const dangerousString = "C++ & Python % 100% #1 $500_000 {curly} ~tilde ^caret \\slash";
  const escaped = escapeLatex(dangerousString);
  assert("Escapes & to \\&", escaped.includes("\\&"));
  assert("Escapes % to \\%", escaped.includes("\\%"));
  assert("Escapes # to \\#", escaped.includes("\\#"));
  assert("Escapes $ to \\$", escaped.includes("\\$"));
  assert("Escapes _ to \\_", escaped.includes("\\_"));
  assert("Escapes { to \\{", escaped.includes("\\{"));
  assert("Escapes } to \\}", escaped.includes("\\}"));
  assert("Escapes ~ to \\textasciitilde{}", escaped.includes("\\textasciitilde{}"));
  assert("Escapes ^ to \\textasciicircum{}", escaped.includes("\\textasciicircum{}"));
  assert("Escapes \\ to \\textbackslash{}", escaped.includes("\\textbackslash{}"));

  // ----------------------------------------------------
  // TEST 3: Full Resume Fixture Rendering
  // ----------------------------------------------------
  console.log("\nTest Suite 3: Complete Schema Rendering Across All 4 Templates");
  const fullModel = createSampleResumeTemplate1();

  for (const id of templateIds) {
    const tpl = TEMPLATE_REGISTRY[id];
    const latexOutput = tpl.renderLatex(fullModel);
    const htmlOutput = tpl.renderHtml(fullModel);

    assert(`${id} LaTeX contains marker ${tpl.spec.marker}`, latexOutput.includes(tpl.spec.marker));
    assert(`${id} LaTeX contains applicant name`, latexOutput.includes("LEONAL") || latexOutput.includes("LEONAL_ROBIN") || latexOutput.includes("Leonal"));
    assert(`${id} LaTeX includes experience companies`, latexOutput.includes("Flam"));
    assert(`${id} HTML contains contenteditable fields`, htmlOutput.includes('contenteditable="true"'));
    assert(`${id} HTML contains data-field bindings`, htmlOutput.includes('data-field="personalInfo.fullName"'));
  }

  // ----------------------------------------------------
  // TEST 4: Empty Array Fixture Handling (Graceful Rendering)
  // ----------------------------------------------------
  console.log("\nTest Suite 4: Empty Array Handling");
  const emptyModel = createEmptyResumeDocument();
  emptyModel.experience = [];
  emptyModel.projects = [];
  emptyModel.skills = [];
  emptyModel.extras = [];
  emptyModel.achievements = [];
  emptyModel.summary = "";

  for (const id of templateIds) {
    const tpl = TEMPLATE_REGISTRY[id];
    const latexOutput = tpl.renderLatex(emptyModel);
    const htmlOutput = tpl.renderHtml(emptyModel);

    assert(`${id} renders valid LaTeX with empty arrays`, latexOutput.includes("\\begin{document}") && latexOutput.includes("\\end{document}"));
    assert(`${id} does not emit empty itemize lists`, !latexOutput.includes("\\itemListStart\n\n  \\itemListEnd"));
    assert(`${id} renders valid HTML container`, htmlOutput.includes("resume-sheet"));
  }

  // ----------------------------------------------------
  // TEST 5: Bidirectional AST Structure Analysis & Extraction
  // ----------------------------------------------------
  console.log("\nTest Suite 5: Bidirectional AST Sync & Template Recognition");
  for (const id of templateIds) {
    const tpl = TEMPLATE_REGISTRY[id];
    const latex = tpl.renderLatex(fullModel);

    const analysis = analyzeLatexStructure(latex);
    assert(`${id} recognized correct templateId (${analysis.model.templateId})`, analysis.model.templateId === id);
    assert(`${id} has zero unexpected structural deviations`, !analysis.hasCustomStructure);
    assert(`${id} extracted full name correctly`, analysis.model.personalInfo.fullName.toLowerCase().includes("leonal"));
    assert(`${id} extracted experience count (${analysis.model.experience.length})`, analysis.model.experience.length > 0);
  }

  // ----------------------------------------------------
  // TEST 6: ATS Reading-Order Sequence Validation
  // ----------------------------------------------------
  console.log("\nTest Suite 6: ATS Reading-Order Sequence Validation");
  const linearStream = [
    fullModel.personalInfo.fullName,
    `${fullModel.personalInfo.location} | ${fullModel.personalInfo.email} | ${fullModel.personalInfo.phone}`,
    "Professional Summary",
    fullModel.summary,
    "Work Experience",
    ...fullModel.experience.map((e) => `${e.company}\n${e.role}\n${e.bullets.join("\n")}`),
    "Education",
    ...fullModel.education.map((e) => `${e.institution}\n${e.degree}`),
    "Technical Skills",
    ...fullModel.skills.map((s) => `${s.category}: ${s.skills.join(", ")}`),
    "Projects",
    ...fullModel.projects.map((p) => `${p.title}\n${p.bullets.join("\n")}`),
    "Achievements and Activities",
    ...fullModel.extras.map((x) => `${x.title} - ${x.subtitle}`),
  ].join("\n\n");

  const atsResult = validateAtsReadingOrder(linearStream, fullModel);
  assert("ATS reading order validation succeeds on linear stream", atsResult.isValid, atsResult.issues.join(", "));
  assert("ATS score is 100 on correct linear sequence", atsResult.score === 100, `Score was: ${atsResult.score}`);

  // Inverted reading order test
  const invertedStream = `Projects
${fullModel.projects[0]?.title}
Work Experience
${fullModel.experience[0]?.company}
${fullModel.personalInfo.fullName}`;
  const brokenAts = validateAtsReadingOrder(invertedStream, fullModel);
  assert("ATS validator flags inverted/out-of-order text stream", !brokenAts.isValid && brokenAts.issues.length > 0);

  console.log("\n==================================================");
  console.log(`   TEST RUN COMPLETE: ${passed} PASSED, ${failed} FAILED `);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
