import { describePoster, formatEventDate, FORMATS, PALETTES, POSTER_WEBSITE_URL, TEMPLATES } from "./catalog";
import type { PaletteDefinition, PosterConfig, RenderResult } from "./studio-types";
import type { PreviewResolution } from "./preview-resolution";

const BODY_FONT = '"Tubqal Pro", Arial, sans-serif';
const DISPLAY_FONT = '"Tango Sans", Arial, sans-serif';
const imageCache = new Map<string, Promise<HTMLImageElement>>();
const renderVersions = new WeakMap<HTMLCanvasElement, number>();
let fontPromise: Promise<void> | undefined;

type Box = { x: number; y: number; width: number; height: number };
type TextOptions = {
  maxSize: number;
  minSize?: number;
  weight?: number;
  color?: string;
  lineHeight?: number;
  align?: "left" | "center" | "right";
  vertical?: "top" | "center";
  family?: "body" | "display";
};

function graphemes(text: string): string[] {
  if (typeof Intl.Segmenter !== "undefined") {
    return Array.from(new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(text), (part) => part.segment);
  }
  return Array.from(text);
}

/** Wrapping uses actual font metrics; unbroken words and emoji remain measurable. */
export function wrapPosterText(text: string, width: number, measure: (value: string) => number): string[] {
  if (!text) return [];
  const output: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
    const words = paragraph.trim().split(/\s+/u).filter(Boolean);
    if (!words.length) { output.push(""); continue; }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (measure(candidate) <= width) { current = candidate; continue; }
      if (current) { output.push(current); current = ""; }
      if (measure(word) <= width) { current = word; continue; }
      for (const glyph of graphemes(word)) {
        if (current && measure(current + glyph) > width) { output.push(current); current = ""; }
        current += glyph;
      }
    }
    if (current) output.push(current);
  }
  return output;
}

function setFont(ctx: CanvasRenderingContext2D, size: number, weight = 700, family: "body" | "display" = "body") {
  // The regular Tango face keeps titles and large numbers legible at preview size.
  const actualWeight = family === "display" ? 400 : weight;
  ctx.font = `${actualWeight} ${size}px ${family === "display" ? DISPLAY_FONT : BODY_FONT}`;
}

function textLayout(ctx: CanvasRenderingContext2D, lines: string[], size: number, lineHeight: number) {
  const previousBaseline = ctx.textBaseline;
  ctx.textBaseline = "top";
  let topInset = 0;
  let descent = 0;
  for (const text of lines) {
    const metrics = ctx.measureText(text);
    topInset = Math.max(topInset, Number.isFinite(metrics.actualBoundingBoxAscent) ? metrics.actualBoundingBoxAscent : 0);
    descent = Math.max(descent, Number.isFinite(metrics.actualBoundingBoxDescent) ? metrics.actualBoundingBoxDescent : size);
  }
  ctx.textBaseline = previousBaseline;
  const lineStep = Math.max(size * lineHeight, topInset + descent);
  return { topInset, lineStep, height: topInset + Math.max(0, lines.length - 1) * lineStep + descent };
}

