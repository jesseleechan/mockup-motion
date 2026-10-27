/**
 * "Use my screenshots": after "Try with demo content", swaps the demo screenshots in the project
 * for the user's uploads, in order, desktop for desktop and mobile for mobile. A page shown at both
 * sizes (Responsive Scroll, Responsive Tour) takes a desktop and a mobile upload of one page when
 * the uploads name their pages (src/doc/same-page.ts). Pure: no DOM.
 */
import { layoutAssetIds, mapLayoutAssetIds } from "../doc/assets";
import { NO_PAGE, pairByPage } from "../doc/same-page";
import type { AssetRef, ProjectDoc } from "../doc/types";
import { isDemoAssetId } from "../lab/demo-assets";
import { samePagePair } from "../templates/slots";

type SwapRole = "desktop" | "mobile";

function usedAssetIds(doc: ProjectDoc): string[] {
  return doc.shots.flatMap((shot) => layoutAssetIds(shot.layout)).filter(Boolean);
}

/** The demo pages shown at both sizes, as [desktop, mobile] demo ids, in shot order. */
function demoPages(doc: ProjectDoc): [string, string][] {
  return doc.shots.flatMap(({ layout }) => {
    const pages: [string, string][] =
      layout.kind === "responsive"
        ? [[layout.desktopId, layout.mobileId]]
        : layout.kind === "responsive-tour"
          ? layout.desktopIds.map((id, i) => [id, layout.mobileIds[i] ?? ""])
          : [];
    return pages.filter(([desktop, mobile]) => isDemoAssetId(desktop) && isDemoAssetId(mobile));
  });
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
 * gets the next upload of its role, so a desktop slot keeps a desktop screenshot. A page shown at
 * both sizes pairs by page, as template fill does: Responsive Scroll's page takes a desktop and a
 * mobile upload of one page (`samePagePair`), and a Responsive Tour page's mobile upload is the
 * capture of its desktop upload's page (`pairByPage`). Without page data the order is as above.
 */
export function planDemoSwap(doc: ProjectDoc): DemoSwap {
  const used = usedAssetIds(doc);
  const usedSet = new Set(used);
  const byId = new Map(doc.assets.map((a) => [a.id, a]));
  const uploads: Record<SwapRole, AssetRef[]> = { desktop: [], mobile: [] };
  for (const asset of doc.assets) {
    const role = swapRole(asset);
    if (role && !isDemoAssetId(asset.id) && !usedSet.has(asset.id)) uploads[role].push(asset);
  }

  const replacements = new Map<string, string>();
  const replace = (demo: string, upload: AssetRef, role: SwapRole) => {
    replacements.set(demo, upload.id);
    uploads[role] = uploads[role].filter((a) => a !== upload);
  };
  const demos = [...new Set(used.filter(isDemoAssetId))];
  const pages = demoPages(doc);

  // Responsive Scroll's page: a desktop and a mobile upload of one page, when there are some.
  for (const shot of doc.shots) {
    const layout = shot.layout;
    if (layout.kind !== "responsive" || replacements.has(layout.desktopId)) continue;
    if (!isDemoAssetId(layout.desktopId) || !isDemoAssetId(layout.mobileId)) continue;
    const pair = samePagePair(
      [...uploads.desktop, ...uploads.mobile],
      "desktop",
      "mobile",
      usedSet,
    );
    if (!pair) continue;
    replace(layout.desktopId, pair[0], "desktop");
    replace(layout.mobileId, pair[1], "mobile");
  }

  // Desktop demos take the desktop uploads in order.
  const waiting = demos.filter((demo) => !replacements.has(demo));
  for (const demo of waiting.filter((d) => swapRole(byId.get(d)) === "desktop")) {
    const upload = uploads.desktop[0];
    if (upload) replace(demo, upload, "desktop");
  }

  // Mobile demos take the mobile uploads in order, except that a page's mobile demo takes the
  // capture of the page its desktop upload shows.
  const mobileDemos = waiting.filter((d) => swapRole(byId.get(d)) === "mobile");
  const pageDesktop = (mobile: string) => {
    const desktop = pages.find(([, m]) => m === mobile)?.[0];
    const upload = desktop ? replacements.get(desktop) : undefined;
    return (upload && byId.get(upload)) || NO_PAGE;
  };
  const mobiles = pairByPage(mobileDemos.map(pageDesktop), uploads.mobile);
  mobileDemos.forEach((demo, i) => {
    const upload = mobiles[i];
    if (upload) replacements.set(demo, upload.id);
  });

  return { replacements, remaining: demos.length - replacements.size };
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
    mapLayoutAssetIds(shot.layout, swap);
    if (before.some((id) => replacements.has(id)) && shot.scroll?.sections) {
      delete shot.scroll.sections;
    }
  }
  draft.assets = draft.assets.filter((a) => !replacements.has(a.id));
}
