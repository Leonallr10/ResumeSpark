import { NextResponse } from "next/server";

import { getPdf } from "@/lib/pdf-cache";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const pdf = getPdf(id);

  if (!pdf) {
    return NextResponse.json(
      { error: "Preview expired or not found." },
      { status: 404 },
    );
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="resume.pdf"',
      "Cache-Control": "private, max-age=1800",
    },
  });
}