function drawFittedText(ctx: CanvasRenderingContext2D, text: string, box: Box, options: TextOptions): boolean {
  if (!text.trim()) return true;
  const minSize = Math.ceil(options.minSize ?? 24);
  const maxSize = Math.max(minSize, Math.floor(options.maxSize));
  const lineHeight = options.lineHeight ?? 1.09;
  const weight = options.weight ?? 700;
  const family = options.family ?? (options.maxSize >= 45 ? "display" : "body");
  const content = text.slice(0, 5000);
  setFont(ctx, minSize, weight, family);
  // A word that fits at the minimum size should stay whole. Only genuinely
  // overlong tokens are allowed to split across glyphs (URLs, long pasted text).
  const wholeWords = content.split(/\s+/u).filter((word) => word && ctx.measureText(word).width <= box.width);
  let chosen = minSize;
  let finalLines: string[] = [];
  let finalLayout = { topInset: 0, lineStep: minSize * lineHeight, height: 0 };
  let fits = false;
  let low = minSize;
  let high = maxSize;
  while (low <= high) {
    const size = Math.floor((low + high) / 2);
    setFont(ctx, size, weight, family);
    const lines = wrapPosterText(content, box.width, (value) => ctx.measureText(value).width);
    const layout = textLayout(ctx, lines, size, lineHeight);
    const within = layout.height <= box.height
      && wholeWords.every((word) => ctx.measureText(word).width <= box.width)
      && lines.every((line) => ctx.measureText(line).width <= box.width);
    if (within) { chosen = size; finalLines = lines; finalLayout = layout; fits = true; low = size + 1; }
    else high = size - 1;
  }
  // Invalid content is never drawn across another field or the provenance footer.
  // The caller disables export while the user corrects it.
  if (!fits) {
    chosen = Math.min(minSize, 24);
    setFont(ctx, chosen, 500, "body");
    finalLines = wrapPosterText("Texte trop long. Raccourcissez votre message.", box.width, (value) => ctx.measureText(value).width);
    finalLayout = textLayout(ctx, finalLines, chosen, lineHeight);
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.width, box.height);
  ctx.clip();
  setFont(ctx, chosen, fits ? weight : 500, fits ? family : "body");
  ctx.fillStyle = options.color ?? "#032F67";
  ctx.textAlign = options.align ?? "left";
  ctx.textBaseline = "top";
  const x = options.align === "center" ? box.x + box.width / 2 : options.align === "right" ? box.x + box.width : box.x;
  const y = box.y + finalLayout.topInset + (options.vertical === "center" ? Math.max(0, (box.height - finalLayout.height) / 2) : 0);
  finalLines.forEach((line, index) => ctx.fillText(line, x, y + index * finalLayout.lineStep));
  ctx.restore();
  return fits;
}

function roundedPath(ctx: CanvasRenderingContext2D, box: Box, radius: number) {
  const r = Math.max(0, Math.min(radius, box.width / 2, box.height / 2));
  const { x, y, width: w, height: h } = box;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function panel(ctx: CanvasRenderingContext2D, box: Box, color: string, radius = 20) {
  ctx.save();
  roundedPath(ctx, box, radius);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size = 16) {
  ctx.save();
  setFont(ctx, size, 700);
  ctx.fillStyle = color;
  ctx.textBaseline = "top";
  const metrics = ctx.measureText(text);
  const topInset = Number.isFinite(metrics.actualBoundingBoxAscent) ? Math.max(0, metrics.actualBoundingBoxAscent) : 0;
  ctx.fillText(text, x, y + topInset);
  ctx.restore();
}

function line(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, color: string, opacity = 1, thickness = 2) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, thickness);
  ctx.restore();
}

function drawBrand(ctx: CanvasRenderingContext2D, image: HTMLImageElement | undefined, x: number, y: number, wide: boolean) {
  if (!image) return;
  const frameWidth = wide ? 130 : 172;
  const frameHeight = wide ? 112 : 149;
  const scale = Math.min(frameWidth / image.naturalWidth, frameHeight / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  ctx.save();
  ctx.drawImage(image, x + (frameWidth - width) / 2, y + (frameHeight - height) / 2, width, height);
  ctx.restore();
}

function background(ctx: CanvasRenderingContext2D, width: number, height: number, palette: PaletteDefinition, bold: boolean, texture: HTMLImageElement | undefined) {
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, width, height);
  if (!texture) return;
  ctx.save();
  ctx.globalAlpha = palette.id === "olive" && bold ? 0.06 : bold ? 0.13 : 0.12;
  // Copy the original texture at its native proportions, with a deliberate edge crop.
  const textureWidth = width * (bold ? 0.84 : 1.06);
  const textureHeight = textureWidth * texture.naturalHeight / texture.naturalWidth;
  ctx.drawImage(texture, width - textureWidth * 0.65, (height - textureHeight) * 0.45, textureWidth, textureHeight);
  ctx.restore();
}

function drawFooter(ctx: CanvasRenderingContext2D, width: number, height: number, pad: number, palette: PaletteDefinition) {
  const y = height - (height / width > 1.6 ? 210 : width > height ? 52 : 65);
  line(ctx, pad, y - 23, width - 2 * pad, palette.foreground, 0.3, 1);
  label(ctx, POSTER_WEBSITE_URL, pad, y, palette.foreground, height / width > 1.6 ? 34 : 30);
}

