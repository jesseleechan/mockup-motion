import { createDoc, defaultShot, defaultStyle } from "../doc/defaults";
import type { AssetRef, Background, DeviceKind, ProjectDoc, TextAnimId } from "../doc/types";
import { demoAssetRef } from "./demo-assets";
import { labTestBandsId, labTestQuadrantsId } from "./test-images";

/**
 * Real demo captures with their true sizes. Phones get the mobile capture, so their portrait
 * screens fill to width instead of showing a 16:10 hero.
 */
const DESKTOP = demoAssetRef("demo-aurelia-desktop-hero");
const DESKTOP_FULL = demoAssetRef("demo-aurelia-desktop-full");
const MOBILE = demoAssetRef("demo-aurelia-mobile-hero");

function screenAssetId(device: DeviceKind): string {
  if (device === "phone") return MOBILE.id;
  return DESKTOP.id;
}

const DEVICES: DeviceKind[] = ["browser", "phone", "card"];

function stillDoc(name: string): ProjectDoc {
  const doc = createDoc({ name, loop: false, assets: [DESKTOP, DESKTOP_FULL, MOBILE] });
  doc.style = {
    ...defaultStyle(),
    grain: 0.25,
    vignette: 0.06,
    shadow: "soft",
  };
  return doc;
}

function singleShot(
  doc: ProjectDoc,
  device: DeviceKind,
  camera: ProjectDoc["shots"][number]["camera"],
) {
  const shot = defaultShot({ kind: "single", device, assetId: screenAssetId(device) });
  shot.id = `${doc.name}-shot`;
  shot.duration = 5;
  shot.camera = camera;
  shot.transitionIn = { kind: "cut", duration: 0, easing: "linear" };
  shot.texts = [];
  doc.shots = [shot];
  return shot;
}

/** Frontal (static) and tilted (settled hero tilt) stills for every device. */
export function deviceFixtures(): Record<string, ProjectDoc> {
  const out: Record<string, ProjectDoc> = {};
  for (const device of DEVICES) {
    const frontal = stillDoc(`device-${device}-frontal`);
    singleShot(frontal, device, { preset: "static", intensity: 0, easing: "linear", float: 0 });
    out[`device-${device}-frontal`] = frontal;

    const tilted = stillDoc(`device-${device}-tilted`);
    singleShot(tilted, device, { preset: "heroTilt", intensity: 1, easing: "smooth", float: 0 });
    out[`device-${device}-tilted`] = tilted;
  }
  return out;
}

const BACKGROUNDS: Record<string, Background> = {
  solid: { kind: "solid", color: "#141417" },
  gradient: { kind: "gradient", stops: ["#F1EDE6", "#E3DCD0"], angle: 290, angleConvention: "css" },
  mesh: { kind: "mesh", colors: ["#1B1B2F", "#3A2F4F", "#6B4E71", "#C3A6A0"], drift: 0.2, seed: 3 },
  ambient: { kind: "ambient", assetId: DESKTOP.id, blur: 0.55, dim: 0.35 },
  image: { kind: "image", assetId: DESKTOP.id, dim: 0.15 },
};

export function backgroundFixtures(): Record<string, ProjectDoc> {
  const out: Record<string, ProjectDoc> = {};
  for (const [name, background] of Object.entries(BACKGROUNDS)) {
    const doc = stillDoc(`bg-${name}`);
    doc.style = {
      ...doc.style,
      background,
      frameAppearance: name === "solid" || name === "mesh" ? "dark" : "light",
    };
    singleShot(doc, "browser", { preset: "static", intensity: 0, easing: "linear", float: 0 });
    out[`bg-${name}`] = doc;
  }
  return out;
}

/** Reveal animations are 0.75s; midpoint is 0.375. Typewriter midpoint for two words is 0.15. */
export const TEXT_ANIM_T: Record<string, number> = {
  fadeUp: 0.375,
  maskReveal: 0.375,
  blurIn: 0.375,
  wordStagger: 0.375,
  typewriter: 0.15,
};

const TEXT_ANIMS: TextAnimId[] = ["fadeUp", "maskReveal", "blurIn", "wordStagger", "typewriter"];

