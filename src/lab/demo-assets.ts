import type { AssetRef } from "../doc/types";
import manifest from "../../public/demo/manifest.json";

export type DemoSite = "aurelia" | "northwind" | "maison-oak" | "field-notes" | "studio-kova";
export type DemoDevice = "desktop" | "mobile";
/** `hero` is one viewport; `full` is the whole page. */
export type DemoCapture = "hero" | "full";

export interface DemoAsset {
  id: string;
  url: string;
  width: number;
  height: number;
  role: DemoDevice;
  site: DemoSite;
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

export function demoAssetId(site: DemoSite, device: DemoDevice, capture: DemoCapture): string {
  return `demo-${site}-${device}-${capture}`;
}

function buildDemoAssets(): ReadonlyMap<string, DemoAsset> {
  const map = new Map<string, DemoAsset>();
  for (const entry of manifest) {
    const site = SITES.find((s) => s === entry.site);
    if (!site) throw new Error(`Unknown demo site in manifest: ${entry.site}`);
    if (entry.category !== "desktop" && entry.category !== "mobile") {
      throw new Error(`Unknown demo category in manifest: ${entry.category}`);
    }
    if (entry.role !== "hero" && entry.role !== "full") {
      throw new Error(`Unknown demo capture in manifest: ${entry.role}`);
    }
    const id = demoAssetId(site, entry.category, entry.role);
    if (map.has(id)) throw new Error(`Duplicate demo asset in manifest: ${id}`);
    map.set(id, {
      id,
      url: `/demo/${entry.file}`,
      width: entry.width,
      height: entry.height,
      role: entry.category,
      site,
      capture: entry.role,
      tall: entry.tall,
      bytes: entry.sizeBytes,
    });
  }
  return map;
}

/** Every demo capture in `public/demo/manifest.json`, keyed by `demo-<site>-<device>-<capture>`. */
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
  return {
    id: asset.id,
    kind: "image",
    name: `${asset.site}-${asset.role}-${asset.capture}.webp`,
    mime: "image/webp",
    bytes: asset.bytes,
    width: asset.width,
    height: asset.height,
    role: asset.role,
    meta: { tall: asset.tall },
  };
}
