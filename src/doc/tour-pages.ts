import { PAGE_KEYS, samePageBy } from "./same-page";
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
 * Adds a screenshot to one side of the tour, pairing it with the capture of its page (D12): on the
 * page whose other side shows its page, by capture URL, then by file name (`PAGE_KEYS`).
 * Otherwise it takes the first page with no screenshot on that side, or starts a new page whose
 * other side is empty. A page whose other side is waiting for a Library screenshot of its page
 * isn't taken, and a screenshot whose own page's capture is waiting in the Library starts a new
 * page for the two. Without page data this is the first page by order. A screenshot the side
 * already shows is left where it is. `assets` is the Library.
 */
export function addPageScreenshot(
  layout: ResponsiveTourLayout,
  side: PageSide,
  assetId: string,
  assets: readonly AssetRef[] = [],
): void {
  evenPages(layout);
  const ids = sideIds(layout, side);
  if (!assetId || ids.includes(assetId)) return;
  const page = pageFor(layout, side, assetId, assets);
  if (page >= 0) {
    ids[page] = assetId;
    return;
  }
  layout.desktopIds.push(side === "desktop" ? assetId : "");
  layout.mobileIds.push(side === "mobile" ? assetId : "");
}

const otherSide = (side: PageSide): PageSide => (side === "mobile" ? "desktop" : "mobile");

const sameCapturePage = (a: AssetRef, b: AssetRef) =>
  PAGE_KEYS.some((key) => samePageBy(key, a, b));

/** The page a screenshot joins on `side`, or -1 for a new page. */
function pageFor(
  layout: ResponsiveTourLayout,
  side: PageSide,
  assetId: string,
  assets: readonly AssetRef[],
): number {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const ids = sideIds(layout, side);
  const others = sideIds(layout, otherSide(side));
  const holes = ids.flatMap((id, i) => (id ? [] : [i]));
  const asset = byId.get(assetId);
  if (!asset) return holes[0] ?? -1;

  for (const key of PAGE_KEYS) {
    const own = holes.find((i) => {
      const other = byId.get(others[i]);
      return other !== undefined && samePageBy(key, asset, other);
    });
    if (own !== undefined) return own;
  }

  // Whether the Library holds a capture of `capture`'s page for `on` that the tour doesn't show.
  const waiting = (capture: AssetRef, on: PageSide) => {
    const shown = new Set(sideIds(layout, on));
    return assets.some(
      (a) =>
        a.id !== assetId &&
        a.kind === "image" &&
        pageSideFor(a) === on &&
        !shown.has(a.id) &&
        sameCapturePage(capture, a),
    );
  };
  if (waiting(asset, otherSide(side))) return -1;
  const free = holes.find((i) => {
    const other = byId.get(others[i]);
    return other === undefined || !waiting(other, side);
  });
  return free ?? -1;
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
