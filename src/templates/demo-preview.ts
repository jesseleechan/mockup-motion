import type { Aspect, AssetRef, ProjectDoc } from "../doc/types";
import { createDoc } from "../doc/defaults";
import { demoAsset, demoAssetId, demoAssetRef } from "../lab/demo-assets";
import type { DemoSite } from "../lab/demo-assets";
import type { Template } from "./types";
import { fillSlots, missingRequiredSlots } from "./slots";

const desktopHero = (site: DemoSite) => demoAssetId(site, "desktop", "hero");
const desktopFull = (site: DemoSite) => demoAssetId(site, "desktop", "full");
const mobileHero = (site: DemoSite) => demoAssetId(site, "mobile", "hero");

/**
 * Demo captures per template, in slot order (fillSlots is greedy by role).
 * Multi-screen layouts use a different site per screen. Templates not listed use
 * DEFAULT_DEMO_IDS.
 */
const DEMO_IDS_BY_TEMPLATE: Record<string, string[]> = {
  frames: [
    desktopHero("northwind"),
    desktopHero("aurelia"),
    desktopHero("field-notes"),
    desktopHero("studio-kova"),
    desktopHero("maison-oak"),
  ],
  // Five per slider: the 16:9 preview fills the slots on both sides of the active card, and
  // the 10 s loop puts the poster (35%) on a settled card.
  "mobile-slider": [
    mobileHero("aurelia"),
    mobileHero("northwind"),
    mobileHero("maison-oak"),
    mobileHero("field-notes"),
    mobileHero("studio-kova"),
  ],
  // The poster frame (3.5 s) shows the third screenshot settling: Maison Oak's photographic hero.
  "desktop-slider": [
    desktopHero("northwind"),
    desktopHero("aurelia"),
    desktopHero("maison-oak"),
    desktopHero("field-notes"),
    desktopHero("studio-kova"),
  ],
  "scroll-story": [desktopFull("studio-kova")],
};

const DEFAULT_DEMO_IDS = [desktopFull("aurelia"), mobileHero("aurelia")];

/** Fictional domains for the demo sites, shown in the browser's URL pill. */
const DEMO_SITE_URLS: Record<DemoSite, string> = {
  aurelia: "aurelia.studio",
  northwind: "northwind.dev",
  "maison-oak": "maisonoak.design",
  "field-notes": "fieldnotes.press",
  "studio-kova": "studiokova.co",
};

/**
 * The demo site's domain for template previews, or "" when the screens show more than
 * one site: the pill shows one URL for every browser in the document.
 */
export function demoBrowserUrl(assets: AssetRef[]): string {
  const sites = new Set(assets.map((asset) => demoAsset(asset.id).site));
  const [site] = [...sites];
  return sites.size === 1 && site ? DEMO_SITE_URLS[site] : "";
}

/** Demo assets that fill the template's slots; the same set the template preview uses. */
export function demoAssetsForTemplate(templateId: string): AssetRef[] {
  const ids = DEMO_IDS_BY_TEMPLATE[templateId] ?? DEFAULT_DEMO_IDS;
  return ids.map(demoAssetRef);
}

/**
 * Demo assets that fill the template's missing required slots, leaving the user's own
 * screenshots in the slots they already fill. Empty when nothing is missing.
 */
export function demoAssetsToFill(template: Template, assets: AssetRef[]): AssetRef[] {
  const missingRoles = new Set(missingRequiredSlots(template, assets).map((slot) => slot.role));
  return demoAssetsForTemplate(template.id).filter(
    (demo) =>
      demo.role !== undefined &&
      missingRoles.has(demo.role) &&
      !assets.some((a) => a.id === demo.id),
  );
}

export function buildTemplatePreviewDoc(template: Template, aspect: Aspect = "16:9"): ProjectDoc {
  const assets = demoAssetsForTemplate(template.id);
  const slots = fillSlots(template, assets);
  const built = template.build({
    aspect,
    slots,
    projectName: template.name,
  });

  const base = createDoc();
  return {
    ...base,
    name: template.name,
    aspect,
    templateId: template.id,
    assets,
    style: { ...built.style, browserUrl: built.style.browserUrl || demoBrowserUrl(assets) },
    shots: built.shots,
    loop: built.loop,
  };
}
