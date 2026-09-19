import { generateLatexFromDocumentModel } from "@/server/documents/to-latex";
import type { ResumeDocumentModel } from "@/server/documents/resume-document-model";

export async function orchestrateLatexCompile(params: {
  latex?: string;
  documentModel?: ResumeDocumentModel;
  engine?: "pdflatex" | "xelatex" | "tectonic";
}): Promise<{ latexSource: string }> {
  let source = params.latex || "";
  if (!source && params.documentModel) {
    source = generateLatexFromDocumentModel(params.documentModel);
  }

  if (!source) {
    throw new Error("No LaTeX source or document model provided for compilation.");
  }

  return { latexSource: source };
}
