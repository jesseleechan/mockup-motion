import type { Background, Layout, ProjectDoc, Style } from "./types";

/** Image asset ids that a layout puts on device screens, in slot order. */
export function layoutAssetIds(layout: Layout): string[] {
  switch (layout.kind) {
    case "single":
      return [layout.assetId];
    case "pair":
      return [layout.desktopId, layout.mobileId];
    case "trio":
      return [layout.desktopId, layout.tabletId ?? "", layout.mobileId];
    case "rows":
    case "columns":
    case "wall":
    case "stack":
    case "slider":
      return [...layout.assetIds];
    case "title":
      return [];
  }
}

/** The image asset a background draws, or null for procedural backgrounds. */
export function backgroundAssetId(background: Background | undefined): string | null {
  if (!background) return null;
  if (background.kind === "ambient" || background.kind === "image") {
    return background.assetId || null;
  }
  return null;
}

/** Shot style: the document style with the shot's overrides applied. */
export function resolveShotStyle(doc: ProjectDoc, shotIndex: number): Style {
  const overrides = doc.shots[shotIndex]?.styleOverrides;
  return overrides ? { ...doc.style, ...overrides } : doc.style;
}

/**
 * Every image asset the document can draw: device screens in every layout kind,
 * ambient and image backgrounds (document style and every shot override), and
 * text-layer logos. Audio is excluded; this is the set to decode as images.
 */
export function collectAssetIds(doc: ProjectDoc): Set<string> {
  const ids = new Set<string>();
  const add = (id: string | null | undefined) => {
    if (id) ids.add(id);
  };

  add(backgroundAssetId(doc.style.background));
  for (const shot of doc.shots) {
    for (const id of layoutAssetIds(shot.layout)) add(id);
    add(backgroundAssetId(shot.styleOverrides?.background));
    for (const layer of shot.texts ?? []) add(layer.logoAssetId);
  }
  return ids;
}
