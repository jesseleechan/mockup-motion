import type { AssetRef } from "../doc/types";
import manifest from "../../public/demo/manifest.json" with { type: "json" };
import aureliaDesktop from "../../public/demo/aurelia/sections.json" with { type: "json" };
import aureliaMobile from "../../public/demo/aurelia/sections-mobile.json" with { type: "json" };
import northwindDesktop from "../../public/demo/northwind/sections.json" with { type: "json" };
import northwindMobile from "../../public/demo/northwind/sections-mobile.json" with { type: "json" };
import maisonOakDesktop from "../../public/demo/maison-oak/sections.json" with { type: "json" };
import maisonOakMobile from "../../public/demo/maison-oak/sections-mobile.json" with { type: "json" };
import fieldNotesDesktop from "../../public/demo/field-notes/sections.json" with { type: "json" };
import fieldNotesMobile from "../../public/demo/field-notes/sections-mobile.json" with { type: "json" };
import studioKovaDesktop from "../../public/demo/studio-kova/sections.json" with { type: "json" };
import studioKovaMobile from "../../public/demo/studio-kova/sections-mobile.json" with { type: "json" };
import aureliaWorksDesktop from "../../public/demo/aurelia/works/sections.json" with { type: "json" };
import aureliaWorksMobile from "../../public/demo/aurelia/works/sections-mobile.json" with { type: "json" };
import aureliaStudioDesktop from "../../public/demo/aurelia/studio/sections.json" with { type: "json" };
import aureliaStudioMobile from "../../public/demo/aurelia/studio/sections-mobile.json" with { type: "json" };
import aureliaJournalDesktop from "../../public/demo/aurelia/journal/sections.json" with { type: "json" };
import aureliaJournalMobile from "../../public/demo/aurelia/journal/sections-mobile.json" with { type: "json" };
import aureliaBeforeDesktop from "../../public/demo/aurelia/home-before/sections.json" with { type: "json" };
import aureliaBeforeMobile from "../../public/demo/aurelia/home-before/sections-mobile.json" with { type: "json" };
import { captureMeta, type CaptureJson } from "../assets/capture-json";

export type DemoSite = "aurelia" | "northwind" | "maison-oak" | "field-notes" | "studio-kova";
export type DemoDevice = "desktop" | "mobile";
/** `hero` is one viewport; `full` is the whole page. */
export type DemoCapture = "hero" | "full";
/**
 * A page of a demo site. Every site has `home`. Aurelia also has `works`, `studio` and
 * `journal`, three more pages of today's site for the tours, and `home-before`, an earlier
 * design of its home page for Before & After (docs/presets-2-plan, D14).
 */
export type DemoPage = "home" | "works" | "studio" | "journal" | "home-before";

export interface DemoAsset {
  id: string;
  url: string;
  width: number;
  height: number;
  role: DemoDevice;
  site: DemoSite;
  page: DemoPage;
  capture: DemoCapture;
  tall: boolean;
  bytes: number;
}

const SITES: readonly DemoSite[] = [
  "aurelia",
  "northwind",
  "maison-oak",
  "field-notes",
  "studio-kova",
];

const PAGES: readonly DemoPage[] = ["home", "works", "studio", "journal", "home-before"];

const pageKey = (site: DemoSite, page: DemoPage) => `${site}/${page}`;

/** Each page's capture JSON per device: the sections of its full-page screenshots. */
const CAPTURES: Record<string, Record<DemoDevice, CaptureJson>> = {
  [pageKey("aurelia", "home")]: { desktop: aureliaDesktop, mobile: aureliaMobile },
  [pageKey("aurelia", "works")]: { desktop: aureliaWorksDesktop, mobile: aureliaWorksMobile },
  [pageKey("aurelia", "studio")]: { desktop: aureliaStudioDesktop, mobile: aureliaStudioMobile },
  [pageKey("aurelia", "journal")]: {
    desktop: aureliaJournalDesktop,
    mobile: aureliaJournalMobile,
  },
  [pageKey("aurelia", "home-before")]: {
    desktop: aureliaBeforeDesktop,
    mobile: aureliaBeforeMobile,
  },
  [pageKey("northwind", "home")]: { desktop: northwindDesktop, mobile: northwindMobile },
  [pageKey("maison-oak", "home")]: { desktop: maisonOakDesktop, mobile: maisonOakMobile },
  [pageKey("field-notes", "home")]: { desktop: fieldNotesDesktop, mobile: fieldNotesMobile },
  [pageKey("studio-kova", "home")]: { desktop: studioKovaDesktop, mobile: studioKovaMobile },
};