function waitForFonts(): Promise<void> {
  if (!fontPromise) {
    fontPromise = typeof document !== "undefined" && document.fonts
      ? Promise.all([
        ...[400, 500, 700, 800].map((weight) => document.fonts.load(`${weight} 48px "Tubqal Pro"`)),
        document.fonts.load('400 48px "Tango Sans"'),
      ]).then((fonts) => {
        if (fonts.some((loaded) => loaded.length === 0)) throw new Error("Police indisponible");
      }).catch((error: unknown) => { fontPromise = undefined; throw error; })
      : Promise.resolve();
  }
  return fontPromise;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const cacheable = src.startsWith("/brand/") || src.startsWith("/assets/");
  if (!cacheable && !src.startsWith("blob:")) return Promise.reject(new Error("Source d’image non prise en charge"));
  const existing = cacheable ? imageCache.get(src) : undefined;
  if (existing) return existing;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      image.onload = null;
      image.onerror = null;
      if (image.naturalWidth > 0 && image.naturalHeight > 0) resolve(image);
      else { if (cacheable) imageCache.delete(src); reject(new Error("Image indisponible")); }
    };
    image.onerror = () => {
      image.onload = null;
      image.onerror = null;
      if (cacheable) imageCache.delete(src);
      reject(new Error("Image indisponible"));
    };
    image.src = src;
  });
  // Imported object URLs belong to the editor: retaining their decoded images
  // here would prevent collection after replacement or revocation.
  if (cacheable) imageCache.set(src, promise);
  return promise;
}

function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement | undefined, box: Box) {
  ctx.save();
  roundedPath(ctx, box, 20);
  ctx.clip();
  if (image) {
    const scale = Math.max(box.width / image.naturalWidth, box.height / image.naturalHeight);
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
    ctx.drawImage(image, box.x + (box.width - w) / 2, box.y + (box.height - h) / 2, w, h);
  } else {
    ctx.fillStyle = "#EFEFEB";
    ctx.fillRect(box.x, box.y, box.width, box.height);
  }
  ctx.restore();
}

function drawImagePlaceholder(ctx: CanvasRenderingContext2D, box: Box) {
  drawFittedText(ctx, "Ajoutez votre image", { x: box.x + 24, y: box.y, width: Math.max(1, box.width - 48), height: box.height }, {
    maxSize: 46, minSize: 28, weight: 500, color: "#032F67", align: "center", vertical: "center", family: "body",
  });
}

