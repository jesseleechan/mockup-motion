import { expect, test, type Page } from "@playwright/test";
import { differenceCiede2000, type Rgb as CuloriRgb } from "culori";
import type { Aspect, AssetRef, Layout, ProjectDoc } from "../../src/doc/types";
import { framesDuration, resolveLayout, type LayoutNode } from "../../src/motion";
import { mobileFramesLayout } from "../../src/templates/frames-template";
import { avgRegion, expectRgbNear, type PixelBuffer } from "../helpers/pixels";

// Frames plan PF03: Mobile Frames draws each mobile screenshot colour-exact on a portrait card,
// fitted to the card's width and never cropped horizontally (quality bar §3.4, §4).

// The Ash background of the Frames presets (quality bar §6).
const ASH = [223, 225, 227] as const;

type Rgb = readonly [number, number, number];
type ColumnsLayout = Extract<Layout, { kind: "columns" }>;

/** A test screenshot: one flat colour, or the edge-marks image used for the width fit. */
interface ImageSpec {
  id: string;
  width: number;
  height: number;
  color?: Rgb;
}

interface Frame {
  aspect: Aspect;
  width: number;
  height: number;
}

const FRAMES: Frame[] = [
  { aspect: "4:5", width: 1200, height: 1500 },
  { aspect: "16:9", width: 1600, height: 900 },
];

// Four flat colours, none close to the background or to each other.
const COLOURS: Rgb[] = [
  [51, 102, 204],
  [138, 30, 58],
  [46, 125, 50],
  [242, 169, 59],
];
const MOBILE = { width: 780, height: 1688 };
const FLAT: ImageSpec[] = COLOURS.map((color, i) => ({ id: `mobile-flat-${i}`, ...MOBILE, color }));

function assetRef(spec: ImageSpec): AssetRef {
  return {
    id: spec.id,
    kind: "image",
    name: spec.id,
    mime: "image/png",
    bytes: 1,
    width: spec.width,
    height: spec.height,
    role: "mobile",
  };
}

