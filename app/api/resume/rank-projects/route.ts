import { NextResponse } from "next/server";
import { projectRankingRequestSchema } from "@/lib/schemas";
import { rankProjectsWithLlm } from "@/server/orchestrators/project-ranker";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = projectRankingRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid project ranking request payload.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { jd, projects, provider, model, apiKey } = parsed.data;

    const ranked = await rankProjectsWithLlm({
      jd,
      projects,
      provider,
      model,
      apiKey,
    });

    return NextResponse.json({
      rankedProjects: ranked,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to rank projects.";
    return NextResponse.json(
      {
        error: message,
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
