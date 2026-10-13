"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { LoaderCircle } from "lucide-react";
import { FORMATS, describePoster } from "@/lib/catalog";
import { renderPoster } from "@/lib/render-poster";
import type { PosterConfig, RenderResult } from "@/lib/studio-types";

export type PreviewStatus = RenderResult & { ready: boolean };

export function PosterPreview({ config, canvasRef, onStatus, decorative = false }: {
  config: PosterConfig;
  canvasRef?: RefObject<HTMLCanvasElement | null>;
  onStatus?: (status: PreviewStatus) => void;
  decorative?: boolean;
}) {
  const innerRef = useRef<HTMLCanvasElement>(null);
  const targetRef = canvasRef ?? innerRef;
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const format = FORMATS.find((item) => item.id === config.formatId)!;

  useEffect(() => {
    let cancelled = false;
    const staging = document.createElement("canvas");
    onStatus?.({ ready: false, fits: true, altText: describePoster(config) });
    renderPoster(staging, config).then((result) => {
      if (cancelled || !targetRef.current) return;
      const canvas = targetRef.current;
      canvas.width = staging.width;
      canvas.height = staging.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Le navigateur ne prend pas en charge l’aperçu.");
      context.drawImage(staging, 0, 0);
      setLoading(false);
      setFailed(false);
      onStatus?.({ ...result, ready: true });
    }).catch(() => {
      if (cancelled) return;
      setLoading(false);
      setFailed(true);
      onStatus?.({ ready: false, fits: false, error: "L’aperçu n’a pas pu être créé. Réessayez ou rechargez la page.", altText: describePoster(config) });
    });
    return () => { cancelled = true; };
  }, [config, targetRef, onStatus]);

  return (
    <div className="preview-container" style={{ aspectRatio: `${format.width} / ${format.height}` }}>
      <canvas ref={targetRef} className="poster-canvas" width={format.width} height={format.height}
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
