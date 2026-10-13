"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { LoaderCircle } from "lucide-react";
import { FORMATS, describePoster } from "@/lib/catalog";
import { renderPoster } from "@/lib/render-poster";
import { previewResolution, type PreviewResolution } from "@/lib/preview-resolution";
import type { PosterConfig, RenderResult } from "@/lib/studio-types";

export type PreviewStatus = RenderResult & { ready: boolean };

type RenderedPoster = { config: PosterConfig; result: RenderResult; failed: boolean };
type RenderedPreview = RenderedPoster & { resolution: PreviewResolution };

const PREVIEW_ERROR = "L’aperçu n’a pas pu être créé. Réessayez ou rechargez la page.";

function usePreviewResolution(ref: RefObject<HTMLDivElement | null>) {
  const [resolution, setResolution] = useState<PreviewResolution | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let frame = 0;
    let densityQuery: MediaQueryList | undefined;

    const measure = () => {
      frame = 0;
      const { width, height } = element.getBoundingClientRect();
      const next = previewResolution(width, height, window.devicePixelRatio);
      if (!next) return;
      setResolution((previous) => previous?.pixelWidth === next.pixelWidth && previous.pixelHeight === next.pixelHeight ? previous : next);
    };
    const scheduleMeasure = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const watchDensity = () => {
      densityQuery?.removeEventListener("change", densityChanged);
      if (typeof window.matchMedia !== "function") return;
      densityQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      densityQuery.addEventListener("change", densityChanged);
    };
    function densityChanged() { watchDensity(); scheduleMeasure(); }

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(scheduleMeasure) : undefined;
    observer?.observe(element);
    window.addEventListener("resize", scheduleMeasure, { passive: true });
    watchDensity();
    scheduleMeasure();
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      densityQuery?.removeEventListener("change", densityChanged);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref]);

  return resolution;
}

export function PosterPreview({ config, canvasRef, onStatus, decorative = false }: {
  config: PosterConfig;
  canvasRef?: RefObject<HTMLCanvasElement | null>;
  onStatus?: (status: PreviewStatus) => void;
  decorative?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLCanvasElement>(null);
  const resolution = usePreviewResolution(containerRef);
  const [renderedPreview, setRenderedPreview] = useState<RenderedPreview | null>(null);
  const [renderedExport, setRenderedExport] = useState<RenderedPoster | null>(null);
  const format = FORMATS.find((item) => item.id === config.formatId)!;
  const currentPreview = renderedPreview?.config === config ? renderedPreview : null;
  const loading = !currentPreview || currentPreview.resolution !== resolution;
  const failed = currentPreview?.failed ?? false;

  // Only the editor needs an export canvas, always at the format's native size.
  // Resizing a preview never regenerates or changes the downloadable bitmap.
  useEffect(() => {
    if (!canvasRef) return;
    let cancelled = false;
    const staging = document.createElement("canvas");
    renderPoster(staging, config).then((result) => {
      if (cancelled) return;
      canvasRef.current = staging;
      setRenderedExport({ config, result, failed: false });
    }).catch(() => {
      if (cancelled) return;
      setRenderedExport({ config, failed: true, result: { fits: false, error: PREVIEW_ERROR, altText: describePoster(config) } });
    });
    return () => {
      cancelled = true;
      if (canvasRef.current === staging) canvasRef.current = null;
    };
  }, [config, canvasRef]);

  useEffect(() => {
    if (!resolution) return;
    let cancelled = false;
    const staging = document.createElement("canvas");
    renderPoster(staging, config, resolution).then((result) => {
      if (cancelled || !displayRef.current) return;
      const canvas = displayRef.current;
      canvas.width = staging.width;
      canvas.height = staging.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Le navigateur ne prend pas en charge l’aperçu.");
      // Both bitmaps have identical physical dimensions: no final resampling.
      context.drawImage(staging, 0, 0);
      setRenderedPreview({ config, resolution, result, failed: false });
    }).catch(() => {
      if (cancelled) return;
      setRenderedPreview({ config, resolution, failed: true, result: { fits: false, error: PREVIEW_ERROR, altText: describePoster(config) } });
    });
    return () => { cancelled = true; };
  }, [config, resolution]);

  useEffect(() => {
    if (!onStatus) return;
    const native = renderedExport?.config === config ? renderedExport : null;
    const preview = renderedPreview?.config === config ? renderedPreview : null;
    if (!native || !preview) {
      onStatus({ ready: false, fits: true, altText: describePoster(config) });
    } else if (native.failed || preview.failed) {
      onStatus({ ready: false, fits: false, error: PREVIEW_ERROR, altText: describePoster(config) });
    } else {
      onStatus({
        ...native.result,
        fits: native.result.fits && preview.result.fits,
        error: native.result.error ?? preview.result.error,
        ready: true,
      });
    }
  }, [config, renderedExport, renderedPreview, onStatus]);

  return (
    <div ref={containerRef} className="preview-container" style={{ aspectRatio: `${format.width} / ${format.height}` }}>
      <canvas ref={displayRef} className="poster-canvas" width={format.width} height={format.height}
        role={decorative ? undefined : "img"} aria-hidden={decorative || undefined}
        aria-label={decorative ? undefined : describePoster(config)}>
        {decorative ? null : describePoster(config)}
      </canvas>
      {loading || failed ? <div className="poster-loading" aria-hidden="true">
        {failed ? <span className="px-4 text-center text-sm">Aperçu indisponible</span> : <LoaderCircle className="size-5 animate-spin" />}
      </div> : null}
    </div>
  );
}
