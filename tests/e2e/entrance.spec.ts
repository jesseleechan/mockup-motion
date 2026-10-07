import { expect, test, type Page } from "@playwright/test";
import type { ProjectDoc } from "../../src/doc/types";
import { ease } from "../../src/motion/easing";
import { avgRegion, expectRgbNear, inkBounds, type PixelBuffer } from "../helpers/pixels";

// Layout entrances (quality-bar §2.5) take 0.8 s on an expoOut curve; stagger delays each
// further device by 0.1 s (src/motion/layouts).
const ENTRANCE_DURATION = 0.8;
const STAGGER_DELAY = 0.1;
const WIDTH = 1280;
const HEIGHT = 720;
const RED = [255, 0, 0] as const;
const BLUE = [0, 0, 255] as const;

type Rgb = readonly [number, number, number];

function toLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function toSrgb(v: number): number {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(1, c)) * 255);
}

/** `top` at `opacity` over `bottom`, blended in linear light like the engine's passes. */
function over(top: Rgb, opacity: number, bottom: Rgb): Rgb {
  return top.map((c, i) =>
    toSrgb(opacity * toLinear(c) + (1 - opacity) * toLinear(bottom[i])),
  ) as unknown as Rgb;
}

function entranceOpacity(t: number): number {
  return ease("expoOut", Math.max(0, Math.min(1, t / ENTRANCE_DURATION)));
}

/** The time at which an entrance that starts at `delay` reaches `opacity`. */
function timeAtOpacity(opacity: number, delay = 0): number {
  let lo = 0;
  let hi = ENTRANCE_DURATION;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (entranceOpacity(mid) < opacity) lo = mid;
    else hi = mid;
  }
  return delay + (lo + hi) / 2;
}

/** Pixels within `tolerance` of `color` on every channel, with their centroid. */
function colorRegion(px: PixelBuffer, color: Rgb, tolerance: number) {
  let count = 0;
  let sumY = 0;
  for (let i = 0; i < px.width * px.height; i++) {
    const o = i * 4;
    if (
      Math.abs(px.data[o] - color[0]) <= tolerance &&
      Math.abs(px.data[o + 1] - color[1]) <= tolerance &&
      Math.abs(px.data[o + 2] - color[2]) <= tolerance
    ) {
      count++;
      sumY += Math.floor(i / px.width);
    }
  }
  return { count, y: count > 0 ? sumY / count : NaN };
}

async function ready(page: Page): Promise<void> {
  await page.goto("/lab?fixture=device-browser-frontal&t=0&aspect=16:9");
  await page.waitForFunction(() => window.__labReady === true);
}

/**
 * Renders a non-looping browser doc (static camera unless `camera` is given) on a flat grey background at each time.
 * `layout` replaces the fixture's single layout; `colors` maps asset ids to flat screen colours.
 */
async function renderEntrance(
  page: Page,
  options: {
    layout: ProjectDoc["shots"][number]["layout"];
    entrance: ProjectDoc["shots"][number]["entrance"];
    colors: Record<string, string>;
    times: number[];
    camera?: ProjectDoc["shots"][number]["camera"];
  },
): Promise<PixelBuffer[]> {
  return page.evaluate(
    async ({ layout, entrance, colors, times, camera, width, height }) => {
      const engine = window.__labEngine;
      const setDoc = window.__labSetDoc;
      const images = window.__labTestImages;
      const doc = structuredClone(window.__fixtures?.["device-browser-frontal"]);
      if (!engine || !setDoc || !images || !doc) throw new Error("Lab hooks are unavailable");
      engine.resize(width, height);
      doc.loop = false;
      doc.style.background = { kind: "solid", color: "#808080" };
      doc.style.grain = 0;
      doc.style.vignette = 0;
      doc.shots[0].layout = layout;
      doc.shots[0].entrance = entrance;
      if (camera) doc.shots[0].camera = camera;
      const bitmaps: Record<string, ImageBitmap> = {};
      for (const [assetId, color] of Object.entries(colors)) {
        doc.assets.push({
          id: assetId,
          kind: "image",
          name: assetId,
          mime: "image/png",
          bytes: 1,
          width: 1600,
          height: 1000,
        });
        bitmaps[assetId] = await images.bands(1600, 1000, [color]);
      }
      await setDoc(doc, bitmaps);
      return times.map((t) => {
        engine.renderAt(t);
        return { width, height, data: engine.readPixels() };
      });
    },
    { ...options, width: WIDTH, height: HEIGHT },
  );
}