export async function renderPoster(canvas: HTMLCanvasElement, config: PosterConfig, resolution?: PreviewResolution): Promise<RenderResult> {
  const version = (renderVersions.get(canvas) ?? 0) + 1;
  renderVersions.set(canvas, version);
  const format = FORMATS.find((entry) => entry.id === config.formatId) ?? FORMATS[0];
  const template = TEMPLATES.find((entry) => entry.id === config.templateId) ?? TEMPLATES[0];
  const palette = PALETTES.find((entry) => entry.id === config.paletteId) ?? PALETTES[0];
  const errors: string[] = [];
  const value = (key: string) => typeof config.values[key] === "string" ? config.values[key].replaceAll("\0", "").trim() : "";
  for (const field of template.fields) {
    const content = value(field.key);
    const limit = field.maxLength;
    if (field.required && !content) errors.push(`Renseignez le champ « ${field.label} ».`);
    if (Array.from(content).length > limit) errors.push(`Le champ « ${field.label} » est limité à ${limit} caractères.`);
  }
  if (config.templateId === "event") {
    if (value("date") && formatEventDate(value("date")) === "Date à préciser") errors.push("Choisissez une date valide.");
    if (value("time") && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value("time"))) errors.push("Choisissez une heure valide.");
  }
  await waitForFonts();
  const logoPath = palette.id === "cream" ? "/brand/logo-blanc-bleu.png" : palette.id === "olive" ? "/brand/logo-full-blanc.png" : "/brand/logo-official.png";
  const textureFamily = config.variant === "bold" ? (config.templateId === "headline" || config.templateId === "type" ? "kick" : "bold") : "fine";
  const textureColor = palette.id === "cream" ? "bleu" : palette.id === "olive" && textureFamily !== "bold" ? "blanc" : "kaki";
  // The source kit has no white diagonal texture: use its unchanged blue variant on kaki.
  const texturePath = `/brand/texture-${textureFamily}-${palette.id === "olive" && textureFamily === "bold" ? "bleu" : textureColor}.png`;
  const brandResources = await Promise.allSettled([loadImage(logoPath), loadImage(texturePath)]);
  const logo = brandResources[0].status === "fulfilled" ? brandResources[0].value : undefined;
  const texture = brandResources[1].status === "fulfilled" ? brandResources[1].value : undefined;
  if (!logo || !texture) errors.push("Une ressource de la charte n’a pas pu être chargée. Réessayez dans un instant.");
  let photo: HTMLImageElement | undefined;
  if (template.photo) {
    if (!config.image?.src) errors.unshift("Ajoutez votre image pour créer ce visuel.");
    else {
      try { photo = await loadImage(config.image.src); }
      catch { errors.unshift("Votre image n’a pas pu être chargée. Importez-la à nouveau."); }
    }
  }
  const altText = describePoster(config);
  if (renderVersions.get(canvas) !== version) return { fits: !errors.length, ...(errors.length ? { error: errors[0] } : {}), altText };
  canvas.width = resolution?.pixelWidth ?? format.width;
  canvas.height = resolution?.pixelHeight ?? format.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { fits: false, error: "Votre navigateur ne permet pas de créer ce visuel.", altText };
  // Draw text and shapes at the screen's actual density instead of scaling an
  // export bitmap in CSS. Layout and font fitting keep their format coordinates.
  ctx.setTransform(canvas.width / format.width, 0, 0, canvas.height / format.height, 0, 0);
  if (resolution) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  }
  const w = format.width;
  const h = format.height;
  const wide = w > h;
  const story = config.formatId === "story";
  const pad = wide ? 72 : 82;
  const logoY = story ? 165 : wide ? 35 : 54;
  const contentTop = template.photo ? logoY + (wide ? 112 : 149) + (wide ? 38 : 56) : story ? 330 : wide ? 165 : 225;
  const body: Box = { x: pad, y: contentTop, width: w - 2 * pad, height: h - contentTop - (story ? 290 : wide ? 115 : 140) };
  const bold = config.variant === "bold";
  background(ctx, w, h, palette, bold, texture);
  drawBrand(ctx, logo, pad, logoY, wide);
  const drawText = (key: string, text: string, box: Box, options: TextOptions) => {
    const fits = drawFittedText(ctx, text, box, { color: palette.foreground, ...options });
    if (!fits) errors.push(`Le champ « ${key} » ne tient pas dans ce format. Raccourcissez le texte ou réduisez les retours à la ligne.`);
  };
  const title = value("title");
  const subtitle = value("subtitle");

  if (config.templateId === "headline") {
    label(ctx, "UNE IDÉE À PARTAGER", body.x, body.y + (wide ? -8 : 8), palette.foreground, wide ? 28 : 32);
    const titleBox = { x: body.x, y: body.y + body.height * 0.1, width: body.width, height: body.height * 0.6 };
    if (bold) {
      line(ctx, body.x, body.y + body.height * 0.08, 95, palette.accent, 1, 10);
      drawText("Votre message", title.toLocaleUpperCase("fr-FR"), titleBox, { maxSize: wide ? 83 : config.formatId === "story" ? 124 : 102, minSize: wide ? 28 : 34, lineHeight: 1.02, weight: 800, vertical: "center" });
    } else {
      drawText("Votre message", title, titleBox, { maxSize: wide ? 84 : config.formatId === "story" ? 122 : 106, minSize: wide ? 28 : 34, lineHeight: 1.06, vertical: "center" });
    }
    line(ctx, body.x, body.y + body.height * 0.76, 76, palette.accent, 1, 6);
    drawText("Une précision", subtitle, { x: body.x, y: body.y + body.height * 0.79, width: body.width * 0.94, height: body.height * 0.2 }, { maxSize: story ? 48 : wide ? 38 : 44, minSize: wide ? 24 : 28, lineHeight: 1.2, weight: 400, family: "body" });
  }

  if (config.templateId === "type") {
    const x = bold ? body.x + 31 : body.x;
    if (bold) panel(ctx, { x: body.x, y: body.y + 6, width: 9, height: body.height * 0.85 }, palette.accent, 4);
    const content = bold ? title.toLocaleUpperCase("fr-FR") : title;
    drawText("Votre message", content, { x, y: body.y + 10, width: body.width - (bold ? 31 : 0), height: body.height * 0.76 }, { maxSize: wide ? 113 : config.formatId === "story" ? 170 : 145, minSize: wide ? 29 : 36, weight: 800, lineHeight: 1.0, vertical: "center" });
    line(ctx, x, body.y + body.height * 0.82, body.width - (bold ? 31 : 0), palette.foreground, 0.3, 1);
    drawText("Une précision", subtitle, { x, y: body.y + body.height * 0.84, width: body.width - (bold ? 31 : 0), height: body.height * (wide ? 0.18 : 0.16) }, { maxSize: story ? 48 : wide ? 38 : 44, minSize: wide ? 22 : 26, weight: 400, lineHeight: 1.15, family: "body" });
  }

  if (config.templateId === "quote") {
    const citation = (config.values.title ?? "").replaceAll("\0", "");
    const author = subtitle;
    const hasAuthor = author.length > 0;
    const markSize = wide ? 142 : 225;
    ctx.save();
    setFont(ctx, markSize, 700, "display");
    ctx.textBaseline = "top";
    ctx.fillStyle = palette.accent;
    ctx.fillText("“", body.x - 7, body.y + (wide ? 4 : 8));
    ctx.restore();
    // Keep the original citation area while making room for the larger author text.
    const textY = body.y + (wide ? 64 : hasAuthor ? 76 : 120);
    const authorHeight = wide ? 88 : 144;
    const authorY = body.y + body.height - authorHeight;
    const citationBottom = hasAuthor ? authorY - (wide ? 18 : 28) : body.y + body.height - 20;
    drawText("Citation", citation, { x: body.x, y: textY, width: body.width, height: Math.max(80, citationBottom - textY) }, { maxSize: wide ? 60 : config.formatId === "story" ? 106 : 84, minSize: wide ? 24 : 28, weight: bold ? 700 : 400, lineHeight: 1.12, vertical: "center", family: "display" });
    if (hasAuthor) {
      line(ctx, body.x, authorY, 64, palette.accent, 1, 4);
      drawText("Auteur", author, { x: body.x, y: authorY + 21, width: body.width, height: authorHeight - 21 }, { maxSize: story ? 46 : wide ? 34 : 42, minSize: wide ? 24 : 28, weight: 700, lineHeight: 1.15, family: "body" });
    }
  }

  if (config.templateId === "event") {
    const panelBox: Box = wide
      ? { x: body.x + body.width * 0.57, y: body.y, width: body.width * 0.43, height: body.height }
      : { x: body.x, y: body.y + body.height - Math.min(520, body.height * 0.4), width: body.width, height: Math.min(520, body.height * 0.4) };
    const leftWidth = wide ? body.width * 0.52 : body.width;
    const textHeight = wide ? body.height : panelBox.y - body.y - 35;
    label(ctx, "UN RENDEZ-VOUS À PARTAGER", body.x, body.y + (wide ? 3 : -2), palette.foreground, wide ? 26 : 30);
    drawText("Nom de l’événement", bold ? title.toLocaleUpperCase("fr-FR") : title, { x: body.x, y: body.y + 39, width: leftWidth, height: textHeight * 0.66 - 20 }, { maxSize: wide ? 73 : 98, minSize: wide ? 28 : 34, lineHeight: 1.02, weight: 800, vertical: "center" });
    drawText("Une précision", subtitle, { x: body.x, y: body.y + textHeight * 0.73, width: leftWidth, height: textHeight * 0.25 }, { maxSize: story ? 46 : wide ? 36 : 42, minSize: wide ? 20 : 26, weight: 400, lineHeight: 1.15, family: "body" });
    panel(ctx, panelBox, palette.accent, bold ? 5 : 22);
    const inner = wide ? 28 : 34;
    const panelColor = "#032F67";
    label(ctx, "RENDEZ-VOUS", panelBox.x + inner, panelBox.y + inner, panelColor, wide ? 24 : 28);
    const compactDetails = config.formatId === "square";
    const dateWidth = panelBox.width - 2 * inner - (compactDetails ? 244 : 0);
    drawText("Date", formatEventDate(value("date")), { x: panelBox.x + inner, y: panelBox.y + inner + 36, width: dateWidth, height: panelBox.height * 0.24 }, { maxSize: wide ? 48 : 56, minSize: wide ? 26 : 30, color: panelColor, lineHeight: 1.09, family: "body" });
    const time = value("time").replace(":", " h ");
    drawText("Heure", time, { x: compactDetails ? panelBox.x + panelBox.width - inner - 220 : panelBox.x + inner, y: compactDetails ? panelBox.y + inner + 36 : panelBox.y + panelBox.height * 0.44, width: compactDetails ? 220 : panelBox.width - 2 * inner, height: panelBox.height * (compactDetails ? 0.24 : 0.16) }, { maxSize: wide ? 48 : 56, minSize: 30, color: panelColor, family: "body" });
    line(ctx, panelBox.x + inner, panelBox.y + panelBox.height * (compactDetails ? 0.5 : wide ? 0.58 : 0.62), panelBox.width - 2 * inner, panelColor, 0.25, 1);
    drawText("Lieu", value("location"), { x: panelBox.x + inner, y: panelBox.y + panelBox.height * (compactDetails ? 0.54 : wide ? 0.62 : 0.66), width: panelBox.width - 2 * inner, height: panelBox.height * (compactDetails ? 0.42 : wide ? 0.34 : 0.28) }, { maxSize: story ? 46 : wide ? 38 : 44, minSize: wide ? 20 : 26, color: panelColor, lineHeight: 1.16, weight: 500, family: "body" });
  }

  if (config.templateId === "photo") {
    if (bold) {
      drawCover(ctx, photo, body);
      ctx.save();
      roundedPath(ctx, body, 20);
      ctx.clip();
      const shade = ctx.createLinearGradient(0, body.y, 0, body.y + body.height);
      shade.addColorStop(0, "rgba(8, 25, 34, .18)");
      shade.addColorStop(0.34, "rgba(8, 25, 34, .65)");
      shade.addColorStop(0.6, "rgba(8, 25, 34, .88)");
      shade.addColorStop(1, "rgba(8, 25, 34, .97)");
      ctx.fillStyle = shade;
      ctx.fillRect(body.x, body.y, body.width, body.height);
      ctx.restore();
      if (!photo) drawImagePlaceholder(ctx, { x: body.x, y: body.y + body.height * 0.08, width: body.width, height: body.height * 0.22 });
      const inset = 34;
      drawText("Votre message", title, { x: body.x + inset, y: body.y + body.height * (wide ? 0.34 : 0.39), width: body.width - 2 * inset, height: body.height * 0.4 }, { maxSize: wide ? 81 : 95, minSize: wide ? 27 : 33, color: "#FFFFFF", lineHeight: 1.05, vertical: "center", weight: 800 });
      drawText("Une précision", subtitle, { x: body.x + inset, y: body.y + body.height * (wide ? 0.78 : 0.8), width: body.width - 2 * inset, height: body.height * (wide ? 0.21 : 0.18) }, { maxSize: story ? 48 : wide ? 36 : 44, minSize: wide ? 24 : 28, color: "#FFFFFF", weight: 400, lineHeight: 1.12, family: "body" });
    } else {
      const imageBox: Box = wide
        ? { x: body.x + body.width * 0.49, y: body.y, width: body.width * 0.51, height: body.height }
        : { x: body.x, y: body.y, width: body.width, height: body.height * (config.formatId === "story" ? 0.54 : 0.47) };
      drawCover(ctx, photo, imageBox);
      if (!photo) drawImagePlaceholder(ctx, imageBox);
      const titleBox: Box = wide
        ? { x: body.x, y: body.y + 10, width: body.width * 0.43, height: body.height * 0.6 }
        : { x: body.x, y: imageBox.y + imageBox.height + 29, width: body.width, height: (body.height - imageBox.height - 29) * 0.6 };
      drawText("Votre message", title, titleBox, { maxSize: wide ? 71 : 85, minSize: wide ? 26 : 33, lineHeight: 1.05, vertical: "center", weight: 800 });
      const subtitleBox: Box = wide
        ? { x: body.x, y: body.y + body.height * 0.66, width: body.width * 0.43, height: body.height * 0.34 }
        : { x: body.x, y: titleBox.y + titleBox.height + 17, width: body.width, height: body.y + body.height - titleBox.y - titleBox.height - 17 };
      drawText("Une précision", subtitle, subtitleBox, { maxSize: story ? 48 : wide ? 36 : 44, minSize: wide ? 22 : 28, weight: 400, lineHeight: 1.14, family: "body" });
    }
  }

  if (config.templateId === "stat") {
    const numberColor = palette.id === "cream" || palette.id === "olive" ? palette.foreground : palette.accent;
    const sourceHeight = wide ? 95 : Math.max(130, Math.min(180, body.height * 0.18));
    const sourceBox = { x: body.x, y: body.y + body.height - sourceHeight, width: body.width, height: sourceHeight };
    label(ctx, "UN CHIFFRE, DU CONTEXTE", body.x, body.y + (wide ? -1 : 2), palette.foreground, wide ? 26 : 30);
    if (wide) {
      drawText("Votre chiffre", value("number"), { x: body.x, y: body.y + 38, width: body.width * 0.42, height: body.height - sourceHeight - 58 }, { maxSize: 185, minSize: 45, color: numberColor, lineHeight: 1.0, weight: 800, vertical: "center" });
      const rx = body.x + body.width * 0.48;
      drawText("Ce qu’il représente", title, { x: rx, y: body.y + 36, width: body.width * 0.52, height: body.height * 0.4 }, { maxSize: 56, minSize: 24, lineHeight: 1.04, weight: 800 });
      drawText("Le contexte", subtitle, { x: rx, y: body.y + body.height * 0.5, width: body.width * 0.52, height: body.height * 0.24 }, { maxSize: 34, minSize: 20, weight: 400, lineHeight: 1.15, family: "body" });
    } else {
      drawText("Votre chiffre", value("number"), { x: body.x, y: body.y + body.height * 0.06, width: body.width, height: body.height * 0.28 }, { maxSize: config.formatId === "story" ? 280 : 233, minSize: 55, color: numberColor, lineHeight: 1.0, weight: 800, vertical: "center" });
      drawText("Ce qu’il représente", bold ? title.toLocaleUpperCase("fr-FR") : title, { x: body.x, y: body.y + body.height * 0.4, width: body.width, height: body.height * 0.25 }, { maxSize: config.formatId === "story" ? 105 : 78, minSize: 31, lineHeight: 1.04, weight: 800, vertical: "center" });
      drawText("Le contexte", subtitle, { x: body.x, y: body.y + body.height * 0.69, width: body.width, height: body.height * 0.12 }, { maxSize: story ? 48 : 44, minSize: 26, weight: 400, lineHeight: 1.16, family: "body" });
    }
    panel(ctx, sourceBox, palette.accent, bold ? 5 : 16);
    label(ctx, "SOURCE", sourceBox.x + 22, sourceBox.y + 17, "#032F67", 24);
    drawText("La source", value("source"), { x: sourceBox.x + 130, y: sourceBox.y + 15, width: sourceBox.width - 152, height: sourceBox.height - 28 }, { maxSize: story ? 42 : wide ? 30 : 36, minSize: wide ? 20 : 24, color: "#032F67", weight: 500, lineHeight: 1.14, vertical: "center", family: "body" });
  }

  drawFooter(ctx, w, h, pad, palette);
  return { fits: errors.length === 0, ...(errors.length ? { error: errors[0] } : {}), altText };
}
