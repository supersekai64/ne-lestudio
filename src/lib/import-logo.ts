"use client";

import { importPosterImage, normalizePosterImage } from "./import-image";
import type { PosterImage } from "./studio-types";

export const LOGO_ACCEPT = "image/png,image/svg+xml,.png,.svg";
export const LOGO_IMPORT_HELP = "PNG ou SVG · 5 Mo maximum.";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const INVALID_SVG = "Ce fichier SVG est endommagé ou illisible. Choisissez un autre logo.";

function absoluteLength(length: SVGAnimatedLength): number | undefined {
  try {
    // Percentage lengths need a viewport; derive those from the viewBox instead.
    const value = length.baseVal;
    return value.unitType !== 2 && Number.isFinite(value.value) && value.value > 0 ? value.value : undefined;
  } catch {
    return undefined;
  }
}

export async function importPosterLogo(file: File): Promise<PosterImage> {
  if (file.size > MAX_LOGO_BYTES) throw new Error("Ce logo dépasse 5 Mo. Choisissez un fichier plus léger.");
  if (!file.size) throw new Error("Ce fichier est vide. Choisissez un autre logo.");

  const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const isPng = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, i) => signature[i] === byte);
  if (isPng) return importPosterImage(file);

  if (file.type !== "image/svg+xml" && !/\.svg$/i.test(file.name)) {
    throw new Error("Ce format n’est pas pris en charge. Choisissez un logo PNG ou SVG.");
  }
  const parsed = new DOMParser().parseFromString(await file.text(), "image/svg+xml");
  const svg = parsed.documentElement;
  if (parsed.querySelector("parsererror") || !(svg instanceof SVGSVGElement) || svg.namespaceURI !== SVG_NAMESPACE) {
    throw new Error(INVALID_SVG);
  }

  const viewBox = svg.viewBox.baseVal;
  const hasViewBox = svg.hasAttribute("viewBox");
  if (hasViewBox && ![viewBox.x, viewBox.y, viewBox.width, viewBox.height].every(Number.isFinite)) throw new Error(INVALID_SVG);
  if (hasViewBox && (viewBox.width <= 0 || viewBox.height <= 0)) throw new Error(INVALID_SVG);
  const ratio = hasViewBox ? viewBox.width / viewBox.height : undefined;
  const originalWidth = absoluteLength(svg.width);
  const originalHeight = absoluteLength(svg.height);
  const width = originalWidth ?? (originalHeight && ratio ? originalHeight * ratio : hasViewBox ? viewBox.width : 300);
  const height = originalHeight ?? (originalWidth && ratio ? originalWidth / ratio : hasViewBox ? viewBox.height : 150);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error(INVALID_SVG);

  // Bound the SVG viewport before native decoding while retaining vector detail.
  if (!hasViewBox) svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const scale = 2560 / Math.max(width, height);
  svg.setAttribute("width", String(Math.max(1, Math.round(width * scale))));
  svg.setAttribute("height", String(Math.max(1, Math.round(height * scale))));

  // This detached XML is decoded only in Image context, never inserted into HTML.
  // SVG image mode disables scripts/external resources; only the rasterized PNG survives.
  const imageFile = new File([new XMLSerializer().serializeToString(svg)], file.name, { type: "image/svg+xml" });
  return normalizePosterImage(imageFile);
}
