"use client";

import type { PosterImage } from "@/lib/studio-types";

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
export const IMAGE_IMPORT_HELP = "JPG, PNG ou WebP · 10 Mo maximum.";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 40_000_000;
const MAX_LONG_EDGE = 2560;

const CORRUPT_IMAGE = "Cette image est endommagée ou illisible. Choisissez une autre image.";
const NORMALIZATION_FAILED = "Le navigateur n’a pas pu préparer cette image. Essayez une autre image.";
const DIMENSIONS_TOO_LARGE = "Cette image dépasse 40 millions de pixels. Réduisez ses dimensions avant de l’ajouter.";

type Dimensions = { width: number; height: number };

function fourCC(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + 4));
}

function jpegDimensions(bytes: Uint8Array, view: DataView): Dimensions | null {
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === undefined || marker === 0 || marker === 0xda || marker === 0xd9) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return null;
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > bytes.length) return null;
    const isFrame = marker >= 0xc0 && marker <= 0xcf &&
      marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      if (length < 8) return null;
      const components = bytes[offset + 7];
      if (components < 1 || length !== 8 + components * 3) return null;
      return { width: view.getUint16(offset + 5), height: view.getUint16(offset + 3) };
    }
    offset += length;
  }
  return null;
}

function webpBitstreamDimensions(
  bytes: Uint8Array, view: DataView, kind: string, start: number, length: number,
): Dimensions | null {
  if (kind === "VP8 ") {
    if (length < 10 || (bytes[start] & 1) !== 0 || bytes[start + 3] !== 0x9d ||
      bytes[start + 4] !== 0x01 || bytes[start + 5] !== 0x2a) return null;
    return {
      width: view.getUint16(start + 6, true) & 0x3fff,
      height: view.getUint16(start + 8, true) & 0x3fff,
    };
  }
  if (kind === "VP8L") {
    if (length < 5 || bytes[start] !== 0x2f) return null;
    const bits = view.getUint32(start + 1, true);
    if ((bits >>> 29) !== 0) return null;
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  return null;
}

function sameDimensions(a: Dimensions, b: Dimensions): boolean {
  return a.width === b.width && a.height === b.height;
}

function webpFrameDimensions(bytes: Uint8Array, view: DataView, start: number, end: number): Dimensions | null {
  let result: Dimensions | null = null;
  let offset = start;
  while (offset + 8 <= end) {
    const kind = fourCC(bytes, offset);
    const length = view.getUint32(offset + 4, true);
    const dataStart = offset + 8;
    const next = dataStart + length + (length % 2);
    if (next > end) return null;
    if (kind === "VP8 " || kind === "VP8L") {
      if (result) return null;
      result = webpBitstreamDimensions(bytes, view, kind, dataStart, length);
      if (!result) return null;
    }
    offset = next;
  }
  return offset === end ? result : null;
}

function webpDimensions(bytes: Uint8Array, view: DataView): Dimensions | null {
  if (bytes.length < 20) return null;
  const end = view.getUint32(4, true) + 8;
  if (end > bytes.length || end < 20) return null;
  const read24 = (offset: number) => bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65536;
  let canvas: Dimensions | null = null;
  let still: Dimensions | null = null;
  let hasFrames = false;
  let offset = 12;
  while (offset + 8 <= end) {
    const kind = fourCC(bytes, offset);
    const length = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const next = start + length + (length % 2);
    if (next > end) return null;
    if (kind === "VP8X") {
      if (canvas || length < 10) return null;
      canvas = { width: read24(start + 4) + 1, height: read24(start + 7) + 1 };
    } else if (kind === "VP8 " || kind === "VP8L") {
      if (still || hasFrames) return null;
      still = webpBitstreamDimensions(bytes, view, kind, start, length);
      if (!still) return null;
    } else if (kind === "ANMF") {
      if (!canvas || still || length < 16) return null;
      const frame = { width: read24(start + 6) + 1, height: read24(start + 9) + 1 };
      const raster = webpFrameDimensions(bytes, view, start + 16, start + length);
      if (!raster || !sameDimensions(frame, raster) ||
        read24(start) * 2 + frame.width > canvas.width ||
        read24(start + 3) * 2 + frame.height > canvas.height) return null;
      hasFrames = true;
    }
    offset = next;
  }
  if (offset !== end || (!still && !hasFrames)) return null;
  if (canvas && still && !sameDimensions(canvas, still)) return null;
  return canvas ?? still;
}

/** Header-only guard; native decoding still verifies the complete raster. */
export function readImageDimensions(bytes: Uint8Array): Dimensions | null {
  if (!hasSupportedSignature(bytes)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let result: Dimensions | null;
  // PNG IHDR: https://www.w3.org/TR/png-3/#11IHDR
  if (bytes[0] === 0x89) {
    if (bytes.length < 33 || view.getUint32(8) !== 13 || fourCC(bytes, 12) !== "IHDR") return null;
    result = { width: view.getUint32(16), height: view.getUint32(20) };
  } else if (bytes[0] === 0xff) {
    // JPEG SOFn: https://www.w3.org/Graphics/JPEG/itu-t81.pdf (B.2.2).
    result = jpegDimensions(bytes, view);
  } else {
    // https://developers.google.com/speed/webp/docs/riff_container
    // https://developers.google.com/speed/webp/docs/webp_lossless_bitstream_specification
    result = webpDimensions(bytes, view);
  }
  if (!result || result.width < 1 || result.height < 1) return null;
  return result;
}

function hasSupportedSignature(bytes: Uint8Array): boolean {
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    .every((byte, index) => bytes[index] === byte);
  const webp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  return jpeg || png || webp;
}

function pngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob && blob.size > 0) resolve(blob);
        else reject(new Error(NORMALIZATION_FAILED));
      }, "image/png");
    } catch {
      reject(new Error(NORMALIZATION_FAILED));
    }
  });
}

