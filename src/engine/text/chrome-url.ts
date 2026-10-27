import { resolveShotStyle } from "../../doc/assets";
import type { ProjectDoc, Style } from "../../doc/types";
import { type LayoutNode, type PillUrl, pillUrls, resolveLayout } from "../../motion";
import type { TextLine } from "../../text/rasterize";
import type { AssetProvider, TextRaster } from "../Engine";

/** Raster id prefix for the browser URL pill. */
export const CHROME_URL_LAYER_ID = "chrome-url";

// Quality-bar §3.2: toolbar 4.2% of window width (at least 0.028 stage units), domain
// text at 42% of the toolbar height.
const TOOLBAR_FRACTION = 0.042;
const MIN_TOOLBAR_HEIGHT = 0.028;
export const URL_TEXT_FRACTION = 0.42;
// The raster is drawn at twice the largest on-screen size so the pill text stays crisp
// under camera push-ins; mipmaps take it down.
const RASTER_OVERSAMPLE = 2;
// rasterizeText never draws smaller than 1.6% of the frame height.
const MIN_RASTER_SIZE = 1.6;

export function toolbarHeightFor(windowWidth: number): number {
  return Math.max(MIN_TOOLBAR_HEIGHT, windowWidth * TOOLBAR_FRACTION);
}

/** Raster key: a URL's text and its colour, which follows the frame appearance. */
export function chromeUrlKey(appearance: Style["frameAppearance"], text: string): string {
  return `${appearance}:${text}`;
}

/**
 * The URLs a browser's pill shows at this frame: a Site Tour's pages (`LayoutNode.urls`), else
 * the document's URL. An empty URL shows nothing.
 */
export function shownUrls(node: LayoutNode, browserUrl: string): PillUrl[] {
  if (node.urls) return node.urls;
  return browserUrl ? [{ text: browserUrl, opacity: 1 }] : [];
}

export interface ChromeUrlRequest {
  key: string;
  line: TextLine;
  /** Glyph size of the raster in px when rasterized at `frameHeightPx`. */
  fontPx(frameHeightPx: number): number;
}

/**
 * One text line per distinct URL (and frame appearance) that a standard-chrome browser shows:
 * the document's URL, or each page's of a Site Tour, whose layout lists every page in every
 * frame. Its size (percent of frame height) is the largest toolbar's URL text times the
 * oversample, so the raster resolution follows the biggest browser in the document.
 */
export function chromeUrlRequests(doc: ProjectDoc): ChromeUrlRequest[] {
  const largest = new Map<string, { toolbar: number; text: string; style: Style }>();
  doc.shots.forEach((shot, shotIndex) => {
    const style = resolveShotStyle(doc, shotIndex);
    if (!style.browserUrl || (style.browserChrome ?? "standard") !== "standard") return;
    const nodes = resolveLayout(shot.layout, doc.aspect, doc.assets, 0, shot.duration);
    for (const node of nodes) {
      if (node.device !== "browser") continue;
      const toolbar = toolbarHeightFor(node.width) * Math.max(1, node.transform.scale);
      const urls = pillUrls(shot.layout, node, style.browserUrl, doc.assets) ?? [
        { text: style.browserUrl, opacity: 1 },
      ];
      for (const { text } of urls) {
        const key = chromeUrlKey(style.frameAppearance, text);
        const current = largest.get(key);
        if (!current || toolbar > current.toolbar) largest.set(key, { toolbar, text, style });
      }
    }
  });

  return [...largest].map(([key, { toolbar, text, style }]) => {
    const size = Math.max(MIN_RASTER_SIZE, toolbar * URL_TEXT_FRACTION * RASTER_OVERSAMPLE * 100);
    const line: TextLine = {
      id: `${CHROME_URL_LAYER_ID}:${key}`,
      text,
      size,
      color: style.frameAppearance === "dark" ? "#F5F5F7" : "#1D1D1F",
    };
    return { key, line, fontPx: (frameHeightPx) => (size / 100) * frameHeightPx };
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
      const raster = await assets.getText(request.line, frameHeightPx);
      loaded.set(request.key, { raster, fontPx: request.fontPx(frameHeightPx) });
    }),
  );
  return loaded;
}
