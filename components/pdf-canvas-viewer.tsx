"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";

import type { SynctexMapping, SynctexRect } from "@/lib/synctex-parser";
import { inverseSync } from "@/lib/synctex-parser";

export type PdfCanvasViewerHandle = {
  scrollToPage(page: number): void;
};

type PdfCanvasViewerProps = {
  pdfData: ArrayBuffer | null;
  zoom: number;
  onZoomChange?: (zoom: number) => void;
  synctexMapping: SynctexMapping | null;
  lineOffset: number;
  highlightRect: SynctexRect | null;
  onPdfClick: (line: number) => void;
  onHighlightFade: () => void;
  onPageCount?: (n: number) => void;
};

type PageInfo = { width: number; height: number };

const MIN_ZOOM = 50;
const MAX_ZOOM = 300;
const RENDER_DEBOUNCE_MS = 300;

export const PdfCanvasViewer = forwardRef<PdfCanvasViewerHandle, PdfCanvasViewerProps>(
  function PdfCanvasViewer(
    { pdfData, zoom, onZoomChange, synctexMapping, lineOffset, highlightRect, onPdfClick, onHighlightFade, onPageCount },
    ref,
  ) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const innerWrapperRef = useRef<HTMLDivElement>(null);
    const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
    const pageWrappersRef = useRef<Map<number, HTMLDivElement>>(new Map());
    const [pages, setPages] = useState<PageInfo[]>([]);
    const [layoutZoom, setLayoutZoom] = useState(zoom);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfDocRef = useRef<any>(null);
    const renderTaskRef = useRef<number>(0);
    const renderedZoomRef = useRef<number>(100);
    const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const liveZoomRef = useRef<number>(zoom);
    const isWheelCommitRef = useRef(false);
    const onZoomChangeRef = useRef(onZoomChange);
    onZoomChangeRef.current = onZoomChange;

    // Keep liveZoomRef in sync with prop (from toolbar buttons)
    useEffect(() => {
      liveZoomRef.current = zoom;
    }, [zoom]);

    useImperativeHandle(ref, () => ({
      scrollToPage(page: number) {
        const wrapper = pageWrappersRef.current.get(page);
        if (wrapper && scrollContainerRef.current) {
          const container = scrollContainerRef.current;
          container.scrollTo({ top: wrapper.offsetTop - 16, behavior: "smooth" });
        }
      },
    }));

    // Load PDF document
    useEffect(() => {
      if (!pdfData) {
        setPages([]);
        return;
      }

      let cancelled = false;

      async function loadPdf() {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const doc = await pdfjs.getDocument({ data: pdfData!.slice(0) }).promise;
        if (cancelled) {
          doc.destroy();
          return;
        }

        pdfDocRef.current = doc;
        onPageCount?.(doc.numPages);

        const pageInfos: PageInfo[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const vp = page.getViewport({ scale: 1 });
          pageInfos.push({ width: vp.width, height: vp.height });
        }
        if (!cancelled) setPages(pageInfos);
      }

      loadPdf();

      return () => {
        cancelled = true;
        if (pdfDocRef.current) {
          pdfDocRef.current.destroy();
          pdfDocRef.current = null;
        }
      };
    }, [pdfData, onPageCount]);

    // Full-quality render at a specific zoom level
    const renderSharp = useCallback((targetZoom: number) => {
      if (!pdfDocRef.current || pages.length === 0) return;
      if (renderedZoomRef.current === targetZoom) return;

      const taskId = ++renderTaskRef.current;
      const scale = targetZoom / 100;
      const dpr = window.devicePixelRatio || 1;

      async function render() {
        const doc = pdfDocRef.current;
        if (!doc) return;

        // Render into offscreen canvases to prevent stutter/flicker while waiting for PDF.js
        const offscreenCanvases: Record<number, HTMLCanvasElement> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const viewports: Record<number, any> = {};

        for (let i = 1; i <= doc.numPages; i++) {
          if (taskId !== renderTaskRef.current) return;

          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: scale * dpr });
          viewports[i] = viewport;

          const offscreen = document.createElement("canvas");
          offscreen.width = viewport.width;
          offscreen.height = viewport.height;

          const ctx = offscreen.getContext("2d");
          if (!ctx) continue;

          try {
            await page.render({ canvasContext: ctx, viewport }).promise;
          } catch (err: unknown) {
            // RenderingCancelledException is expected when a newer render supersedes this one
            const name = (err as { name?: string })?.name ?? "";
            if (name === "RenderingCancelledException") return;
            throw err;
          }

          if (taskId !== renderTaskRef.current) return;
          offscreenCanvases[i] = offscreen;
        }

        // Apply to DOM in a single synchronous block
        if (taskId === renderTaskRef.current) {
          renderedZoomRef.current = targetZoom;
          // Flush layout zoom synchronously so pages resize BEFORE we
          // remove the CSS transform — avoids a flash at the old size.
          flushSync(() => setLayoutZoom(targetZoom));

          for (let i = 1; i <= doc.numPages; i++) {
             const canvas = canvasRefs.current.get(i);
             const offscreen = offscreenCanvases[i];
             const viewport = viewports[i];
             if (canvas && offscreen && viewport) {
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                canvas.style.width = `${viewport.width / dpr}px`;
                canvas.style.height = `${viewport.height / dpr}px`;
                const ctx = canvas.getContext("2d");
                ctx?.drawImage(offscreen, 0, 0);
             }
          }

          applyLiveTransform(targetZoom);
        }
      }

      render().catch((err: unknown) => {
        const name = (err as { name?: string })?.name ?? "";
        if (name !== "RenderingCancelledException") {
          console.error("[PdfCanvasViewer] Render error:", err);
        }
      });
    }, [pages]);


    // Apply CSS transform for instant visual zoom (no re-render)
    function applyLiveTransform(currentZoom: number, origin = "top center") {
      const wrapper = innerWrapperRef.current;
      if (!wrapper) return;

      const rendered = renderedZoomRef.current;
      const factor = currentZoom / rendered;

      wrapper.style.transform = factor === 1 ? "" : `scale(${factor})`;
      wrapper.style.transformOrigin = origin;
      wrapper.style.width = "";
      wrapper.style.height = "";
    }

    // Initial render when pages become available
    useEffect(() => {
      if (pages.length > 0) {
        renderedZoomRef.current = 0; // force re-render
        renderSharp(zoom);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pages, renderSharp]);

    // When zoom prop changes (from toolbar buttons), debounce sharp render
    useEffect(() => {
      if (pages.length === 0) return;

      // Wheel zoom commit: the wheel handler already applied the correct
      // transform + scroll, and renderSharp was called directly — skip here
      // to avoid overriding the "0 0" origin with "top center" (causes jump).
      if (isWheelCommitRef.current) {
        isWheelCommitRef.current = false;
        return;
      }

      // Toolbar buttons: apply CSS transform for smooth visual
      applyLiveTransform(zoom);

      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
      commitTimerRef.current = setTimeout(() => {
        renderSharp(zoom);
      }, RENDER_DEBOUNCE_MS);

      return () => {
        if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
      };
    }, [zoom, pages, renderSharp]);

    // Pinch-to-zoom & Ctrl+Wheel — bypasses React entirely during active zoom
    useEffect(() => {
      const container = scrollContainerRef.current;
      if (!container) return;

      function handleWheel(e: WheelEvent) {
        const ct = scrollContainerRef.current;
        if (!ct) return;
        // Trackpad pinch on all platforms sends ctrl+wheel
        // Regular Ctrl+wheel from mouse also works
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        e.stopPropagation();

        const current = liveZoomRef.current;
        // deltaY magnitude: trackpad pinch = small (0.5-5), mouse wheel = large (50-120)
        const raw = -e.deltaY;
        const step = Math.abs(raw) < 10
          ? Math.sign(raw) * Math.max(1, Math.abs(raw) * 0.8)
          : Math.sign(raw) * Math.min(15, Math.abs(raw) * 0.1);

        const newZoom = Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current + step)));
        if (newZoom === current) return;

        // Cursor-point zoom: adjust scroll so content under cursor stays fixed
        const containerRect = ct.getBoundingClientRect();
        const mouseX = e.clientX - containerRect.left;
        const mouseY = e.clientY - containerRect.top;
        const ratio = newZoom / current;

        liveZoomRef.current = newZoom;

        const wrapper = innerWrapperRef.current;
        const cx = wrapper ? wrapper.offsetWidth / 2 : ct.scrollWidth / 2;

        // Apply CSS transform with origin at top center to match React layout centering
        applyLiveTransform(newZoom, "top center");
        
        // Force layout recalculation so the browser updates scrollHeight/scrollWidth 
        // based on the new transform before we set scrollTop/Left. This prevents clamping!
        if (wrapper) void wrapper.offsetHeight;

        // Adjust scroll position to keep cursor point stationary
        ct.scrollTop = Math.max(0, (ct.scrollTop + mouseY) * ratio - mouseY);
        ct.scrollLeft = Math.max(0, cx + (ct.scrollLeft + mouseX - cx) * ratio - mouseX);

        // Debounce: commit to React state after user stops zooming
        if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
        commitTimerRef.current = setTimeout(() => {
          isWheelCommitRef.current = true;
          onZoomChangeRef.current?.(liveZoomRef.current);
          renderSharp(liveZoomRef.current);
        }, RENDER_DEBOUNCE_MS);
      }

      container.addEventListener("wheel", handleWheel, { passive: false });
      return () => container.removeEventListener("wheel", handleWheel);
    }, [renderSharp]);

    // Inverse sync — click PDF to jump to source
    const handlePageClick = useCallback(
      (event: React.MouseEvent, pageNumber: number) => {
        if (!synctexMapping) return;

        const canvas = canvasRefs.current.get(pageNumber);
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const canvasCssWidth = parseFloat(canvas.style.width);
        if (!canvasCssWidth) return;

        const scaleOnScreen = rect.width / canvasCssWidth;
        const displayScale = liveZoomRef.current / 100;

        const clickX = (event.clientX - rect.left) / displayScale / scaleOnScreen;
        const clickY = (event.clientY - rect.top) / displayScale / scaleOnScreen;

        const sourceLine = inverseSync(synctexMapping, pageNumber, clickX, clickY);
        if (sourceLine !== null) {
          const adjustedLine = sourceLine - lineOffset;
          if (adjustedLine > 0) {
            onPdfClick(adjustedLine);
          }
        }
      },
      [synctexMapping, lineOffset, onPdfClick],
    );

    // Forward sync highlight auto-fade
    useEffect(() => {
      if (!highlightRect) return;
      const timer = setTimeout(onHighlightFade, 2000);
      return () => clearTimeout(timer);
    }, [highlightRect, onHighlightFade]);

    if (!pdfData) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Compile the PDF to enable preview with SyncTeX navigation.
        </div>
      );
    }

    if (pages.length === 0) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Loading PDF...
        </div>
      );
    }

    const scale = layoutZoom / 100;

    return (
      <div
        ref={scrollContainerRef}
        className="h-full overflow-auto"
        style={{ touchAction: "pan-x pan-y" }}
      >
        <div
          ref={innerWrapperRef}
          className="flex flex-col items-center"
          style={{ 
            willChange: "transform",
            gap: `${16 * scale}px`,
            paddingTop: `${16 * scale}px`,
            paddingBottom: `${16 * scale}px`
          }}
        >
          {pages.map((page, idx) => {
            const pageNumber = idx + 1;
            const cssWidth = page.width * scale;
            const cssHeight = page.height * scale;

            return (
              <div
                key={pageNumber}
                ref={(el) => {
                  if (el) pageWrappersRef.current.set(pageNumber, el);
                }}
                className="relative flex-shrink-0 bg-white shadow-md"
                style={{ width: cssWidth, height: cssHeight, overflow: "hidden" }}
                onClick={(e) => handlePageClick(e, pageNumber)}
                title={synctexMapping ? "Click to jump to source line" : undefined}
              >
                <canvas
                  ref={(el) => {
                    if (el) canvasRefs.current.set(pageNumber, el);
                  }}
                  className={synctexMapping ? "cursor-crosshair" : ""}
                />
                {highlightRect && highlightRect.page === pageNumber && (
                  <div
                    className="pointer-events-none absolute rounded bg-yellow-300/40 transition-opacity duration-1000"
                    style={{
                      left: highlightRect.x * scale,
                      top: highlightRect.y * scale,
                      width: Math.max(highlightRect.width * scale, 20),
                      height: Math.max(highlightRect.height * scale, 10),
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);
