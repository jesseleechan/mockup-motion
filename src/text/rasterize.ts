import interUrl from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";

/** One line of Inter text to rasterize, such as the browser URL pill's domain. */
export interface TextLine {
  /** Stable key for the raster, used to hand rasters to the export worker. */
  id: string;
  text: string;
  /** Glyph size in % of the frame height. */
  size: number;
  /** Glyph colour, #RRGGBB. */
  color: string;
}

export interface TextRaster {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  /** Exact monochrome glyph colour; bitmap alpha is coverage. */
  color: string;
}

// The URL pill is set in Inter Regular with +2% tracking, at line height 1.3, padded by 0.2 em
// above and below and 0.4 em on each side (quality-bar §3.2).
const FAMILY = "Inter";
const WEIGHT = 400;
const TRACKING_EM = 0.02;
const LINE_HEIGHT = 1.3;
const MIN_SIZE_PERCENT = 1.6;

let interLoaded: Promise<void> | null = null;

/** Registers Inter under the family name "Inter" on first use; no stylesheet loads it. */
function loadInter(): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return Promise.resolve();
  interLoaded ??= (async () => {
    const face = new FontFace(FAMILY, `url(${interUrl})`, { weight: "100 900" });
    await face.load();
    document.fonts.add(face);
  })();
  return interLoaded;
}

const cache = new Map<string, TextRaster>();

function createCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context2d(
  canvas: OffscreenCanvas | HTMLCanvasElement,
): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  const context = canvas.getContext("2d") as
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!context) throw new Error("Text rasterization requires a 2D context");
  return context;
}

/** Rasterizes one centred line of Inter with Canvas 2D at the output resolution. */
export async function rasterizeText(line: TextLine, frameHeightPx: number): Promise<TextRaster> {
  const key = [line.text, line.size, line.color, frameHeightPx].join("::");
  const cached = cache.get(key);
  if (cached) return cached;
  const raster = await drawLine(line, frameHeightPx);
  cache.set(key, raster);
  return raster;
}

async function drawLine(line: TextLine, frameHeightPx: number): Promise<TextRaster> {
  await loadInter();

  const fontSizePx = (Math.max(MIN_SIZE_PERCENT, line.size) / 100) * frameHeightPx;
  const lineHeightPx = fontSizePx * LINE_HEIGHT;
  const font = `${WEIGHT} ${fontSizePx}px "${FAMILY}", sans-serif`;
  const text = line.text.trim();

  const measure = context2d(createCanvas(100, 100));
  measure.font = font;
  measure.letterSpacing = `${TRACKING_EM}em`;
  const textWidth = measure.measureText(text).width;

  const paddingY = Math.round(fontSizePx * 0.2);
  const paddingX = Math.round(fontSizePx * 0.4);
  const width = Math.max(16, Math.ceil(textWidth + paddingX * 2));
  const height = Math.max(16, Math.ceil(lineHeightPx + paddingY * 2));

  const canvas = createCanvas(width, height);
  const context = context2d(canvas);
  context.font = font;
  context.letterSpacing = `${TRACKING_EM}em`;
  context.fillStyle = line.color;
  context.textBaseline = "top";
  context.fillText(text, Math.round((width - textWidth) / 2), paddingY);

  const bitmap = await createImageBitmap(canvas, { premultiplyAlpha: "premultiply" });
  return { bitmap, width, height, color: line.color };
}
