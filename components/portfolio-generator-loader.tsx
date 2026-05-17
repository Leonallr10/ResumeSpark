"use client";

import dynamic from "next/dynamic";

const PortfolioGenerator = dynamic(
  () =>
    import("@/components/portfolio-generator").then(
      (mod) => mod.PortfolioGenerator,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading Portfolio Generator...
      </div>
    ),
  },
);

export function PortfolioGeneratorLoader() {
  return <PortfolioGenerator />;
}
