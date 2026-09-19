import { NextResponse } from "next/server";
import { polishRequestSchema } from "@/lib/schemas";
import { orchestrateTextPolish } from "@/server/orchestrators/polish-orchestrator";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = polishRequestSchema.safeParse(body);

    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid request payload." },
        { status: 400 },
      );
    }

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const ip = request.headers.get("x-forwarded-for") || "anonymous";

    const result = await orchestrateTextPolish({
      text: parsed.data.text,
      action: parsed.data.action,
      provider: parsed.data.provider,
      model: parsed.data.model,
      apiKey: parsed.data.apiKey,
      ipOrUser: ip,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Polish generation failed.";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
