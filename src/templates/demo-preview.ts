import type { AssetRef, ProjectDoc } from "../doc/types";
import { createDoc } from "../doc/defaults";
import { demoAssetId, demoAssetRef } from "../lab/demo-assets";
import type { DemoSite } from "../lab/demo-assets";
import type { Template } from "./types";
import { fillSlots } from "./slots";

const desktopHero = (site: DemoSite) => demoAssetId(site, "desktop", "hero");
const desktopFull = (site: DemoSite) => demoAssetId(site, "desktop", "full");
const mobileHero = (site: DemoSite) => demoAssetId(site, "mobile", "hero");

/**
 * Demo captures per template, in slot order (fillSlots is greedy by role).
 * Multi-screen layouts use a different site per screen; responsive layouts show one
 * site across devices. Templates not listed use DEFAULT_DEMO_IDS.
 */
const DEMO_IDS_BY_TEMPLATE: Record<string, string[]> = {
  "quiet-hero": [desktopFull("aurelia")],
  "tilted-showcase": [desktopHero("maison-oak")],
  "responsive-pair": [desktopFull("northwind"), mobileHero("northwind")],
  // No second desktop capture, so the tablet reuses the full page rather than a 16:10 hero.
  "responsive-trio": [desktopFull("field-notes"), mobileHero("field-notes")],
  "phone-spotlight": [mobileHero("studio-kova")],
  "phone-parade": [
    mobileHero("aurelia"),
    mobileHero("northwind"),
    mobileHero("maison-oak"),
    mobileHero("field-notes"),
    mobileHero("studio-kova"),
  ],
  "portfolio-rows": [
    desktopHero("aurelia"),
    desktopHero("northwind"),
    desktopHero("maison-oak"),
    desktopHero("field-notes"),
  ],
  "isometric-wall": [
    desktopHero("studio-kova"),
    desktopHero("field-notes"),
    desktopHero("northwind"),
    desktopHero("aurelia"),
  ],
  "cascade-stack": [
    desktopHero("maison-oak"),
    desktopHero("studio-kova"),
    desktopHero("aurelia"),
    desktopHero("northwind"),
  ],
  "scroll-story": [desktopFull("studio-kova")],
  "launch-reel": [desktopFull("aurelia"), mobileHero("aurelia")],
  "case-study-reel": [
    desktopFull("maison-oak"),
    desktopHero("field-notes"),
    desktopHero("northwind"),
  ],
};

const DEFAULT_DEMO_IDS = [desktopFull("aurelia"), mobileHero("aurelia")];

/** Demo assets that fill the template's slots; the same set the template preview uses. */
export function demoAssetsForTemplate(templateId: string): AssetRef[] {
  const ids = DEMO_IDS_BY_TEMPLATE[templateId] ?? DEFAULT_DEMO_IDS;
  return ids.map(demoAssetRef);
}

export function buildTemplatePreviewDoc(template: Template): ProjectDoc {
  const assets = demoAssetsForTemplate(template.id);
  const slots = fillSlots(template, assets);
  const built = template.build({
    aspect: "16:9",
    slots,
    projectName: template.name,
  });

  const base = createDoc();
  return {
    ...base,
    name: template.name,
    aspect: "16:9",
    templateId: template.id,
    assets,
    style: built.style,
    shots: built.shots,
    loop: built.loop,
  };
}
