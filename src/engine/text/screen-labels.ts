import type { ProjectDoc } from "../../doc/types";
import { resolveLayout } from "../../motion";
import type { TextLine } from "../../text/rasterize";
import type { AssetProvider } from "../Engine";
import type { LoadedChromeUrl } from "./chrome-url";

/** Raster id prefix for the labels drawn on screens (Before & After's "Before" and "After"). */
export const SCREEN_LABEL_LAYER_ID = "screen-label";

// Quality bar §4 (Before & After): white Inter Medium on a dark pill.
const LABEL_COLOR = "#FFFFFF";
const LABEL_WEIGHT = 500;
// As the URL pill's raster: twice the largest on-screen size, so mipmaps take it down.
const RASTER_OVERSAMPLE = 2;
// rasterizeText never draws smaller than 1.6% of the frame height.
const MIN_RASTER_SIZE = 1.6;

export interface ScreenLabelRequest {
  /** The label's text, which keys its raster. */
  key: string;
  line: TextLine;
  /** Glyph size of the raster in px when rasterized at `frameHeightPx`. */
  fontPx(frameHeightPx: number): number;
}

/**
 * One text line per distinct label the document's screens show. A layout lists every pane in
 * every frame (contracts.md §4), so the layout at each shot's start names every label. Its size
 * (percent of frame height) is the largest label's font size times the oversample.
 */
export function screenLabelRequests(doc: ProjectDoc): ScreenLabelRequest[] {
  const largest = new Map<string, number>();
  for (const shot of doc.shots) {
    const nodes = resolveLayout(shot.layout, doc.aspect, doc.assets, 0, shot.duration);
    for (const node of nodes) {
      for (const pane of node.panes ?? []) {
        if (!pane.label) continue;
        const size = pane.label.size * Math.max(1, node.transform.scale);
        largest.set(pane.label.text, Math.max(largest.get(pane.label.text) ?? 0, size));
      }
    }
  }
  return [...largest].map(([text, fontSize]) => {
    const size = Math.max(MIN_RASTER_SIZE, fontSize * RASTER_OVERSAMPLE * 100);
    const line: TextLine = {
      id: `${SCREEN_LABEL_LAYER_ID}:${text}`,
      text,
      size,
      color: LABEL_COLOR,
      weight: LABEL_WEIGHT,
    };
    return { key: text, line, fontPx: (frameHeightPx) => (size / 100) * frameHeightPx };
  });
}

/** Rasterizes every label the document's screens show, through the provider's getText. */
export async function loadScreenLabelRasters(
  doc: ProjectDoc,
  assets: Pick<AssetProvider, "getText">,
  frameHeightPx: number,
): Promise<Map<string, LoadedChromeUrl>> {
  const loaded = new Map<string, LoadedChromeUrl>();
  await Promise.all(
    screenLabelRequests(doc).map(async (request) => {
      const raster = await assets.getText(request.line, frameHeightPx);
      loaded.set(request.key, { raster, fontPx: request.fontPx(frameHeightPx) });
    }),
  );
  return loaded;
}
