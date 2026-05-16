"use client";

import { Loader2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";

const MIN_PDF_ZOOM = 50;
const MAX_PDF_ZOOM = 200;

type PdfPreviewProps = {
  pdfUrl: string | null;
  rendering: boolean;
  zoom: number;
};

export function PdfPreview({ pdfUrl, rendering, zoom }: PdfPreviewProps) {
  if (rendering) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Compiling LaTeX PDF...
      </div>
    );
  }

  if (!pdfUrl) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Compile the PDF from the toolbar.
      </div>
    );
  }

  return (
    <iframe
      title="Resume PDF preview"
      src={applyPdfZoom(pdfUrl, zoom)}
      className="h-full w-full border-0 bg-white"
    />
  );
}

type PdfFullscreenPreviewProps = PdfPreviewProps & {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onClose: () => void;
};

export function PdfFullscreenPreview({
  pdfUrl,
  rendering,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onClose,
}: PdfFullscreenPreviewProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#e8eeee]">
      <div className="flex items-center justify-between border-b bg-white px-4 py-2 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold">PDF preview</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            <Undo2 className="h-4 w-4" />
            Back to editor
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {rendering ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-3 w-2 animate-spin" />
            Compiling LaTeX PDF...
          </div>
        ) : pdfUrl ? (
          <iframe
            title="Fullscreen resume PDF preview"
            src={applyPdfZoom(pdfUrl, zoom)}
            className="h-full w-full border-0 bg-white"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Compile the PDF from the toolbar.
          </div>
        )}
      </div>
    </div>
  );
}

export function clampPdfZoom(zoom: number) {
  return Math.max(MIN_PDF_ZOOM, Math.min(MAX_PDF_ZOOM, zoom));
}

function applyPdfZoom(url: string, zoom: number) {
  const [base, hash] = url.split("#");
  const params = new URLSearchParams(hash ?? "");
  params.set("zoom", String(zoom));
  return `${base}#${params.toString()}`;
}