test("a rise entrance starts invisible, fades the whole device in as one and rises 3%", async ({
  page,
}) => {
  await ready(page);
  const half = timeAtOpacity(0.5);
  const [start, middle, settled] = await renderEntrance(page, {
    layout: { kind: "single", device: "browser", assetId: "entrance-red" },
    entrance: "rise",
    colors: { "entrance-red": "#FF0000" },
    times: [0, half, 1.5],
  });
  const background = avgRegion(settled, 8, 8, 16, 16);
  expectRgbNear(background, [128, 128, 128], 2);

  // Nothing of the device (screen, body, chrome or shadow) is drawn at t = 0.
  expect(inkBounds(start, background, 3), "the device must be invisible at t = 0").toBeNull();

  const screen = colorRegion(settled, RED, 4);
  expect(screen.count, "the settled screen must show the source colour").toBeGreaterThan(50_000);

  // Half way in, the screen is exactly half the source over the background: the body and
  // toolbar fade with it instead of showing through the screen.
  const halfColor = over(RED, entranceOpacity(half), background);
  const faded = colorRegion(middle, halfColor, 4);
  expect(faded.count, `half-opacity screen near ${halfColor.join(", ")}`).toBeGreaterThan(
    screen.count * 0.8,
  );
  expect(colorRegion(middle, RED, 4).count, "no part of the screen is opaque yet").toBe(0);

  // The device rises into place: half way in it sits 0.03 × (1 − 0.5) of the frame lower.
  const drop = faded.y - screen.y;
  expect(drop, "the half-way screen sits lower than the settled one").toBeGreaterThan(
    HEIGHT * 0.03 * 0.5 * 0.6,
  );
  expect(drop).toBeLessThan(HEIGHT * 0.03 * 0.5 * 1.4);
});

test("a staggered stack composites each fading device over the ones behind it", async ({
  page,
}) => {
  await ready(page);
  // The front device (index 2) is half way in; the two behind it are further along.
  const t = timeAtOpacity(0.5, 2 * STAGGER_DELAY);
  const [start, middle, settled] = await renderEntrance(page, {
    layout: {
      kind: "stack",
      device: "browser",
      assetIds: ["stack-back", "stack-middle", "stack-front"],
      spread: 0.5,
    },
    entrance: "stagger",
    colors: { "stack-back": "#0000FF", "stack-middle": "#0000FF", "stack-front": "#FF0000" },
    times: [0, t, 1.5],
  });
  const background = avgRegion(settled, 8, 8, 16, 16);
  expect(inkBounds(start, background, 3), "the stack must be invisible at t = 0").toBeNull();

  const front = colorRegion(settled, RED, 4);
  expect(front.count, "the settled front screen must show the source colour").toBeGreaterThan(
    50_000,
  );

  // Where the front screen covers both blue screens, the expected colour is each layer over
  // the one behind it, back to front.
  const back = over(BLUE, entranceOpacity(t), background);
  const behindFront = over(BLUE, entranceOpacity(t - STAGGER_DELAY), back);
  const expected = over(RED, entranceOpacity(t - 2 * STAGGER_DELAY), behindFront);
  const overlap = colorRegion(middle, expected, 4);
  expect(overlap.count, `front over both screens near ${expected.join(", ")}`).toBeGreaterThan(
    front.count * 0.3,
  );
});

test("a fading phone stays in front of the browser it overlaps under an orbiting camera", async ({
  page,
}) => {
  await ready(page);
  // Under responsive-pair's orbit the browser's centre is nearer the camera than the phone's,
  // although the phone overlaps the browser in front (quality-bar §4), so draw order must
  // come from the layout, not from the centres' depth.
  const t = timeAtOpacity(0.5, STAGGER_DELAY);
  const [middle, settled] = await renderEntrance(page, {
    layout: {
      kind: "pair",
      desktopId: "pair-desktop",
      mobileId: "pair-phone",
      arrangement: "overlap",
    },
    entrance: "stagger",
    camera: { preset: "orbitRight", intensity: 0.6, easing: "smooth", float: 0 },
    colors: { "pair-desktop": "#0000FF", "pair-phone": "#FF0000" },
    times: [t, 1.5],
  });
  const background = avgRegion(settled, 8, 8, 16, 16);
  const phone = colorRegion(settled, RED, 4);
  expect(phone.count, "the settled phone screen must show the source colour").toBeGreaterThan(
    10_000,
  );

  const desktop = over(BLUE, entranceOpacity(t), background);
  const expected = over(RED, entranceOpacity(t - STAGGER_DELAY), desktop);
  const overlap = colorRegion(middle, expected, 4);
  expect(overlap.count, `phone over the browser near ${expected.join(", ")}`).toBeGreaterThan(
    phone.count * 0.3,
  );
});