function hex(rgb: Rgb): string {
  return `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function deltaE(a: readonly number[], b: readonly number[]): number {
  const rgb = (c: readonly number[]): CuloriRgb => ({
    mode: "rgb",
    r: c[0] / 255,
    g: c[1] / 255,
    b: c[2] / 255,
  });
  return differenceCiede2000()(rgb(a), rgb(b));
}

/** The node's on-screen box in pixels. Stage height = the frame's height in pixels. */
function box(frame: Frame, node: LayoutNode) {
  const w = node.width * node.transform.scale * frame.height;
  const h = node.height * node.transform.scale * frame.height;
  const cx = frame.width / 2 + node.transform.x * frame.height;
  const cy = frame.height / 2 - node.transform.y * frame.height;
  return { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2, cx, cy, w, h };
}

async function ready(page: Page): Promise<void> {
  await page.goto("/lab?fixture=mobile-frames-4x5&t=0&aspect=4:5");
  await page.waitForFunction(() => window.__labReady === true);
}

function layoutFor(frame: Frame, images: ImageSpec[]): { layout: ColumnsLayout; duration: number } {
  const layout = mobileFramesLayout(
    frame.aspect,
    images.map((i) => i.id),
  );
  return { layout, duration: Math.max(15, framesDuration(layout, frame.aspect)) };
}

/** Renders the Mobile Frames fixture at the frame's aspect with `images` as its screenshots. */
async function render(page: Page, frame: Frame, images: ImageSpec[], t: number) {
  const { layout, duration } = layoutFor(frame, images);
  const pixels = await page.evaluate(
    async ({ frame, layout, duration, images, assets, t }) => {
      const engine = window.__labEngine;
      const setDoc = window.__labSetDoc;
      const testImages = window.__labTestImages;
      const fixture = `mobile-frames-${frame.aspect.replace(":", "x")}`;
      const doc = structuredClone(window.__fixtures?.[fixture]);
      if (!engine || !setDoc || !testImages || !doc) throw new Error("Lab hooks are unavailable");
      engine.resize(frame.width, frame.height);
      doc.aspect = frame.aspect;
      doc.assets = assets;
      doc.shots[0].layout = layout;
      doc.shots[0].duration = duration;
      const bitmaps: Record<string, ImageBitmap> = {};
      for (const spec of images) {
        if (spec.color) {
          bitmaps[spec.id] = await testImages.bands(spec.width, spec.height, [spec.hex]);
          continue;
        }
        // White with a red top band, a green left column and a blue right column, each 10%
        // of the width or 5% of the height, so orientation and horizontal crop both show.
        const canvas = new OffscreenCanvas(spec.width, spec.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("2D canvas context unavailable");
        const band = Math.round(spec.height * 0.05);
        const column = Math.round(spec.width * 0.1);
        context.fillStyle = "#FFFFFF";
        context.fillRect(0, 0, spec.width, spec.height);
        context.fillStyle = "#FF0000";
        context.fillRect(0, 0, spec.width, band);
        context.fillStyle = "#00FF00";
        context.fillRect(0, band, column, spec.height - band);
        context.fillStyle = "#0000FF";
        context.fillRect(spec.width - column, band, column, spec.height - band);
        bitmaps[spec.id] = await createImageBitmap(canvas);
      }
      await setDoc(doc, bitmaps);
      engine.renderAt(t);
      return { width: frame.width, height: frame.height, data: engine.readPixels() };
    },
    {
      frame,
      layout,
      duration,
      images: images.map((spec) => ({ ...spec, hex: spec.color ? hex(spec.color) : "" })),
      assets: images.map(assetRef),
      t,
    },
  );
  const nodes = resolveLayout(layout, frame.aspect, images.map(assetRef), t, duration);
  return { pixels: pixels as PixelBuffer, nodes };
}

for (const frame of FRAMES) {
  test(`every Mobile Frames card is colour-exact at ${frame.aspect}`, async ({ page }) => {
    await ready(page);
    const { pixels, nodes } = await render(page, frame, FLAT, 0);
    // The background shows in the gap between the first two columns, top to bottom.
    const columnBox = (c: number) =>
      box(
        frame,
        nodes.find((n) => n.id.startsWith(`col${c}:`))!,
      );
    const gapX = (columnBox(0).x1 + columnBox(1).x0) / 2;
    for (const y of [0.1, 0.5, 0.9]) {
      const gapY = y * frame.height;
      expectRgbNear(avgRegion(pixels, gapX - 4, gapY - 4, gapX + 4, gapY + 4), ASH, 2);
    }

    // Every card whose centre patch is inside the frame, outer 4:5 columns included.
    let checked = 0;
    for (const node of nodes) {
      const card = box(frame, node);
      const x = Math.round(card.cx);
      const y = Math.round(card.cy);
      if (x < 12 || x > frame.width - 12 || y < 12 || y > frame.height - 12) continue;
      const expected = FLAT.find((spec) => spec.id === node.assetId)?.color;
      if (!expected) throw new Error(`${node.id} has no test colour (${node.assetId})`);
      const colour = avgRegion(pixels, x - 10, y - 10, x + 10, y + 10);
      expect(
        deltaE(colour, expected),
        `${frame.aspect} ${node.id} centre ${colour.map((c) => c.toFixed(1)).join(", ")}`,
      ).toBeLessThan(1);
      checked++;
    }
    // At least one card per column (3 at 4:5, 5 at 16:9).
    expect(checked).toBeGreaterThanOrEqual(frame.aspect === "4:5" ? 3 : 5);
  });
}

test("a Mobile Frames card shows a full-page capture's whole width, top row first", async ({
  page,
}) => {
  await ready(page);
  const frame = FRAMES[0];
  // A 780 × 3000 full-page capture, much taller than the card: fitted to width, cropped at the
  // bottom. Fitted to height it would lose most of its width.
  const images: ImageSpec[] = [{ id: "mobile-marks", width: 780, height: 3000 }, ...FLAT.slice(1)];
  const { pixels, nodes } = await render(page, frame, images, 0);
  // The marks card in the middle column whose top edge is furthest inside the frame.
  const marks = nodes
    .filter((n) => n.assetId === "mobile-marks" && Math.abs(n.transform.x) < 1e-9)
    .map((n) => box(frame, n))
    .filter((card) => card.y0 > 4 && card.y0 + card.w < frame.height - 4)
    .sort((a, b) => Math.abs(a.cy - frame.height / 2) - Math.abs(b.cy - frame.height / 2));
  const card = marks[0];
  if (!card) throw new Error("No middle-column marks card with its top inside the frame");

  // The red band is 0.19 card widths tall on the card; sample inside it, clear of the edge.
  const top = avgRegion(
    pixels,
    card.cx - 10,
    card.y0 + card.w * 0.06,
    card.cx + 10,
    card.y0 + card.w * 0.06 + 6,
  );
  expectRgbNear(top, [255, 0, 0], 3);

  // Across a row inside the screenshot, green and blue each fill 10% of the card's width from
  // its left and right edges: the screenshot is fitted to width, not cropped.
  const y = Math.round(card.y0 + card.w * 0.5);
  const run = (match: (r: number, g: number, b: number) => boolean) => {
    let first = -1;
    let last = -1;
    for (let x = Math.floor(card.x0); x <= Math.ceil(card.x1); x++) {
      const i = (y * frame.width + x) * 4;
      if (match(pixels.data[i], pixels.data[i + 1], pixels.data[i + 2])) {
        if (first < 0) first = x;
        last = x;
      }
    }
    return { first, last, width: last - first + 1 };
  };
  const green = run((r, g, b) => g > 200 && r < 60 && b < 60);
  const blue = run((r, g, b) => b > 200 && r < 60 && g < 60);
  const column = card.w * 0.1;
  expect(Math.abs(green.first - card.x0), "green starts at the card's left edge").toBeLessThan(3);
  expect(Math.abs(blue.last - card.x1), "blue ends at the card's right edge").toBeLessThan(3);
  expect(Math.abs(green.width - column), `green width ${green.width} vs ${column}`).toBeLessThan(4);
  expect(Math.abs(blue.width - column), `blue width ${blue.width} vs ${column}`).toBeLessThan(4);
});

test("a Mobile Frames card's corners are rounded at 7.5% of its width", async ({ page }) => {
  await ready(page);
  const frame = FRAMES[0];
  const { pixels, nodes } = await render(page, frame, FLAT, 0);
  // A middle-column card with its top edge inside the frame.
  const node = nodes.find((n) => {
    const card = box(frame, n);
    return Math.abs(n.transform.x) < 1e-9 && card.y0 > 4 && card.y0 + card.w < frame.height;
  });
  if (!node) throw new Error("No middle-column card with its top inside the frame");
  const card = box(frame, node);
  const colour = FLAT.find((spec) => spec.id === node.assetId)!.color!;
  const radius = card.w * 0.075;
  // On the corner's diagonal, the arc is 0.29 r in from each edge. At 0.12 r the point is
  // outside it (background); at 0.5 r it is inside (the screenshot). With the landscape
  // radius of 1.6% both points would be inside the card.
  const sample = (a: number) =>
    avgRegion(pixels, card.x0 + a - 1, card.y0 + a - 1, card.x0 + a + 1, card.y0 + a + 1);
  expectRgbNear(sample(radius * 0.12), ASH, 3);
  expectRgbNear(sample(radius * 0.5), colour, 3);
  const sampleRight = (a: number) =>
    avgRegion(pixels, card.x1 - a - 1, card.y0 + a - 1, card.x1 - a + 1, card.y0 + a + 1);
  expectRgbNear(sampleRight(radius * 0.12), ASH, 3);
  expectRgbNear(sampleRight(radius * 0.5), colour, 3);
});