export function textAnimFixtures(): Record<string, ProjectDoc> {
  const out: Record<string, ProjectDoc> = {};
  for (const animation of TEXT_ANIMS) {
    const doc = stillDoc(`text-${animation}`);
    doc.style = {
      ...doc.style,
      background: { kind: "solid", color: "#141417" },
      frameAppearance: "dark",
      textColor: "#F4F1EA",
    };
    const shot = defaultShot({ kind: "title" });
    shot.id = `text-${animation}-shot`;
    shot.duration = 4;
    shot.camera = { preset: "static", intensity: 0, easing: "linear", float: 0 };
    shot.transitionIn = { kind: "cut", duration: 0, easing: "linear" };
    shot.texts = [
      {
        id: `text-${animation}-layer`,
        text: "Quiet studio",
        role: "title",
        font: "display",
        size: 6,
        anchor: "center",
        align: "center",
        color: "",
        animation,
        delay: 0,
      },
    ];
    doc.shots = [shot];
    out[`text-${animation}`] = doc;
  }
  return out;
}

function testAssetRef(id: string, width: number, height: number): AssetRef {
  return { id, kind: "image", name: id, mime: "image/png", bytes: 1, width, height };
}

/**
 * Quadrant sizes that fit each device screen to width without a bottom crop, so all four
 * quadrants are visible: phones are 0.46 wide, desktop screens 1.6.
 */
const QUADRANT_SIZE: Record<DeviceKind, [number, number]> = {
  browser: [1600, 1000],
  phone: [780, 1688],
  card: [1600, 1000],
};

/**
 * F01: red/green over blue/yellow quadrants on every device, frontal. An upside-down or
 * mirrored screen swaps the colours. Grain and vignette are off so the fills stay flat.
 */
export function orientationFixtures(): Record<string, ProjectDoc> {
  const out: Record<string, ProjectDoc> = {};
  for (const device of DEVICES) {
    const [width, height] = QUADRANT_SIZE[device];
    const asset = testAssetRef(labTestQuadrantsId(width, height), width, height);
    const doc = createDoc({ name: `orient-${device}`, loop: false, assets: [asset] });
    doc.style = {
      ...defaultStyle(),
      background: { kind: "solid", color: "#808080" },
      grain: 0,
      vignette: 0,
      shadow: "soft",
    };
    const shot = defaultShot({ kind: "single", device, assetId: asset.id });
    shot.id = `orient-${device}-shot`;
    shot.duration = 5;
    shot.camera = { preset: "static", intensity: 0, easing: "linear", float: 0 };
    shot.transitionIn = { kind: "cut", duration: 0, easing: "linear" };
    shot.texts = [];
    doc.shots = [shot];
    out[`orient-${device}`] = doc;
  }
  return out;
}

/** F02 source bands, top to bottom: mid grey, a saturated blue, Bone and Graphite. */
export const COLOR_BANDS = ["#808080", "#3366CC", "#F1EDE6", "#18191B"];

/** F02: the source bands on a frameless card, so the screen pixels must equal the PNG. */
export function colorFixtures(): Record<string, ProjectDoc> {
  const asset = testAssetRef(labTestBandsId(1600, 1000, COLOR_BANDS), 1600, 1000);
  const doc = createDoc({ name: "color-bands", loop: false, assets: [asset] });
  doc.style = {
    ...defaultStyle(),
    background: { kind: "solid", color: "#C9D3C4" },
    grain: 0,
    vignette: 0,
    shadow: "none",
  };
  const shot = defaultShot({ kind: "single", device: "card", assetId: asset.id });
  shot.id = "color-bands-shot";
  shot.duration = 5;
  shot.camera = { preset: "static", intensity: 0, easing: "linear", float: 0 };
  shot.transitionIn = { kind: "cut", duration: 0, easing: "linear" };
  shot.texts = [];
  doc.shots = [shot];
  return { "color-bands": doc };
}

export const VISUAL_FIXTURES: Record<string, ProjectDoc> = {
  ...deviceFixtures(),
  ...backgroundFixtures(),
  ...textAnimFixtures(),
  ...orientationFixtures(),
  ...colorFixtures(),
};
