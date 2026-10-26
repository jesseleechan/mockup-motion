import { expect, test, type Page } from "@playwright/test";
import type { Background, ProjectDoc } from "../../src/doc/types";
import type { Engine } from "../../src/engine/Engine";
import { avgRegion, expectRgbNear, type PixelBuffer } from "../helpers/pixels";

declare global {
  interface Window {
    __labReady?: boolean;
    __labEngine?: Engine;
    __labSetDoc?: (doc: ProjectDoc, images?: Record<string, ImageBitmap>) => Promise<void>;
    __fixtures?: Record<string, ProjectDoc>;
  }
}
// The lab draws the background alone, without the fixture's card.
const BACKGROUND_ONLY = "&devices=0";

async function ready(page: Page, extra = ""): Promise<void> {
  await page.goto(`/lab?still=1&fixture=device-card-frontal&t=0&aspect=16:9&w=1280${extra}`);
  await page.waitForFunction(() => window.__labReady === true);
}
async function background(page: Page, bg: Background, grain = 0): Promise<PixelBuffer> {
  return page.evaluate(
    async ({ bg, grain }) => {
      const doc = structuredClone(window.__fixtures?.["device-card-frontal"]);
      const engine = window.__labEngine;
      const setDoc = window.__labSetDoc;
      if (!doc || !engine || !setDoc) throw new Error("F02 fixture hooks unavailable");
      doc.loop = false;
      doc.style.background = bg;
      doc.style.grain = grain;
      doc.style.vignette = 0;
      await setDoc(doc);
      engine.renderAt(0);
      return { width: 1280, height: 720, data: engine.readPixels() };
    },
    { bg, grain },
  );
}
for (const [hex, rgb] of [
  ["#808080", [128, 128, 128]],
  ["#18191B", [24, 25, 27]],
  ["#F1EDE6", [241, 237, 230]],
] as const) {
  test(`F02 solid ${hex} preserves exact colour @smoke`, async ({ page }) => {
    await ready(page, BACKGROUND_ONLY);
    const frame = await background(page, { kind: "solid", color: hex });
    expectRgbNear(avgRegion(frame, 600, 320, 680, 400), rgb, 1);
  });
}
test("F02 constant gradient outputs linear values", async ({ page }) => {
  await ready(page, BACKGROUND_ONLY);
  const frame = await background(page, {
    kind: "gradient",
    stops: ["#3366CC", "#3366CC"],
    angle: 90,
    angleConvention: "css",
  });
  expectRgbNear(avgRegion(frame, 600, 320, 680, 400), [51, 102, 204], 1);
});
test("F02 screenshot band centres preserve RGB in source top-to-bottom order @smoke", async ({
  page,
}) => {
  await ready(page, "&cameraDistance=0.7");
  const pixels = await page.evaluate(async () => {
    const doc = structuredClone(window.__fixtures?.["device-card-frontal"]);
    const engine = window.__labEngine;
    const setDoc = window.__labSetDoc;
    const images = window.__labTestImages;
    if (!doc || !engine || !setDoc || !images) throw new Error("F02 band hooks unavailable");
    const assetId = "f02-source-bands";
    doc.shots[0].layout = { kind: "single", device: "card", assetId };
    doc.shots[0].camera = { preset: "static", intensity: 0, easing: "smooth" };
    doc.style.grain = doc.style.vignette = 0;
    doc.style.shadow = "none";
    doc.assets.push({
      id: assetId,
      kind: "image",
      name: assetId,
      mime: "image/png",
      bytes: 1,
      width: 1600,
      height: 1000,
    });
    await setDoc(doc, {
      [assetId]: await images.bands(1600, 1000, ["#808080", "#3366CC", "#F1EDE6", "#18191B"]),
    });
    engine.renderAt(0);
    return { width: 1280, height: 720, data: engine.readPixels() };
  });
  // Static card is .68 * 16/9 stage units wide; distance .7 gives 1243x777px.
  for (const [y, rgb] of [
    [69, [128, 128, 128]],
    [263, [51, 102, 204]],
    [457, [241, 237, 230]],
    [651, [24, 25, 27]],
  ] as const) {
    expectRgbNear(avgRegion(pixels, 630, y - 3, 650, y + 3), rgb, 2);
  }
});
for (const angle of [90, 180] as const) {
  test(`F02 CSS gradient ${angle} degrees runs in the correct direction`, async ({ page }) => {
    await ready(page, BACKGROUND_ONLY);
    const frame = await background(page, {
      kind: "gradient",
      stops: ["#000000", "#FFFFFF"],
      angle,
      angleConvention: "css",
    });
    const sample = (x: number, y: number) => avgRegion(frame, x, y, x + 4, y + 4)[0];
    if (angle === 90) {
      expect(sample(0, 358)).toBeLessThan(10);
      expect(sample(1276, 358)).toBeGreaterThan(245);
      expect(Math.abs(sample(638, 40) - sample(638, 676))).toBeLessThanOrEqual(1);
    } else {
      expect(sample(638, 0)).toBeLessThan(10);
      expect(sample(638, 716)).toBeGreaterThan(245);
      expect(Math.abs(sample(40, 358) - sample(1236, 358))).toBeLessThanOrEqual(1);
    }
  });
}
test("F02 grain is zero-mean monochrome, bounded and deterministic in every channel", async ({
  page,
}) => {
  await ready(page, BACKGROUND_ONLY);
  const frame = await background(page, { kind: "solid", color: "#808080" }, 0.25);
  const repeat = await page.evaluate(() => {
    if (!window.__labEngine) throw new Error("Engine unavailable");
    window.__labEngine.renderAt(0);
    return window.__labEngine.readPixels();
  });
  expect(Array.from(repeat)).toEqual(Array.from(frame.data));
  const mean = avgRegion(frame, 540, 260, 740, 460);
  for (let channel = 0; channel < 3; channel++) {
    let variance = 0;
    let monochrome = true;
    let maximum = 0;
    for (let y = 260; y < 460; y++)
      for (let x = 540; x < 740; x++) {
        const i = (y * 1280 + x) * 4;
        variance += (frame.data[i + channel] - mean[channel]) ** 2;
        monochrome &&= frame.data[i + channel] === frame.data[i];
        maximum = Math.max(maximum, Math.abs(frame.data[i + channel] - 128));
      }
    expect(monochrome).toBe(true);
    expect(maximum).toBeLessThanOrEqual(7);
    expect(mean[channel]).toBeGreaterThanOrEqual(126.5);
    expect(mean[channel]).toBeLessThanOrEqual(129.5);
    const deviation = Math.sqrt(variance / 40000);
    expect(deviation).toBeGreaterThan(1);
    expect(deviation).toBeLessThan(8);
  }
});
// The loop wrap crossfade (contracts.md §5) blends the shot's end into its start. A card
// scrolls a black-over-white screenshot from its top (black) to its bottom (white), so halfway
// through a linear 1 s wrap the screen mixes white and black 50/50 in linear light.
test("F02 loop wrap fade blends in linear light", async ({ page }) => {
  await ready(page);
  const pixels = await page.evaluate(async () => {
    const doc = structuredClone(window.__fixtures?.["device-card-frontal"]);
    const engine = window.__labEngine;
    const setDoc = window.__labSetDoc;
    const images = window.__labTestImages;
    if (!doc || !engine || !setDoc || !images) throw new Error("Fixture unavailable");
    const assetId = "f02-wrap-bands";
    doc.loop = true;
    doc.style.background = { kind: "solid", color: "#000000" };
    doc.style.grain = doc.style.vignette = 0;
    doc.style.shadow = "none";
    doc.assets.push({
      id: assetId,
      kind: "image",
      name: assetId,
      mime: "image/png",
      bytes: 1,
      width: 1600,
      height: 4000,
    });
    const shot = doc.shots[0];
    shot.layout = { kind: "single", device: "card", assetId };
    shot.camera = { preset: "static", intensity: 0, easing: "smooth" };
    // Holds the top for 2 s, scrolls 3 screens in 4 s (under 0.9 per second), holds the
    // bottom for 2 s. The loop is 7 s and the wrap fades over [6, 7).
    shot.duration = 8;
    shot.scroll = { enabled: true, stops: [0, 1], hold: 2, easing: "smooth" };
    shot.transitionIn = { kind: "fade", duration: 1, easing: "linear" };
    await setDoc(doc, { [assetId]: await images.bands(1600, 4000, ["#000000", "#FFFFFF"]) });
    engine.renderAt(6.5);
    return { width: 1280, height: 720, data: engine.readPixels() };
  });
  expectRgbNear(avgRegion(pixels, 600, 320, 680, 400), [188, 188, 188], 1);
});

