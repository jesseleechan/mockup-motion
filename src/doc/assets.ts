import type { Layout, ProjectDoc, Style } from "./types";

/** Image asset ids that a layout puts on device screens, in slot order. */
export function layoutAssetIds(layout: Layout): string[] {
  switch (layout.kind) {
    case "single":
      return [layout.assetId];
    case "responsive":
      return [layout.desktopId, layout.mobileId];
    case "rows":
    case "columns":
    case "slider":
    case "orbit":
      return [...layout.assetIds];
  }
}

/** Shot style: the document style with the shot's overrides applied. */
export function resolveShotStyle(doc: ProjectDoc, shotIndex: number): Style {
  const overrides = doc.shots[shotIndex]?.styleOverrides;
  return overrides ? { ...doc.style, ...overrides } : doc.style;
}

/**
 * Every image asset the document can draw: the device screens in every layout kind. This is
 * the set to decode as images.
 */
export function collectAssetIds(doc: ProjectDoc): Set<string> {
  const ids = new Set<string>();
  const add = (id: string | null | undefined) => {
    if (id) ids.add(id);
  };

  for (const shot of doc.shots) {
    for (const id of layoutAssetIds(shot.layout)) add(id);
  }
  return ids;
}
