import { NextResponse } from "next/server";
import { z } from "zod";
import { extractLinearPdfText, validateAtsReadingOrder } from "@/server/documents/ats-checker";
import { resumeDocumentModelSchema } from "@/server/documents/resume-document-model";

export const runtime = "nodejs";

const checkAtsRequestSchema = z.object({
  pdfBase64: z.string().min(1),
  model: resumeDocumentModelSchema,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = checkAtsRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid ATS check payload.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { pdfBase64, model } = parsed.data;
    const pdfBuffer = Buffer.from(pdfBase64, "base64");

    const linearText = await extractLinearPdfText(pdfBuffer);
    const result = validateAtsReadingOrder(linearText, model);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to run ATS regression check." },
      { status: 500 },
    );
  }
}
