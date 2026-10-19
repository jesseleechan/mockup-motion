import { expect, test, type Page } from "@playwright/test";
import { differenceCiede2000, type Rgb as CuloriRgb } from "culori";
import type { AssetRef, Layout } from "../../src/doc/types";
import { resolveLayout, sliderDuration, type LayoutNode } from "../../src/motion";
import { avgRegion, type PixelBuffer } from "../helpers/pixels";

// Stack plan S02: the deck draws every settled card colour-exact, in front-to-back order, and
// fades its entering card in linear light (quality bar §3.1, §4).

// A 4:5 frame. Stage height = HEIGHT px.
const WIDTH = 1200;
const HEIGHT = 1500;
const ASH = [223, 225, 227] as const;

type Rgb = readonly [number, number, number];
type SliderLayout = Extract<Layout, { kind: "slider" }>;

const FRONT: Rgb = [51, 102, 204];
const SECOND: Rgb = [138, 30, 58];
const THIRD: Rgb = [40, 140, 90];
const ENTERING: Rgb = [20, 20, 24];
const COLOURS = [FRONT, SECOND, THIRD, ENTERING];

const IMAGES = COLOURS.map((colour, i) => ({ id: `deck-${i}`, width: 780, height: 1688, colour }));

function hex(rgb: Rgb): string {
  return `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function assetRef(image: (typeof IMAGES)[number]): AssetRef {
  return {
    id: image.id,
    kind: "image",
    name: image.id,
    mime: "image/png",
    bytes: 1,
    width: image.width,
    height: image.height,
    role: "mobile",
  };
}

const toLinear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const toSrgb = (l: number) => 255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055);

/** `top` at `opacity` over `bottom`, blended in linear light like an entrance. */
function overLinear(top: Rgb, opacity: number, bottom: Rgb): Rgb {
  return top.map((c, i) =>
    toSrgb(opacity * toLinear(c) + (1 - opacity) * toLinear(bottom[i])),
  ) as unknown as Rgb;
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

/** The node's on-screen box in pixels at its current scale. */
function box(node: LayoutNode) {
  const w = node.width * node.transform.scale * HEIGHT;
  const cx = WIDTH / 2 + node.transform.x * HEIGHT;
  const cy = HEIGHT / 2 - node.transform.y * HEIGHT;
  return { x0: cx - w / 2, x1: cx + w / 2, cx, cy, w };
}

/** The mean colour of a 16 × 16 px patch centred at (x, y). */
function patch(px: PixelBuffer, x: number, y: number): [number, number, number] {
  return avgRegion(px, Math.round(x - 8), Math.round(y - 8), Math.round(x + 8), Math.round(y + 8));
}

const LAYOUT: SliderLayout = {
  kind: "slider",
  assetIds: IMAGES.map((i) => i.id),
  axis: "x",
  shape: "mobile",
  step: 2,
  arrangement: "deck",
};

function nodesAt(t: number): (assetId: string) => LayoutNode {
  const nodes = resolveLayout(LAYOUT, "4:5", IMAGES.map(assetRef), t, sliderDuration(LAYOUT));
  return (assetId) => {
    const node = nodes.find((n) => n.assetId === assetId);
    if (!node) throw new Error(`No card for ${assetId}`);
    return node;
  };
}

async function renderDeck(page: Page, times: number[]): Promise<PixelBuffer[]> {
  await page.goto("/lab?fixture=deck-x&t=0&aspect=4:5");
  await page.waitForFunction(() => window.__labReady === true);
  return page.evaluate(
    async ({ layout, images, assets, times, width, height }) => {
      const engine = window.__labEngine;
      const setDoc = window.__labSetDoc;
      const testImages = window.__labTestImages;
      const doc = structuredClone(window.__fixtures?.["deck-x"]);
      if (!engine || !setDoc || !testImages || !doc) throw new Error("Lab hooks are unavailable");
      engine.resize(width, height);
      doc.assets = assets;
      doc.shots[0].layout = layout;
      doc.shots[0].duration = layout.assetIds.length * layout.step;
      const bitmaps: Record<string, ImageBitmap> = {};
      for (const image of images) {
        bitmaps[image.id] = await testImages.bands(image.width, image.height, [image.colour]);
      }
      await setDoc(doc, bitmaps);
      return times.map((t) => {
        engine.renderAt(t);
        return { width, height, data: engine.readPixels() };
      });
    },
    {
      layout: LAYOUT,
      images: IMAGES.map((i) => ({
        id: i.id,
        width: i.width,
        height: i.height,
        colour: hex(i.colour),
      })),
      assets: IMAGES.map(assetRef),
      times,
      width: WIDTH,
      height: HEIGHT,
    },
  );
}

// One test (CLAUDE.md, Tests): the settled pose at t = 0 and the entering card's fade at t = 1.
test("deck cards are colour-exact in order, and the entering card fades in linear light", async ({
  page,
}) => {
  const [settled, mid] = await renderDeck(page, [0, 1]);
  const node = nodesAt(0);
  const cards = [0, 1, 2].map((i) => box(node(IMAGES[i].id)));
  // The front card's centre, where the cards behind it overlap it.
  const front = patch(settled, cards[0].cx, cards[0].cy);
  expect(deltaE(front, FRONT), `front ${front.map((c) => c.toFixed(1))}`).toBeLessThan(1);
  // Each card behind at full colour (D1), in the strip that peeks past the card in front.
  for (const r of [1, 2]) {
    const x = (cards[r - 1].x1 + cards[r].x1) / 2;
    const colour = patch(settled, x, cards[r].cy);
    expect(deltaE(colour, COLOURS[r]), `slot ${r} ${colour.map((c) => c.toFixed(1))}`).toBeLessThan(
      1,
    );
  }

  const later = nodesAt(1);
  const entering = later(IMAGES[3].id);
  expect(entering.opacity).toBeGreaterThan(0.2);
  expect(entering.opacity).toBeLessThan(0.95);
  const ahead = box(later(IMAGES[2].id));
  const card = box(entering);
  const colour = patch(mid, (ahead.x1 + card.x1) / 2, card.cy);
  const expected = overLinear(ENTERING, entering.opacity, ASH);
  // An sRGB mix (the carousel's neighbour fade) of this near-black over Ash is far darker.
  expect(
    deltaE(colour, expected),
    `entering ${colour.map((c) => c.toFixed(1))} vs ${expected.map((c) => c.toFixed(1))}`,
  ).toBeLessThan(2);
});
