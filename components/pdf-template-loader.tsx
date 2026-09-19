"use client";

import dynamic from "next/dynamic";

const PdfTemplateEditor = dynamic(
  () => import("@/components/pdf-template-editor").then((mod) => mod.PdfTemplateEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Loading PDF Template Studio…
      </div>
    ),
  },
);

export function PdfTemplateLoader() {
  return <PdfTemplateEditor />;
}
