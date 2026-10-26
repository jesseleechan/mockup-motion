import type { Aspect, AssetRef, ProjectDoc } from "../doc/types";
import { createDoc } from "../doc/defaults";
import { demoAsset, demoAssetId, demoAssetRef } from "../lab/demo-assets";
import type { DemoPage, DemoSite } from "../lab/demo-assets";
import type { Template } from "./types";
import { fillSlots, missingRequiredSlots } from "./slots";

const desktopHero = (site: DemoSite, page?: DemoPage) => demoAssetId(site, "desktop", "hero", page);
const desktopFull = (site: DemoSite) => demoAssetId(site, "desktop", "full");
const mobileHero = (site: DemoSite, page?: DemoPage) => demoAssetId(site, "mobile", "hero", page);
const mobileFull = (site: DemoSite) => demoAssetId(site, "mobile", "full");

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
  // Five sites, ordered so the 16:9 poster (35% of the loop) shows Aurelia's photographic hero
  // whole in the middle column. Each site shows there once whole and once as a half card, in
  // two columns at most (tests/lane-order.test.ts).
  "mobile-frames": [
    mobileHero("northwind"),
    mobileHero("maison-oak"),
    mobileHero("studio-kova"),
    mobileHero("field-notes"),
    mobileHero("aurelia"),
  ],
  // Five per stack. The poster (35% of the 10 s loop, 3.5 s) shows the third screenshot in
  // front with the fourth and fifth behind it: a photographic hero in front.
  "desktop-stack": [
    desktopHero("northwind"),
    desktopHero("field-notes"),
    desktopHero("maison-oak"),
    desktopHero("aurelia"),
    desktopHero("studio-kova"),
  ],
  "mobile-stack": [
    mobileHero("northwind"),
    mobileHero("maison-oak"),
    mobileHero("aurelia"),
    mobileHero("field-notes"),
    mobileHero("studio-kova"),
  ],
  // Five per orbit, so the gallery shows a ring. The poster (35% of the 10 s loop) shows the
  // third screenshot settling at the front: Maison Oak's photographic hero, as on the sliders.
  "desktop-orbit": [
    desktopHero("northwind"),
    desktopHero("aurelia"),
    desktopHero("maison-oak"),
    desktopHero("field-notes"),
    desktopHero("studio-kova"),
  ],
  "mobile-orbit": [
    mobileHero("aurelia"),
    mobileHero("northwind"),
    mobileHero("maison-oak"),
    mobileHero("field-notes"),
    mobileHero("studio-kova"),
  ],
  // Four pages of one site in its nav order, an 8 s loop, so the URL pill reads aurelia.studio.
  // Heroes, not full pages: a tour shows each page's top, which is the hero (the desktop one at
  // twice the full page's resolution), and a full page would decode thousands of unseen rows.
  "desktop-site-tour": [
    desktopHero("aurelia"),
    desktopHero("aurelia", "studio"),
    desktopHero("aurelia", "works"),
    desktopHero("aurelia", "journal"),
  ],
  "mobile-site-tour": [
    mobileHero("aurelia"),
    mobileHero("aurelia", "studio"),
    mobileHero("aurelia", "works"),
    mobileHero("aurelia", "journal"),
  ],
  // Aurelia's home page, its earlier design first: the first in Library order is the old one
  // (presets round two, D8, D14).
  "desktop-before-after": [desktopHero("aurelia", "home-before"), desktopHero("aurelia")],
  "mobile-before-after": [mobileHero("aurelia", "home-before"), mobileHero("aurelia")],
  "scroll-story": [desktopFull("studio-kova")],
  // Aurelia's photographic hero; its page needs a 10.5 s shot at 0.9 viewport heights per second.
  "mobile-scroll-story": [mobileFull("aurelia")],
  // One page at both sizes: Aurelia's full pages, with their capture sections.
  "responsive-scroll": [desktopFull("aurelia"), mobileFull("aurelia")],
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
