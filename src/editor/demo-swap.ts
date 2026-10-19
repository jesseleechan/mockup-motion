/**
 * "Use my screenshots": after "Try with demo content", swaps the demo screenshots in the project
 * for the user's uploads, in order, desktop for desktop and mobile for mobile. Pure: no DOM.
 */
import type { AssetRef, Layout, ProjectDoc } from "../doc/types";
import { isDemoAssetId } from "../lab/demo-assets";

type SwapRole = "desktop" | "mobile";

/** The screenshot ids a layout shows, in slot order. */
function layoutAssetIds(layout: Layout): string[] {
  switch (layout.kind) {
    case "single":
      return [layout.assetId];
    case "responsive":
      return [layout.desktopId, layout.mobileId];
    default:
      return layout.assetIds;
  }
}

/** Replaces the screenshot ids of a layout in place (an immer draft). */
function replaceLayoutAssetIds(layout: Layout, swap: (id: string) => string): void {
  switch (layout.kind) {
    case "single":
      layout.assetId = swap(layout.assetId);
      return;
    case "responsive":
      layout.desktopId = swap(layout.desktopId);
      layout.mobileId = swap(layout.mobileId);
      return;
    default:
      layout.assetIds = layout.assetIds.map(swap);
  }
}

function usedAssetIds(doc: ProjectDoc): string[] {
  return doc.shots.flatMap((shot) => layoutAssetIds(shot.layout)).filter(Boolean);
}

function swapRole(asset: AssetRef | undefined): SwapRole | undefined {
  if (asset?.kind !== "image") return undefined;
  return asset.role === "desktop" || asset.role === "mobile" ? asset.role : undefined;
}

export interface DemoSwap {
  /** Demo id → upload id, for each demo screenshot that an upload replaces. */
  replacements: Map<string, string>;
  /** Demo screenshots left in the project because there are too few uploads of their role. */
  remaining: number;
}

/**
 * Which upload replaces which demo screenshot. Demo screenshots are taken in the order the shots
 * show them; uploads in library order, skipping those a shot already shows. A demo screenshot
 * gets the next upload of its role, so a desktop slot keeps a desktop screenshot.
 */
export function planDemoSwap(doc: ProjectDoc): DemoSwap {
  const used = usedAssetIds(doc);
  const usedSet = new Set(used);
  const byId = new Map(doc.assets.map((a) => [a.id, a]));
  const uploads: Record<SwapRole, string[]> = { desktop: [], mobile: [] };
  for (const asset of doc.assets) {
    const role = swapRole(asset);
    if (role && !isDemoAssetId(asset.id) && !usedSet.has(asset.id)) uploads[role].push(asset.id);
  }

  const replacements = new Map<string, string>();
  let remaining = 0;
  const demos = [...new Set(used.filter(isDemoAssetId))];
  for (const demo of demos) {
    const role = swapRole(byId.get(demo));
    const upload = role ? uploads[role].shift() : undefined;
    if (upload) replacements.set(demo, upload);
    else remaining++;
  }
  return { replacements, remaining };
}

/**
 * Applies a swap to a draft of the document: every shot shows the uploads in place of the demo
 * screenshots, and the replaced demo screenshots leave the library. Shots whose screenshots
 * change drop their chosen scroll sections, which name sections of the demo pages.
 */
export function applyDemoSwap(draft: ProjectDoc, replacements: Map<string, string>): void {
  const swap = (id: string) => replacements.get(id) ?? id;
  for (const shot of draft.shots) {
    const before = layoutAssetIds(shot.layout);
    replaceLayoutAssetIds(shot.layout, swap);
    if (before.some((id) => replacements.has(id)) && shot.scroll?.sections) {
      delete shot.scroll.sections;
    }
  }
  draft.assets = draft.assets.filter((a) => !replacements.has(a.id));
}
