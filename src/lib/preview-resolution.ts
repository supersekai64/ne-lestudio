export type PreviewResolution = { pixelWidth: number; pixelHeight: number };

const MAX_PREVIEW_PIXELS = 16_000_000;

/** Preview pixels belong to the screen; export pixels belong to the format. */
export function previewResolution(width: number, height: number, pixelRatio: number): PreviewResolution | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const density = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  const scale = Math.min(density, Math.sqrt(MAX_PREVIEW_PIXELS / width / height));
  let pixelWidth = Math.max(1, Math.round(width * scale));
  let pixelHeight = Math.max(1, Math.round(height * scale));
  if (!Number.isFinite(pixelWidth) || !Number.isFinite(pixelHeight)) return null;
  // Rounding up either edge must not exceed the bitmap memory budget.
  if (pixelWidth * pixelHeight > MAX_PREVIEW_PIXELS) {
    const correction = Math.sqrt(MAX_PREVIEW_PIXELS / pixelWidth / pixelHeight);
    pixelWidth = Math.max(1, Math.min(MAX_PREVIEW_PIXELS, Math.floor(pixelWidth * correction)));
    pixelHeight = Math.max(1, Math.min(Math.floor(pixelHeight * correction), Math.floor(MAX_PREVIEW_PIXELS / pixelWidth)));
  }
  return { pixelWidth, pixelHeight };
}
