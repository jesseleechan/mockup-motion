import type { Layout, ProjectDoc, Style } from "./types";

/** Image asset ids that a layout puts on device screens, in slot order. */
export function layoutAssetIds(layout: Layout): string[] {
  switch (layout.kind) {
    case "single":
      return [layout.assetId];
    case "pair":
    case "responsive":
      return [layout.desktopId, layout.mobileId];
    case "trio":
      return [layout.desktopId, layout.tabletId ?? "", layout.mobileId];
    case "rows":
    case "columns":
    case "wall":
    case "stack":
    case "slider":
    case "orbit":
      return [...layout.assetIds];
    case "title":
      return [];
  }
}

/** Shot style: the document style with the shot's overrides applied. */
export function resolveShotStyle(doc: ProjectDoc, shotIndex: number): Style {
  const overrides = doc.shots[shotIndex]?.styleOverrides;
  return overrides ? { ...doc.style, ...overrides } : doc.style;
}

/**
 * Every image asset the document can draw: device screens in every layout kind and
 * text-layer logos. Audio is excluded; this is the set to decode as images.
 */
export function collectAssetIds(doc: ProjectDoc): Set<string> {
  const ids = new Set<string>();
  const add = (id: string | null | undefined) => {
    if (id) ids.add(id);
  };

  for (const shot of doc.shots) {
    for (const id of layoutAssetIds(shot.layout)) add(id);
    for (const layer of shot.texts ?? []) add(layer.logoAssetId);
  }
  return ids;
}
