import type { Style, TextLayer } from "../doc/types";

export interface TextRaster {
  bitmap: ImageBitmap;
  words: { x: number; y: number; w: number; h: number }[];
  width: number;
  height: number;
}

export async function rasterizeText(
  _layer: TextLayer,
  _style: Style,
  _frameHeightPx: number,
): Promise<TextRaster> {
  throw new Error("WP-10: text rasterization will be implemented in WP-10");
}
