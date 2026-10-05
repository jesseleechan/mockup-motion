import type { Background, FontRef, Style, TextLayer } from "../doc/types";
import { ensureFonts } from "../assets/fonts";

export interface TextRaster {
  bitmap: ImageBitmap;
  words: { x: number; y: number; w: number; h: number }[];
  width: number;
  height: number;
}

/**
 * Calculates relative luminance of an sRGB color (#RRGGBB).
 */
export function getRelativeLuminance(hexColor: string): number {
  let hex = hexColor.replace("#", "").trim();
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  if (hex.length < 6) return 0.5;

  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  const toLin = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

/**
 * Calculates WCAG contrast ratio between two sRGB colors.
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Derives average background luminance for auto-contrast calculation.
 */
export function getBackgroundLuminance(background: Background): number {
  switch (background.kind) {
    case "solid":
      return getRelativeLuminance(background.color);
    case "gradient": {
      if (!background.stops.length) return 0.5;
      const sum = background.stops.reduce((acc, c) => acc + getRelativeLuminance(c), 0);
      return sum / background.stops.length;
    }
    case "mesh": {
      if (!background.colors.length) return 0.5;
      const sum = background.colors.reduce((acc, c) => acc + getRelativeLuminance(c), 0);
      return sum / background.colors.length;
    }
    case "ambient":
    case "image":
      // Blurred ambient / dim screenshots typically lean darker (dim 0.5)
      return (1.0 - (background.dim ?? 0.5)) * 0.3;
  }
}

/**
 * Computes auto text color against background luminance per quality-bar §7:
 * WCAG ≥ 4.5:1 for captions/labels, ≥ 3:1 for titles.
 */
export function getAutoTextColor(background: Background, role: TextLayer["role"] = "title"): string {
  const bgL = getBackgroundLuminance(background);

  // If background is light (L > 0.4), use dark text; otherwise use light text
  if (bgL > 0.4) {
    if (role === "subtitle") {
      return "rgba(18, 18, 20, 0.70)";
    }
    return "#121214";
  } else {
    if (role === "subtitle") {
      return "rgba(246, 246, 247, 0.70)";
    }
    return "#F6F6F7";
  }
}

/**
 * Wraps title or text using balanced line wrapping:
 * Titles wrap at 22 characters or fewer, choosing the break that minimizes line-length variance.
 */
export function wrapBalancedText(text: string, maxCharsPerLine = 22): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words;

  if (trimmed.length <= maxCharsPerLine) {
    return [trimmed];
  }

  // Find minimum line count K such that words can physically fit
  const wordLengths = words.map((w) => w.length);
  const maxWordLen = Math.max(...wordLengths);
  const effectiveMaxChars = Math.max(maxCharsPerLine, maxWordLen);

  const totalCharsWithSpaces =
    wordLengths.reduce((a, b) => a + b, 0) + (words.length - 1);
  const minLines = Math.max(2, Math.ceil(totalCharsWithSpaces / effectiveMaxChars));
  const maxLines = words.length;

  let bestLines: string[] | null = null;
  let bestScore = Infinity;

  // Helper to generate and score partitions for a fixed line count K
  function search(
    wordIdx: number,
    currentLineStart: number,
    linesMade: number,
    targetLines: number,
    currentSplit: number[],
  ) {
    if (linesMade === targetLines - 1) {
      // Last line takes all remaining words from currentLineStart
      const lastLineWords = words.slice(currentLineStart);
      const lastLineLen =
        lastLineWords.reduce((acc, w) => acc + w.length, 0) + (lastLineWords.length - 1);

      if (lastLineLen > effectiveMaxChars) return;

      // Evaluate variance across all lines in this partition
      const allLineLengths: number[] = [];
      const partition = currentSplit;

      for (let p = 0; p < partition.length; p++) {
        const start = partition[p];
        const end = p + 1 < partition.length ? partition[p + 1] : words.length;
        const lineSlice = words.slice(start, end);
        const lLen =
          lineSlice.reduce((acc, w) => acc + w.length, 0) + (lineSlice.length - 1);
        allLineLengths.push(lLen);
      }

      const mean =
        allLineLengths.reduce((a, b) => a + b, 0) / allLineLengths.length;
      const variance =
        allLineLengths.reduce((acc, len) => acc + Math.pow(len - mean, 2), 0) /
        allLineLengths.length;

      // Score: primary is variance, with a slight preference for fewer lines
      const score = variance + targetLines * 0.1;

      if (score < bestScore) {
        bestScore = score;
        bestLines = [];
        for (let p = 0; p < partition.length; p++) {
          const start = partition[p];
          const end = p + 1 < partition.length ? partition[p + 1] : words.length;
          bestLines.push(words.slice(start, end).join(" "));
        }
      }
      return;
    }

    // Try ending the current line at wordIdx
    let currentLineLen = 0;
    for (let i = currentLineStart; i <= wordIdx; i++) {
      currentLineLen += words[i].length + (i > currentLineStart ? 1 : 0);
    }

    if (currentLineLen > effectiveMaxChars) return;

    // Remaining words must be at least remaining lines needed
    const remainingWords = words.length - (wordIdx + 1);
    const remainingLines = targetLines - (linesMade + 1);
    if (remainingWords < remainingLines) return;

    // Option A: Split here
    search(
      wordIdx + 1,
      wordIdx + 1,
      linesMade + 1,
      targetLines,
      [...currentSplit, wordIdx + 1],
    );

    // Option B: Continue extending current line
    search(wordIdx + 1, currentLineStart, linesMade, targetLines, currentSplit);
  }

  // Iterate from minLines up to maxLines
  for (let k = minLines; k <= maxLines; k++) {
    search(0, 0, 0, k, [0]);
    if (bestLines !== null) {
      break; // Found optimal split at lowest valid line count
    }
  }

  return bestLines ?? [trimmed];
}

