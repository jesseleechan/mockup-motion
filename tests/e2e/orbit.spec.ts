import { expect, test, type Page } from "@playwright/test";
import { differenceCiede2000, type Rgb as CuloriRgb } from "culori";
import type { Aspect, AssetRef, Layout } from "../../src/doc/types";
import { resolveOrbitLayout, sliderDuration, type LayoutNode } from "../../src/motion";
import { avgRegion, expectRgbNear, type PixelBuffer } from "../helpers/pixels";

// Orbit plan (docs/orbit-plan/README.md): the front card is colour-exact, and every other card is
// mixed with the background, never with the cards behind it (quality bar §3.1, §4).

// The Ash background of the flat presets (quality bar §6).
const ASH = [223, 225, 227] as const;

type Rgb = readonly [number, number, number];
type OrbitLayout = Extract<Layout, { kind: "orbit" }>;
type Shape = OrbitLayout["shape"];

interface Frame {
  aspect: Aspect;
  width: number;
  height: number;
}

const FRAMES: Frame[] = [
  { aspect: "4:5", width: 1200, height: 1500 },
  { aspect: "16:9", width: 1600, height: 900 },
];

// Six flat colours, none close to the background or to each other.
const COLOURS: Rgb[] = [
  [51, 102, 204],
  [138, 30, 58],
  [46, 125, 50],
  [242, 169, 59],
  [20, 20, 24],
  [120, 70, 200],
];
const SIZE: Record<Shape, { width: number; height: number }> = {
  mobile: { width: 780, height: 1688 },
  desktop: { width: 2880, height: 1800 },
};

function assets(shape: Shape, n: number): AssetRef[] {
  return COLOURS.slice(0, n).map((_, i) => ({
    id: `${shape}-flat-${i}`,
    kind: "image",
    name: `${shape} ${i}`,
    mime: "image/png",
    bytes: 1,
    ...SIZE[shape],
    role: shape,
  }));
}

const colourOf = (assetId: string | null): Rgb => COLOURS[Number(assetId?.split("-").pop())];

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

/** Whether (x, y) is inside the card with `margin` px to spare, clear of its rounded corners. */
function inside(card: ReturnType<typeof box>, x: number, y: number, margin: number): boolean {
  const corner = card.w * 0.075 + margin;
  const inX = x > card.x0 + margin && x < card.x1 - margin;
  const inY = y > card.y0 + margin && y < card.y1 - margin;
  const nearCornerX = x < card.x0 + corner || x > card.x1 - corner;
  const nearCornerY = y < card.y0 + corner || y > card.y1 - corner;
  return inX && inY && !(nearCornerX && nearCornerY);
}

/** Whether (x, y) is within 6 px of the card's rectangle, rounded corners included. */
function near6(card: ReturnType<typeof box>, x: number, y: number): boolean {
  return x > card.x0 - 6 && x < card.x1 + 6 && y > card.y0 - 6 && y < card.y1 + 6;
}

/** A colour mixed with Ash as encoded sRGB values, as the slider reference fades (§3.1). */
function overAsh(colour: Rgb, strength: number): Rgb {
  return colour.map((c, i) => ASH[i] + (c - ASH[i]) * strength) as unknown as Rgb;
}

async function ready(page: Page): Promise<void> {
  await page.goto("/lab?fixture=mobile-orbit&t=0&aspect=4:5");
  await page.waitForFunction(() => window.__labReady === true);
}

