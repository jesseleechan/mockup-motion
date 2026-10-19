import { createDoc, defaultShot, defaultStyle } from "../doc/defaults";
import type { AssetRef, ProjectDoc } from "../doc/types";
import { sanitizeDoc } from "../doc/validate";
import { loopWrapCrossfade, presetToneStyle } from "../templates/looks";
import { demoAssetId, demoAssetRef } from "./demo-assets";

/**
 * Responsive Scroll lab fixtures (docs/responsive-scroll-plan, R04): Aurelia's desktop and mobile
 * full pages as flat cards on Ash, scrolling together. `responsive-scroll-fallback` drops the
 * capture sections, so both screens use the proportional stops. Use
 * /lab?still=1&fixture=responsive-scroll&aspect=4:5&t=2.
 */
function responsiveFixture(withSections: boolean): ProjectDoc {
  const strip = (a: AssetRef): AssetRef => ({ ...a, meta: { tall: a.meta?.tall } });
  const desktop = demoAssetRef(demoAssetId("aurelia", "desktop", "full"));
  const mobile = demoAssetRef(demoAssetId("aurelia", "mobile", "full"));
  const assets = withSections ? [desktop, mobile] : [strip(desktop), strip(mobile)];
  const shot = defaultShot({ kind: "responsive", desktopId: desktop.id, mobileId: mobile.id });
  shot.scroll = { enabled: true, stops: [0, 1 / 3, 2 / 3, 1], hold: 1, easing: "smooth" };
  // A scroll can't reverse, so the loop crossfades back to the top (contracts.md §5).
  shot.transitionIn = loopWrapCrossfade();
  shot.camera = { preset: "static", intensity: 0, easing: "smooth", float: 0 };
  shot.texts = [];
  const doc: ProjectDoc = {
    ...createDoc(),
    name: withSections ? "Responsive Scroll" : "Responsive Scroll (no sections)",
    aspect: "16:9",
    assets,
    style: {
      ...defaultStyle(),
      ...presetToneStyle("light"),
      shadow: "none",
      grain: 0,
      vignette: 0,
    },
    shots: [shot],
    loop: true,
  };
  // Sets the shot length from the stops, as the editor does.
  return sanitizeDoc(doc).doc;
}

export const RESPONSIVE_FIXTURES: Record<string, ProjectDoc> = {
  "responsive-scroll": responsiveFixture(true),
  "responsive-scroll-fallback": responsiveFixture(false),
};
