import { resolveShotStyle } from "../../doc/assets";
import type { ProjectDoc, Style, TextLayer } from "../../doc/types";
import { resolveLayout } from "../../motion";
import type { AssetProvider, TextRaster } from "../Engine";

/** Synthetic text-layer id prefix for the browser URL pill (never a document layer). */
export const CHROME_URL_LAYER_ID = "chrome-url";

// Quality-bar §3.2: toolbar 4.2% of window width (at least 0.028 stage units), domain
// text at 42% of the toolbar height.
const TOOLBAR_FRACTION = 0.042;
const MIN_TOOLBAR_HEIGHT = 0.028;
export const URL_TEXT_FRACTION = 0.42;
// The raster is drawn at twice the largest on-screen size so the pill text stays crisp
// under camera push-ins; mipmaps take it down.
const RASTER_OVERSAMPLE = 2;
// rasterizeText never draws smaller than 1.6% of the frame height (quality-bar §7).
const MIN_RASTER_SIZE = 1.6;

export function toolbarHeightFor(windowWidth: number): number {
  return Math.max(MIN_TOOLBAR_HEIGHT, windowWidth * TOOLBAR_FRACTION);
}

/** Raster key: the URL text and its colour, which follows the frame appearance. */
export function chromeUrlKey(style: Pick<Style, "browserUrl" | "frameAppearance">): string {
  return `${style.frameAppearance}:${style.browserUrl}`;
}

export interface ChromeUrlRequest {
  key: string;
  layer: TextLayer;
  style: Style;
  /** Glyph size of the raster in px when rasterized at `frameHeightPx`. */
  fontPx(frameHeightPx: number): number;
}

/**
 * One synthetic text layer per distinct URL (and frame appearance) that a standard-chrome browser shows. Its
 * size (percent of frame height) is the largest toolbar's URL text times the oversample,
 * so the raster resolution follows the biggest browser in the document.
 */
export function chromeUrlRequests(doc: ProjectDoc): ChromeUrlRequest[] {
  const largest = new Map<string, { toolbar: number; style: Style }>();
  doc.shots.forEach((shot, shotIndex) => {
    const style = resolveShotStyle(doc, shotIndex);
    if (!style.browserUrl || (style.browserChrome ?? "standard") !== "standard") return;
    const nodes = resolveLayout(
      shot.layout,
      doc.aspect,
      doc.assets,
      0,
      shot.duration,
      shot.entrance ?? "none",
    );
    for (const node of nodes) {
      if (node.device !== "browser") continue;
      const toolbar = toolbarHeightFor(node.width) * Math.max(1, node.transform.scale);
      const key = chromeUrlKey(style);
      const current = largest.get(key);
      if (!current || toolbar > current.toolbar) largest.set(key, { toolbar, style });
    }
  });

  return [...largest].map(([key, { toolbar, style }]) => {
    const size = Math.max(MIN_RASTER_SIZE, toolbar * URL_TEXT_FRACTION * RASTER_OVERSAMPLE * 100);
    const layer: TextLayer = {
      id: `${CHROME_URL_LAYER_ID}:${key}`,
      text: style.browserUrl,
      role: "caption",
      font: "body",
      size,
      anchor: "center",
      align: "center",
      color: style.frameAppearance === "dark" ? "#F5F5F7" : "#1D1D1F",
      animation: "none",
      delay: 0,
    };
    return { key, layer, style, fontPx: (frameHeightPx) => (size / 100) * frameHeightPx };
  });
}

export interface LoadedChromeUrl {
  raster: TextRaster;
  fontPx: number;
}

/** Rasterizes every URL the document's browsers show, through the provider's getText. */
export async function loadChromeUrlRasters(
  doc: ProjectDoc,
  assets: Pick<AssetProvider, "getText">,
  frameHeightPx: number,
): Promise<Map<string, LoadedChromeUrl>> {
  const loaded = new Map<string, LoadedChromeUrl>();
  await Promise.all(
    chromeUrlRequests(doc).map(async (request) => {
      const raster = await assets.getText(request.layer, request.style, frameHeightPx);
      loaded.set(request.key, { raster, fontPx: request.fontPx(frameHeightPx) });
    }),
  );
  return loaded;
}
