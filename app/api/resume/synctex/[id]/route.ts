import { NextResponse } from "next/server";

import { getSynctex } from "@/lib/pdf-cache";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = getSynctex(id);

  if (result === null) {
    const response = NextResponse.json(
      { error: "SyncTeX data not available." },
      { status: 404 },
    );
    return response;
  }

  return new NextResponse(new Uint8Array(result.data), {
    headers: {
      "Content-Type": "application/gzip",
      "Cache-Control": "private, max-age=1800",
      "X-Line-Offset": String(result.lineOffset),
    },
  });
}