/**
 * Decode and re-encode locally, keeping native orientation and transparency.
 * The caller owns the returned object URL and must revoke it when discarded.
 */
export async function importPosterImage(file: File): Promise<PosterImage> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Cette image dépasse 10 Mo. Choisissez une image plus légère.");
  }
  if (file.size === 0) {
    throw new Error("Ce fichier est vide. Choisissez une autre image.");
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    throw new Error("Le fichier n’a pas pu être lu. Sélectionnez-le à nouveau.");
  }
  if (!hasSupportedSignature(bytes)) {
    const claimsSupportedFormat = /^(image\/jpeg|image\/png|image\/webp)$/i.test(file.type) ||
      /\.(jpe?g|png|webp)$/i.test(file.name);
    throw new Error(claimsSupportedFormat
      ? CORRUPT_IMAGE
      : "Ce format n’est pas pris en charge. Choisissez une image JPG, PNG ou WebP.");
  }

  const encoded = readImageDimensions(bytes);
  if (!encoded) throw new Error(CORRUPT_IMAGE);
  if (encoded.width * encoded.height > MAX_SOURCE_PIXELS) {
    throw new Error(DIMENSIONS_TOO_LARGE);
  }

  if (typeof document === "undefined" || typeof Image === "undefined" ||
    typeof URL.createObjectURL !== "function") {
    throw new Error("L’import d’images est disponible dans votre navigateur.");
  }

  const name = file.name.trim() || "Image personnelle";
  let sourceUrl: string;
  try {
    sourceUrl = URL.createObjectURL(file);
  } catch {
    throw new Error(NORMALIZATION_FAILED);
  }
  let canvas: HTMLCanvasElement | null = null;
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = sourceUrl;
    try {
      await image.decode();
    } catch {
      throw new Error(CORRUPT_IMAGE);
    }

    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    if (!Number.isInteger(sourceWidth) || !Number.isInteger(sourceHeight) ||
      sourceWidth < 1 || sourceHeight < 1) {
      throw new Error(CORRUPT_IMAGE);
    }
    if (sourceWidth * sourceHeight > MAX_SOURCE_PIXELS) {
      throw new Error(DIMENSIONS_TOO_LARGE);
    }

    const scale = Math.min(1, MAX_LONG_EDGE / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    try {
      canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error(NORMALIZATION_FAILED);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, width, height);
      const blob = await pngBlob(canvas);
      return { src: URL.createObjectURL(blob), name, width, height };
    } catch {
      throw new Error(NORMALIZATION_FAILED);
    }
  } finally {
    URL.revokeObjectURL(sourceUrl);
    if (canvas) {
      // Release the normalization bitmap after the PNG has been encoded.
      canvas.width = 1;
      canvas.height = 1;
    }
  }
}