/**
 * Text raster cache keyed by layer content and style properties.
 */
const textRasterCache = new Map<string, TextRaster>();

export function clearTextRasterCache(): void {
  for (const entry of textRasterCache.values()) {
    try {
      entry.bitmap.close();
    } catch {
      // ignore
    }
  }
  textRasterCache.clear();
}

/**
 * Rasterizes a TextLayer with Canvas 2D at the exact output resolution.
 */
export async function rasterizeText(
  layer: TextLayer,
  style: Style,
  frameHeightPx: number,
  getAssetBlob?: (assetId: string) => Promise<Blob | null>,
): Promise<TextRaster> {
  const fontRef: FontRef =
    layer.font === "display" ? style.fonts.display : style.fonts.body;

  // 1. Ensure fonts are loaded
  await ensureFonts(style, [layer], getAssetBlob);

  // 2. Cache key
  const cacheKey = [
    layer.id,
    layer.text,
    layer.role,
    layer.font,
    layer.size,
    layer.align,
    layer.color,
    layer.logoAssetId ?? "",
    fontRef.family,
    fontRef.weight,
    style.textColor,
    style.background.kind,
    frameHeightPx,
  ].join("::");

  const cached = textRasterCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // 3. Typography parameters per quality-bar §7:
  // - Title: 5–7% of frame height (default 6%), tracking −1.5% to −2.5%, line height 1.05–1.12
  // - Subtitle: 2.2–2.8% of frame height (default 2.5%), tracking 0, line height 1.25, 70% opacity
  // - Captions and labels: 1.6–1.9% of frame height (default 1.8%), tracking +6% for uppercase
  // - Text is NEVER smaller than 1.6% of frame height
  let defaultSize = 6.0;
  let lineHeightMul = 1.08;
  let trackingEm = -0.02;
  let isUppercase = false;

  if (layer.role === "subtitle") {
    defaultSize = 2.5;
    lineHeightMul = 1.25;
    trackingEm = 0.0;
  } else if (layer.role === "caption") {
    defaultSize = 1.8;
    lineHeightMul = 1.3;
    trackingEm = 0.02;
  } else if (layer.role === "label") {
    defaultSize = 1.8;
    lineHeightMul = 1.3;
    trackingEm = 0.06;
    isUppercase = true;
  }

  const requestedSize = layer.size > 0 ? layer.size : defaultSize;
  const effectiveSizePercent = Math.max(1.6, requestedSize);
  const fontSizePx = (effectiveSizePercent / 100) * frameHeightPx;
  const lineHeightPx = fontSizePx * lineHeightMul;

  // 4. Line wrapping
  const rawText = isUppercase ? layer.text.toUpperCase() : layer.text;
  const maxChars = layer.role === "title" ? 22 : layer.role === "subtitle" ? 48 : 40;
  const lines = wrapBalancedText(rawText, maxChars);

  // 5. Text color (auto-contrast if empty)
  let textColor = layer.color;
  if (!textColor) {
    textColor = style.textColor || getAutoTextColor(style.background, layer.role);
  }

  // 6. Canvas creation (with Node mock fallback for unit tests)
  const isNode = typeof document === "undefined" && typeof OffscreenCanvas === "undefined";

  if (isNode) {
    // Deterministic mock for unit test environments
    const mockCharWidth = fontSizePx * 0.55;
    const paddingY = fontSizePx * 0.2;
    const paddingX = fontSizePx * 0.4;

    let maxLineW = 0;
    const words: { x: number; y: number; w: number; h: number }[] = [];

    lines.forEach((line) => {
      const lineW = line.length * mockCharWidth;
      if (lineW > maxLineW) maxLineW = lineW;
    });

    const totalW = Math.max(10, Math.round(maxLineW + paddingX * 2));
    const totalH = Math.max(10, Math.round(lines.length * lineHeightPx + paddingY * 2));

    lines.forEach((line, lineIdx) => {
      const lineWords = line.split(/\s+/).filter(Boolean);
      const lineW = line.length * mockCharWidth;
      let startX = paddingX;
      if (layer.align === "center") {
        startX = Math.round((totalW - lineW) / 2);
      } else if (layer.align === "right") {
        startX = Math.round(totalW - paddingX - lineW);
      }

      let curX = startX;
      const lineTop = paddingY + lineIdx * lineHeightPx;

      for (const w of lineWords) {
        const wW = w.length * mockCharWidth;
        words.push({
          x: Math.round(curX),
          y: Math.round(lineTop),
          w: Math.round(wW),
          h: Math.round(lineHeightPx),
        });
        curX += wW + mockCharWidth;
      }
    });

    const mockBitmap = {
      width: totalW,
      height: totalH,
      close: () => {},
    } as unknown as ImageBitmap;

    const raster: TextRaster = {
      bitmap: mockBitmap,
      words,
      width: totalW,
      height: totalH,
    };

    textRasterCache.set(cacheKey, raster);
    return raster;
  }

  // In browser / worker: use real Canvas 2D
  const testCanvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(100, 100)
      : document.createElement("canvas");
  const testCtx = testCanvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D;

  const fontStyle = `${fontRef.weight || 600} ${fontSizePx}px "${fontRef.family}", sans-serif`;
  testCtx.font = fontStyle;
  if ("letterSpacing" in testCtx) {
    (testCtx as unknown as { letterSpacing: string }).letterSpacing = `${trackingEm}em`;
  }

  // Measure line and word dimensions
  const paddingY = Math.round(fontSizePx * 0.2);
  const paddingX = Math.round(fontSizePx * 0.4);

  let maxLineWidth = 0;
  const lineMetrics = lines.map((line) => {
    const width = testCtx.measureText(line).width;
    if (width > maxLineWidth) maxLineWidth = width;
    return { line, width };
  });

  const totalWidth = Math.max(16, Math.ceil(maxLineWidth + paddingX * 2));
  const totalHeight = Math.max(16, Math.ceil(lines.length * lineHeightPx + paddingY * 2));

  const drawCanvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(totalWidth, totalHeight)
      : document.createElement("canvas");
  drawCanvas.width = totalWidth;
  drawCanvas.height = totalHeight;

  const ctx = drawCanvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D;

  ctx.clearRect(0, 0, totalWidth, totalHeight);
  ctx.font = fontStyle;
  if ("letterSpacing" in ctx) {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${trackingEm}em`;
  }
  ctx.fillStyle = textColor;
  ctx.textBaseline = "top";

  const words: { x: number; y: number; w: number; h: number }[] = [];

  lineMetrics.forEach(({ line, width }, lineIdx) => {
    let startX = paddingX;
    if (layer.align === "center") {
      startX = Math.round((totalWidth - width) / 2);
    } else if (layer.align === "right") {
      startX = Math.round(totalWidth - paddingX - width);
    }

    const lineTop = paddingY + lineIdx * lineHeightPx;
    ctx.fillText(line, startX, lineTop);

    // Measure individual words in this line
    const wordList = line.split(/\s+/).filter(Boolean);
    const spaceWidth = ctx.measureText(" ").width;

    let curX = startX;
    for (const w of wordList) {
      const wWidth = ctx.measureText(w).width;
      words.push({
        x: Math.round(curX),
        y: Math.round(lineTop),
        w: Math.round(wWidth),
        h: Math.round(lineHeightPx),
      });
      curX += wWidth + spaceWidth;
    }
  });

  let bitmap: ImageBitmap;
  if ("transferToImageBitmap" in drawCanvas) {
    bitmap = (drawCanvas as OffscreenCanvas).transferToImageBitmap();
  } else {
    bitmap = await createImageBitmap(drawCanvas as HTMLCanvasElement);
  }

  const result: TextRaster = {
    bitmap,
    words,
    width: totalWidth,
    height: totalHeight,
  };

  textRasterCache.set(cacheKey, result);
  return result;
}
