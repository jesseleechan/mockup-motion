import { createDoc, defaultShot, defaultStyle } from "../doc/defaults";
import type { ProjectDoc } from "../doc/types";
import { demoBrowserUrl } from "../templates/demo-preview";
import { loopWrapCrossfade, paletteBackground } from "../templates/looks";
import { demoAssetId, demoAssetRef } from "./demo-assets";

/**
 * Documents the engine tests use for layouts no built-in template builds any more. Saved
 * projects can still hold them, so the engine must keep rendering them. Each one matches the
 * 16:9 preview of the template it replaces.
 */

/** One desktop browser pushing in on a bone gradient; was the Quiet Hero preview. */
function singleBrowserFixture(): ProjectDoc {
  const assets = [demoAssetRef(demoAssetId("aurelia", "desktop", "full"))];
  const shot = defaultShot({ kind: "single", device: "browser", assetId: assets[0].id });
  shot.duration = 6;
  shot.transitionIn = loopWrapCrossfade();
  shot.entrance = "rise";
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

/** A browser overlapped by a phone, both showing one site; was the Responsive Pair preview. */
function pairFixture(): ProjectDoc {
  // A light site: Northwind's dark navy hero is close to the empty-screen fill.
  const assets = [
    demoAssetRef(demoAssetId("maison-oak", "desktop", "full")),
    demoAssetRef(demoAssetId("maison-oak", "mobile", "hero")),
  ];
  const shot = defaultShot({
    kind: "pair",
    arrangement: "overlap",
    desktopId: assets[0].id,
    mobileId: assets[1].id,
  });
  shot.duration = 6;
  shot.transitionIn = loopWrapCrossfade();
  shot.entrance = "stagger";
  shot.camera = { preset: "orbitRight", intensity: 0.6, easing: "smooth", float: 0.2 };
  return {
    ...createDoc(),
    name: "Pair",
    aspect: "16:9",
    assets,
    style: {
      ...defaultStyle(),
      background: paletteBackground("mist"),
      frameAppearance: "light",
      deviceFinish: "silver",
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
  pair: pairFixture(),
};
