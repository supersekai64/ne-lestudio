import logo from "./brand-logo-paths.json";
import type { PaletteDefinition } from "./studio-types";

let paths: { role: string; path: Path2D }[] | undefined;

/** The official SVG paths stay vector shapes until the final canvas paint. */
export function drawBrandLogo(ctx: CanvasRenderingContext2D, x: number, y: number, wide: boolean, palette: PaletteDefinition) {
  paths ??= logo.paths.map(({ role, d }) => ({ role, path: new Path2D(d) }));
  const frameWidth = wide ? 130 : 172;
  const frameHeight = wide ? 112 : 149;
  const scale = Math.min(frameWidth / logo.width, frameHeight / logo.height);
  ctx.save();
  ctx.translate(x + (frameWidth - logo.width * scale) / 2, y + (frameHeight - logo.height * scale) / 2);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.rect(0, 0, logo.width, logo.height);
  ctx.clip();
  for (const { role, path } of paths) {
    ctx.fillStyle = role === "detail" ? palette.accent : palette.id === "olive" ? "#FFFFFF" : palette.foreground;
    ctx.fill(path);
  }
  ctx.restore();
}
