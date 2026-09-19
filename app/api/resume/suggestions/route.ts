import { NextResponse } from "next/server";
import { suggestionRequestSchema } from "@/lib/schemas";
import { orchestrateResumeSuggestions } from "@/server/orchestrators/suggestion-orchestrator";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsedRequest = suggestionRequestSchema.safeParse(body);

    if (!parsedRequest.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload.",
          details: parsedRequest.error.flatten(),
        },
        { status: 400 },
      );
    }

    const ip = request.headers.get("x-forwarded-for") || "anonymous";

    const response = await orchestrateResumeSuggestions({
      resumeSections: parsedRequest.data.resumeSections,
      companyRole: parsedRequest.data.companyRole,
      jd: parsedRequest.data.jd,
      project: parsedRequest.data.project,
      provider: parsedRequest.data.provider,
      model: parsedRequest.data.model,
      apiKey: parsedRequest.data.apiKey,
      ipOrUser: ip,
    });

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate resume suggestions.";
    return NextResponse.json(
      {
        error: message,
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: message.includes("quota") ? 429 : 500 },
    );
  }
}
