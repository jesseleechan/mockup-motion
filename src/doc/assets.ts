import type { Layout, ProjectDoc, Style } from "./types";

/**
 * Image asset ids that a layout puts on device screens, in slot order. Every layout kind is
 * handled here and in `mapLayoutAssetIds`, so a new kind fails to compile until both list its
 * screenshots: saved templates, the Library's "used in shot" marker and texture loading read them.
 */
export function layoutAssetIds(layout: Layout): string[] {
  switch (layout.kind) {
    case "single":
      return [layout.assetId];
    case "responsive":
      return [layout.desktopId, layout.mobileId];
    case "compare":
      return [layout.beforeId, layout.afterId];
    case "responsive-tour":
      return [...layout.desktopIds, ...layout.mobileIds];
    case "rows":
    case "columns":
    case "slider":
    case "orbit":
    case "tour":
    case "pageColumns":
      return [...layout.assetIds];
    default:
      return unknownLayout(layout, []);
  }
}

/**
 * Maps every screen asset id in a layout through `map`, empty ones ("") included, in place (an
 * immer draft or a plain object).
 */
export function mapLayoutAssetIds(layout: Layout, map: (id: string) => string): void {
  switch (layout.kind) {
    case "single":
      layout.assetId = map(layout.assetId);
      return;
    case "responsive":
      layout.desktopId = map(layout.desktopId);
      layout.mobileId = map(layout.mobileId);
      return;
    case "compare":
      layout.beforeId = map(layout.beforeId);
      layout.afterId = map(layout.afterId);
      return;
    case "responsive-tour":
      layout.desktopIds = layout.desktopIds.map(map);
      layout.mobileIds = layout.mobileIds.map(map);
      return;
    case "rows":
    case "columns":
    case "slider":
    case "orbit":
    case "tour":
    case "pageColumns":
      layout.assetIds = layout.assetIds.map(map);
      return;
    default:
      return unknownLayout(layout, undefined);
  }
}

/**
 * Compile-time exhaustiveness: `layout` is `never` once every kind has a case. At run time an
 * unknown kind, such as one in a template saved by a later version, shows no screenshots.
 */
function unknownLayout<T>(_layout: never, fallback: T): T {
  return fallback;
}

/** Swaps screen asset ids in a layout, `from` id to `to` id; ids not in the map stay. */
export function replaceLayoutAssetIds(layout: Layout, map: Record<string, string>): void {
  mapLayoutAssetIds(layout, (id) => map[id] ?? id);
}

/** The shots, numbered from 1, that show `assetId` on a screen (the Library's "used in shot"). */
export function shotsShowingAsset(doc: Pick<ProjectDoc, "shots">, assetId: string): number[] {
  if (!assetId) return [];
  return doc.shots.flatMap((shot, i) =>
    layoutAssetIds(shot.layout).includes(assetId) ? [i + 1] : [],
  );
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