test("F02 dither stays below half an sRGB byte", async ({ page }) => {
  await ready(page, BACKGROUND_ONLY);
  const frame = await background(page, { kind: "solid", color: "#808080" });
  const values = new Set<number>();
  for (let y = 260; y < 460; y++)
    for (let x = 540; x < 740; x++) values.add(frame.data[(y * 1280 + x) * 4]);
  // At an exact byte centre, bounded ±0.5 LSB cannot cross either rounding boundary.
  expect([...values]).toEqual([128]);
});

test("F02 short phone screenshot bottom fill is sRGB exact @smoke", async ({ page }) => {
  await ready(page);
  const frame = await page.evaluate(async () => {
    const doc = structuredClone(window.__fixtures?.["device-phone-frontal"]);
    const engine = window.__labEngine;
    const setDoc = window.__labSetDoc;
    const images = window.__labTestImages;
    if (!doc || !engine || !setDoc || !images) throw new Error("Fill fixture unavailable");
    const id = "f02-short-phone";
    doc.shots[0].layout = { kind: "single", device: "phone", assetId: id };
    doc.shots[0].camera = { preset: "static", intensity: 0, easing: "smooth" };
    doc.style.grain = doc.style.vignette = 0;
    doc.assets.push({
      id,
      kind: "image",
      name: id,
      mime: "image/png",
      bytes: 1,
      width: 780,
      height: 100,
    });
    await setDoc(doc, { [id]: await images.bands(780, 100, ["#3366CC"]) });
    engine.renderAt(0);
    return { width: 1280, height: 720, data: engine.readPixels() };
  });
  expectRgbNear(avgRegion(frame, 630, 510, 650, 530), [51, 102, 204], 2);
});

