import { createDoc, defaultShot, defaultStyle } from "../doc/defaults";
import type { Aspect, CameraMove, ProjectDoc } from "../doc/types";
import { demoBrowserUrl } from "../templates/demo-preview";
import { loopWrapCrossfade, paletteBackground, paletteTextColor } from "../templates/looks";
import { demoAssetId, demoAssetRef, type DemoSite } from "./demo-assets";

/**
 * Documents the engine tests use for layouts no built-in template builds any more. Saved
 * projects can still hold them, so the engine must keep rendering them. Each one matches the
 * preview of the template it replaces.
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

const STATIC_CAMERA: CameraMove = { preset: "static", intensity: 0, easing: "smooth", float: 0 };

const desktopHeroes = (sites: DemoSite[]) =>
  sites.map((site) => demoAssetRef(demoAssetId(site, "desktop", "hero")));

const isPortrait = (aspect: Aspect) => aspect === "9:16" || aspect === "4:5";

/**
 * Dark browser windows in alternating marquee rows tilted 8°, on a graphite gradient; was the
 * Portfolio Rows preview. Like the template, it has 3 rows at 9:16 and 4:5 and 2 elsewhere.
 */
function rowsBrowserTiltedFixture(aspect: Aspect = "9:16"): ProjectDoc {
  const assets = desktopHeroes(["aurelia", "northwind", "maison-oak", "field-notes"]);
  const shot = defaultShot({
    kind: "rows",
    rows: isPortrait(aspect) ? 3 : 2,
    device: "browser",
    tilt: 8,
    speed: 0.35,
    assetIds: assets.map((a) => a.id),
  });
  shot.duration = 8;
  shot.transitionIn = loopWrapCrossfade();
  shot.camera = STATIC_CAMERA;
  return {
    ...createDoc(),
    name: "Tilted browser rows",
    aspect,
    assets,
    style: {
      ...defaultStyle(),
      background: paletteBackground("graphite"),
      textColor: paletteTextColor("graphite"),
      frameAppearance: "dark",
      shadow: "soft",
      deviceFinish: "graphite",
      browserUrl: demoBrowserUrl(assets),
    },
    shots: [shot],
    loop: true,
  };
}

/**
 * Graphite phones in counterflowing columns tilted 12°, on a fog gradient; was the Phone Parade
 * preview. Like the template, it has 2 columns at 9:16 and 4:5 and 3 elsewhere.
 */
function columnsPhoneTiltedFixture(aspect: Aspect = "9:16"): ProjectDoc {
  const sites: DemoSite[] = ["aurelia", "northwind", "maison-oak", "field-notes", "studio-kova"];
  const assets = sites.map((site) => demoAssetRef(demoAssetId(site, "mobile", "hero")));
  const shot = defaultShot({
    kind: "columns",
    columns: isPortrait(aspect) ? 2 : 3,
    tilt: 12,
    speed: 0.4,
    assetIds: assets.map((a) => a.id),
  });
  shot.duration = 8;
  shot.transitionIn = loopWrapCrossfade();
  shot.camera = STATIC_CAMERA;
  return {
    ...createDoc(),
    name: "Tilted phone columns",
    aspect,
    assets,
    style: {
      ...defaultStyle(),
      background: paletteBackground("fog"),
      textColor: "",
      frameAppearance: "light",
      shadow: "soft",
      deviceFinish: "graphite",
      browserUrl: demoBrowserUrl(assets),
    },
    shots: [shot],
    loop: true,
  };
}

/** Card frames on one tilted plane under an iso drift camera, on bone; was the Isometric Wall preview. */
function wallIsometricFixture(aspect: Aspect = "16:9"): ProjectDoc {
  const assets = desktopHeroes(["studio-kova", "field-notes", "northwind", "aurelia"]);
  const shot = defaultShot({
    kind: "wall",
    columns: 4,
    speed: 0.3,
    assetIds: assets.map((a) => a.id),
  });
  shot.duration = 8;
  shot.transitionIn = loopWrapCrossfade();
  shot.camera = { preset: "isoDrift", intensity: 0.5, easing: "smooth", float: 0 };
  return {
    ...createDoc(),
    name: "Isometric wall",
    aspect,
    assets,
    style: {
      ...defaultStyle(),
      background: paletteBackground("bone"),
      frameAppearance: "light",
      shadow: "soft",
      browserChrome: "standard",
      browserUrl: demoBrowserUrl(assets),
    },
    shots: [shot],
    loop: true,
  };
}

/** Fixtures whose composition depends on the aspect, as the template they replace did. */
const BY_ASPECT: Record<string, (aspect: Aspect) => ProjectDoc> = {
  "rows-browser-tilted": rowsBrowserTiltedFixture,
  "columns-phone-tilted": columnsPhoneTiltedFixture,
  "wall-isometric": wallIsometricFixture,
};

export const LAYOUT_FIXTURES: Record<string, ProjectDoc> = {
  "single-browser": singleBrowserFixture(),
  pair: pairFixture(),
  "rows-browser-tilted": rowsBrowserTiltedFixture(),
  "columns-phone-tilted": columnsPhoneTiltedFixture(),
  "wall-isometric": wallIsometricFixture(),
};

/** A layout fixture composed for `aspect`. */
export function layoutFixture(id: string, aspect: Aspect): ProjectDoc {
  const build = BY_ASPECT[id];
  if (build) return build(aspect);
  const fixture = LAYOUT_FIXTURES[id];
  if (!fixture) throw new Error(`Unknown layout fixture: ${id}`);
  return { ...structuredClone(fixture), aspect };
}