/**
 * The id of a demo capture. A site's home page keeps the original `demo-<site>-<device>-<capture>`;
 * any other page is `demo-<site>-<page>-<device>-<capture>`. A page the site doesn't have gives
 * an id that `demoAsset` and `demoAssetRef` reject.
 */
export function demoAssetId(
  site: DemoSite,
  device: DemoDevice,
  capture: DemoCapture,
  page: DemoPage = "home",
): string {
  return page === "home"
    ? `demo-${site}-${device}-${capture}`
    : `demo-${site}-${page}-${device}-${capture}`;
}

function buildDemoAssets(): ReadonlyMap<string, DemoAsset> {
  const map = new Map<string, DemoAsset>();
  for (const entry of manifest) {
    const site = SITES.find((s) => s === entry.site);
    if (!site) throw new Error(`Unknown demo site in manifest: ${entry.site}`);
    // Home pages' entries predate pages and carry no `page`.
    const pageName = entry.page ?? "home";
    const page = PAGES.find((p) => p === pageName);
    if (!page) throw new Error(`Unknown demo page in manifest: ${pageName}`);
    if (!CAPTURES[pageKey(site, page)]) {
      throw new Error(`No section data for demo page ${pageKey(site, page)}`);
    }
    if (entry.category !== "desktop" && entry.category !== "mobile") {
      throw new Error(`Unknown demo category in manifest: ${entry.category}`);
    }
    if (entry.role !== "hero" && entry.role !== "full") {
      throw new Error(`Unknown demo capture in manifest: ${entry.role}`);
    }
    const id = demoAssetId(site, entry.category, entry.role, page);
    if (map.has(id)) throw new Error(`Duplicate demo asset in manifest: ${id}`);
    map.set(id, {
      id,
      url: `/demo/${entry.file}`,
      width: entry.width,
      height: entry.height,
      role: entry.category,
      site,
      page,
      capture: entry.role,
      tall: entry.tall,
      bytes: entry.sizeBytes,
    });
  }
  return map;
}

/** Every demo capture in `public/demo/manifest.json`, keyed by `demoAssetId`. */
export const DEMO_ASSETS: ReadonlyMap<string, DemoAsset> = buildDemoAssets();

export function isDemoAssetId(id: string): boolean {
  return DEMO_ASSETS.has(id);
}

export function demoAsset(id: string): DemoAsset {
  const asset = DEMO_ASSETS.get(id);
  if (!asset) throw new Error(`Unknown demo asset: ${id}`);
  return asset;
}

/** An `AssetRef` for a demo capture with its true pixel size. */
export function demoAssetRef(id: string): AssetRef {
  const asset = demoAsset(id);
  const pagePart = asset.page === "home" ? "" : `-${asset.page}`;
  return {
    id: asset.id,
    kind: "image",
    name: `${asset.site}${pagePart}-${asset.role}-${asset.capture}.webp`,
    mime: "image/webp",
    bytes: asset.bytes,
    width: asset.width,
    height: asset.height,
    role: asset.role,
    // A full page carries its capture's sections, as an imported capture does (R02).
    meta:
      asset.capture === "full"
        ? {
            tall: asset.tall,
            ...captureMeta(CAPTURES[pageKey(asset.site, asset.page)][asset.role]),
          }
        : { tall: asset.tall },
  };
}