test("phone status bar keeps the page's top colour while the page scrolls under it", async ({
  page,
}) => {
  await ready(page);
  const frames = await page.evaluate(async () => {
    const doc = structuredClone(window.__fixtures?.["device-phone-frontal"]);
    const engine = window.__labEngine;
    const setDoc = window.__labSetDoc;
    const images = window.__labTestImages;
    if (!doc || !engine || !setDoc || !images) throw new Error("Status bar fixture unavailable");
    const id = "status-bar-tall-phone";
    doc.shots[0].layout = { kind: "single", device: "phone", assetId: id };
    doc.shots[0].camera = { preset: "static", intensity: 0, easing: "smooth" };
    doc.shots[0].duration = 10;
    doc.shots[0].scroll = { enabled: true, stops: [0, 1], hold: 0.5, easing: "smooth" };
    doc.style.grain = doc.style.vignette = 0;
    doc.assets.push({
      id,
      kind: "image",
      name: id,
      mime: "image/png",
      bytes: 1,
      width: 780,
      height: 4000,
    });
    const colors = ["#EEEEEE", "#3366CC", "#CC3366", "#33AA55"];
    await setDoc(doc, { [id]: await images.bands(780, 4000, colors) });
    engine.renderAt(0);
    const top = { width: 1280, height: 720, data: engine.readPixels() };
    engine.renderAt(10);
    return { top, end: { width: 1280, height: 720, data: engine.readPixels() } };
  });
  // The phone is 0.74 of the 720 px frame tall and centred (quality bar §3.3, §4): its screen
  // spans x 521-759 and y 103-617. Sample the status bar between the time and the island.
  const statusBar = (frame: PixelBuffer) => avgRegion(frame, 586, 119, 590, 123);
  // Scrolled to the end, the top band is far above the screen; the bar still shows its colour.
  expectRgbNear(statusBar(frames.top), [238, 238, 238], 2);
  expectRgbNear(statusBar(frames.end), [238, 238, 238], 2);
  // Below the bar, the page has scrolled to its last bands.
  const scrolled = avgRegion(frames.end, 636, 500, 644, 508) as [number, number, number];
  expect(
    scrolled[0] > 200 || scrolled[1] > 150,
    `scrolled page at the bottom, got ${scrolled}`,
  ).toBe(true);
});
