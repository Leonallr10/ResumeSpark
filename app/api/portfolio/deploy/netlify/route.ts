import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { token, html, siteName, siteId } = await req.json();

    if (!token || !html) {
      return NextResponse.json(
        { error: "token and html are required" },
        { status: 400 },
      );
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    let targetSiteId = siteId;

    if (!targetSiteId) {
      const slug = (siteName || "my-portfolio")
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 60);

      const createRes = await fetch("https://api.netlify.com/api/v1/sites", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: slug }),
      });

      if (!createRes.ok) {
        const err = await createRes.text();
        return NextResponse.json(
          { error: `Failed to create site: ${err}` },
          { status: 502 },
        );
      }

      const site = await createRes.json();
      targetSiteId = site.id;
    }

    const htmlBuffer = new TextEncoder().encode(html);
    const hashBuffer = await crypto.subtle.digest("SHA-1", htmlBuffer);
    const sha1 = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const deployRes = await fetch(
      `https://api.netlify.com/api/v1/sites/${targetSiteId}/deploys`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          files: { "/index.html": sha1 },
        }),
      },
    );

    if (!deployRes.ok) {
      const err = await deployRes.text();
      return NextResponse.json(
        { error: `Failed to create deploy: ${err}` },
        { status: 502 },
      );
    }

    const deploy = await deployRes.json();
    const deployId = deploy.id;

    if (deploy.required && deploy.required.length > 0) {
      const uploadRes = await fetch(
        `https://api.netlify.com/api/v1/deploys/${deployId}/files/index.html`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/octet-stream",
          },
          body: htmlBuffer,
        },
      );

      if (!uploadRes.ok) {
        const err = await uploadRes.text();
        return NextResponse.json(
          { error: `Failed to upload file: ${err}` },
          { status: 502 },
        );
      }
    }

    let url = deploy.ssl_url || deploy.url || "";
    for (let i = 0; i < 10; i++) {
      const statusRes = await fetch(
        `https://api.netlify.com/api/v1/deploys/${deployId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (statusRes.ok) {
        const status = await statusRes.json();
        if (status.state === "ready") {
          url = status.ssl_url || status.url || url;
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 1500));
    }

    return NextResponse.json({
      url,
      siteId: targetSiteId,
      deployId,
    });
  } catch {
    return NextResponse.json(
      { error: "Deployment failed" },
      { status: 500 },
    );
  }
}
