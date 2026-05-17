import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { token, html, projectName } = await req.json();

    if (!token || !html) {
      return NextResponse.json(
        { error: "token and html are required" },
        { status: 400 },
      );
    }

    const name = (projectName || "my-portfolio")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60);

    const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        files: [
          {
            file: "index.html",
            data: html,
          },
        ],
        projectSettings: {
          framework: null,
          buildCommand: "",
          installCommand: "",
          outputDirectory: "",
        },
        target: "production",
      }),
    });

    if (!deployRes.ok) {
      const err = await deployRes.text();
      return NextResponse.json(
        { error: `Deployment failed: ${err}` },
        { status: 502 },
      );
    }

    const deploy = await deployRes.json();
    let url = deploy.url ? `https://${deploy.url}` : "";
    const deployId = deploy.id;

    for (let i = 0; i < 15; i++) {
      const statusRes = await fetch(
        `https://api.vercel.com/v13/deployments/${deployId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (statusRes.ok) {
        const status = await statusRes.json();
        if (status.readyState === "READY") {
          url = status.url ? `https://${status.url}` : url;
          break;
        }
        if (status.readyState === "ERROR") {
          return NextResponse.json(
            { error: "Deployment failed on Vercel" },
            { status: 502 },
          );
        }
      }
      await new Promise((r) => setTimeout(r, 2000));
    }

    return NextResponse.json({
      url,
      deployId,
      projectName: name,
    });
  } catch {
    return NextResponse.json(
      { error: "Deployment failed" },
      { status: 500 },
    );
  }
}
