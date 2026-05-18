"use client";

import dynamic from "next/dynamic";

const LandingPage = dynamic(
  () =>
    import("@/components/landing-page").then(
      (mod) => mod.LandingPage,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-black text-emerald-400">
        Loading…
      </div>
    ),
  },
);

export function LandingPageLoader() {
  return <LandingPage />;
}
