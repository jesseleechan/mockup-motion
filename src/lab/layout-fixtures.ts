import { createDoc, defaultShot, defaultStyle } from "../doc/defaults";
import type { Aspect, ProjectDoc } from "../doc/types";
import { demoBrowserUrl } from "../templates/demo-preview";
import { loopWrapCrossfade, paletteBackground } from "../templates/looks";
import { demoAssetId, demoAssetRef } from "./demo-assets";

/**
 * Documents the engine tests use for looks no built-in template builds: a single browser with a
 * camera move and a wrap crossfade. It matches the preview of the template it replaces.
 */

/** One desktop browser pushing in on a bone gradient; was the Quiet Hero preview. */
function singleBrowserFixture(): ProjectDoc {
  const assets = [demoAssetRef(demoAssetId("aurelia", "desktop", "full"))];
  const shot = defaultShot({ kind: "single", device: "browser", assetId: assets[0].id });
  shot.duration = 6;
  shot.transitionIn = loopWrapCrossfade();
  shot.camera = { preset: "pushIn", intensity: 0.7, easing: "smooth", float: 0.1 };
  return {
    ...createDoc(),
    name: "Single browser",
    aspect: "16:9",
    assets,
    style: {
      ...defaultStyle(),
      background: paletteBackground("bone", 160),
      frameAppearance: "light",
      shadow: "soft",
      browserChrome: "standard",
      browserUrl: demoBrowserUrl(assets),
    },
    shots: [shot],
    loop: true,
  };
}

export const LAYOUT_FIXTURES: Record<string, ProjectDoc> = {
  "single-browser": singleBrowserFixture(),
};

/** A layout fixture composed for `aspect`. */
export function layoutFixture(id: string, aspect: Aspect): ProjectDoc {
  const fixture = LAYOUT_FIXTURES[id];
  if (!fixture) throw new Error(`Unknown layout fixture: ${id}`);
  return { ...structuredClone(fixture), aspect };
}
