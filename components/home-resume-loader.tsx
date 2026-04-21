"use client";

import dynamic from "next/dynamic";

const ResumeTailorApp = dynamic(
  () =>
    import("@/components/latex-resume-tailor-app").then(
      (mod) => mod.LatexResumeTailorApp,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    ),
  },
);

export function HomeResumeLoader() {
  return <ResumeTailorApp />;
}