/** Renders the orbit preset at the frame's aspect with `n` flat-colour screenshots. */
async function render(page: Page, frame: Frame, shape: Shape, n: number, t: number) {
  const refs = assets(shape, n);
  const layout: OrbitLayout = { kind: "orbit", assetIds: refs.map((a) => a.id), shape, step: 2 };
  const pixels = await page.evaluate(
    async ({ frame, layout, duration, refs, colours, t }) => {
      const engine = window.__labEngine;
      const setDoc = window.__labSetDoc;
      const testImages = window.__labTestImages;
      const doc = structuredClone(window.__fixtures?.[`${layout.shape}-orbit`]);
      if (!engine || !setDoc || !testImages || !doc) throw new Error("Lab hooks are unavailable");
      engine.resize(frame.width, frame.height);
      doc.aspect = frame.aspect;
      doc.assets = refs;
      doc.shots[0].layout = layout;
      doc.shots[0].duration = duration;
      const bitmaps: Record<string, ImageBitmap> = {};
      for (const [i, ref] of refs.entries()) {
        bitmaps[ref.id] = await testImages.bands(ref.width!, ref.height!, [colours[i]]);
      }
      await setDoc(doc, bitmaps);
      engine.renderAt(t);
      return { width: frame.width, height: frame.height, data: engine.readPixels() };
    },
    { frame, layout, duration: sliderDuration(layout), refs, colours: COLOURS.map(hex), t },
  );
  const nodes = resolveOrbitLayout(layout, frame.aspect, refs, t);
  return { pixels: pixels as PixelBuffer, nodes };
}

for (const shape of ["desktop", "mobile"] as const) {
  for (const frame of FRAMES) {
    test(`the ${shape} orbit's front card is colour-exact at ${frame.aspect}`, async ({ page }) => {
      await ready(page);
      const { pixels, nodes } = await render(page, frame, shape, 5, 0);
      const front = nodes.find((n) => n.opacity === 1)!;
      const card = box(frame, front);
      for (const [fx, fy] of [
        [0.5, 0.5],
        [0.2, 0.8],
        [0.8, 0.8],
      ]) {
        const x = card.x0 + fx * card.w;
        const y = card.y0 + fy * card.h;
        const colour = avgRegion(pixels, x - 6, y - 6, x + 6, y + 6);
        expect(deltaE(colour, colourOf(front.assetId)), `${front.id} at ${fx}, ${fy}`).toBeLessThan(
          1,
        );
      }
      // Outside the ring the frame is the flat background.
      expectRgbNear(avgRegion(pixels, 4, 4, 14, 14), ASH, 2);
    });
  }
}

// Desktop with 5 screenshots overlaps its side cards on the back ones; Mobile needs 6 for its side
// cards to overlap. Mid-step (t = 0.8 s) every card has its own strength.
for (const [shape, n] of [
  ["desktop", 5],
  ["mobile", 6],
] as const) {
  for (const t of [0, 0.8]) {
    test(`${shape} orbit cards mix with the background, not with the cards behind (t = ${t})`, async ({
      page,
    }) => {
      await ready(page);
      const frame = FRAMES[0];
      const { pixels, nodes } = await render(page, frame, shape, n, t);
      const boxes = nodes.map((node) => ({ node, card: box(frame, node) }));
      let overlapped = 0;
      let single = 0;
      for (let y = 20; y < frame.height - 20; y += 6) {
        for (let x = 20; x < frame.width - 20; x += 6) {
          // Skip points near any card's edge, where the antialiased edge mixes colours.
          const near = boxes.filter(({ card }) => near6(card, x, y));
          if (near.some(({ card }) => !inside(card, x, y, 6))) continue;
          const covering = near;
          if (covering.length === 0) continue;
          const top = covering.reduce((a, b) => (b.node.depthOrder > a.node.depthOrder ? b : a));
          if (top.node.opacity === 1) continue;
          const expected = overAsh(colourOf(top.node.assetId), top.node.opacity);
          const colour = avgRegion(pixels, x - 2, y - 2, x + 2, y + 2);
          const where = `${top.node.id} over ${covering.length - 1} card(s) at ${x}, ${y}`;
          const off = Math.max(...colour.map((c, i) => Math.abs(c - expected[i])));
          expect(
            off,
            `${where}: ${colour.map((c) => c.toFixed(0))} vs ${expected.map((c) => c.toFixed(0))}`,
          ).toBeLessThanOrEqual(3);
          if (covering.length > 1) overlapped++;
          else single++;
        }
      }
      // The test must look at faded cards that overlap another card, and at some that don't.
      expect(overlapped, "points where a faded card covers another").toBeGreaterThan(10);
      expect(single, "points on a faded card alone").toBeGreaterThan(10);
    });
  }
}
