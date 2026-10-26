import type { AssetRef, Layout } from "./types";

/**
 * Edits to a Responsive Tour's pages (presets round two D12). Page i is `desktopIds[i]` with
 * `mobileIds[i]`, and "" is a side without a screenshot, so every edit keeps both lists the same
 * length and moves or removes a page's two screenshots together. Each function edits the layout
 * in place (an immer draft or a plain object).
 */
type ResponsiveTourLayout = Extract<Layout, { kind: "responsive-tour" }>;

/** A side of a Responsive Tour page: its desktop or its mobile screenshot. */
export type PageSide = "desktop" | "mobile";

function sideIds(layout: ResponsiveTourLayout, side: PageSide): string[] {
  return side === "mobile" ? layout.mobileIds : layout.desktopIds;
}

/** The side a screenshot belongs on: a mobile screenshot on the mobile card, others on desktop. */
export function pageSideFor(asset: Pick<AssetRef, "role"> | undefined): PageSide {
  return asset?.role === "mobile" ? "mobile" : "desktop";
}

/** Pads the shorter list with "", so page i always pairs `desktopIds[i]` with `mobileIds[i]`. */
export function evenPages(layout: ResponsiveTourLayout): void {
  const count = Math.max(layout.desktopIds.length, layout.mobileIds.length);
  while (layout.desktopIds.length < count) layout.desktopIds.push("");
  while (layout.mobileIds.length < count) layout.mobileIds.push("");
}

/** The page that shows `assetId` on either side, or -1. */
export function pageIndexOf(layout: ResponsiveTourLayout, assetId: string): number {
  if (!assetId) return -1;
  const desktop = layout.desktopIds.indexOf(assetId);
  return desktop >= 0 ? desktop : layout.mobileIds.indexOf(assetId);
}

/**
 * Adds a screenshot to one side of the tour: on the first page that has no screenshot on that
 * side, or as a new page whose other side is empty. A screenshot the side already shows is left
 * where it is.
 */
export function addPageScreenshot(
  layout: ResponsiveTourLayout,
  side: PageSide,
  assetId: string,
): void {
  evenPages(layout);
  const ids = sideIds(layout, side);
  if (!assetId || ids.includes(assetId)) return;
  const hole = ids.indexOf("");
  if (hole >= 0) {
    ids[hole] = assetId;
    return;
  }
  layout.desktopIds.push(side === "desktop" ? assetId : "");
  layout.mobileIds.push(side === "mobile" ? assetId : "");
}

/** Puts `assetId` on one side of page `index` (an empty id clears it). */
export function setPageScreenshot(
  layout: ResponsiveTourLayout,
  index: number,
  side: PageSide,
  assetId: string,
): void {
  evenPages(layout);
  if (index < 0 || index >= layout.desktopIds.length) return;
  sideIds(layout, side)[index] = assetId;
}

/** Removes page `index`, both its screenshots. */
export function removePage(layout: ResponsiveTourLayout, index: number): void {
  evenPages(layout);
  if (index < 0 || index >= layout.desktopIds.length) return;
  layout.desktopIds.splice(index, 1);
  layout.mobileIds.splice(index, 1);
}

/** Moves page `from` to `to` (clamped), both its screenshots. */
export function movePage(layout: ResponsiveTourLayout, from: number, to: number): void {
  evenPages(layout);
  const count = layout.desktopIds.length;
  if (from < 0 || from >= count) return;
  const target = Math.max(0, Math.min(count - 1, to));
  if (target === from) return;
  for (const ids of [layout.desktopIds, layout.mobileIds]) {
    const [id] = ids.splice(from, 1);
    ids.splice(target, 0, id);
  }
}
