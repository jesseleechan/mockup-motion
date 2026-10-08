import { expect, test, type Page } from "@playwright/test";
import { differenceCiede2000, type Rgb as CuloriRgb } from "culori";
import sharp from "sharp";
import type { AssetRef, Layout, ProjectDoc } from "../../src/doc/types";
import { resolveSliderLayout, type LayoutNode } from "../../src/motion";
import { avgRegion, expectRgbNear, type PixelBuffer } from "../helpers/pixels";

// A 4:5 frame, as in the reference (docs/presets-plan/reference.md). Stage height = HEIGHT px.
const WIDTH = 1200;
const HEIGHT = 1500;
// The Ash background of the slider fixtures (quality bar §6).
const ASH = [223, 225, 227] as const;
// Quality bar §3.1: slider neighbours show at 65% over the background.
const NEIGHBOUR_OPACITY = 0.65;

type Rgb = readonly [number, number, number];

/** A test screenshot: flat bands top to bottom, or the edge-marks image used for orientation. */
interface ImageSpec {
  id: string;
  width: number;
  height: number;
  bands?: string[];
  marks?: boolean;
}

const MOBILE = { width: 780, height: 1688 };

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

/** `top` at `opacity` over `bottom`, mixed as encoded sRGB values like the reference. */
function overSrgb(top: Rgb, opacity: number, bottom: Rgb): Rgb {
  return top.map((c, i) => opacity * c + (1 - opacity) * bottom[i]) as unknown as Rgb;
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

/** The node's on-screen box in pixels: the card's outer edge at its current scale. */
function box(node: LayoutNode) {
  const w = node.width * node.transform.scale * HEIGHT;
  const h = node.height * node.transform.scale * HEIGHT;
  const cx = WIDTH / 2 + node.transform.x * HEIGHT;
  const cy = HEIGHT / 2 - node.transform.y * HEIGHT;
  return { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2, cx, cy, w, h };
}

/** The mean colour of a 20 × 20 px patch at (x, y), moved inside the frame if it overhangs. */
function patch(px: PixelBuffer, x: number, y: number): [number, number, number] {
  const x0 = Math.min(Math.max(4, x - 10), WIDTH - 24);
  const y0 = Math.min(Math.max(4, y - 10), HEIGHT - 24);
  return avgRegion(px, x0, y0, x0 + 20, y0 + 20);
}

async function ready(page: Page): Promise<void> {
  await page.goto("/lab?fixture=slider-x&t=0&aspect=4:5");
  await page.waitForFunction(() => window.__labReady === true);
}

/** Renders the slider-x fixture with `images` as its screenshots, at each time. */
async function renderSlider(
  page: Page,
  layout: Extract<Layout, { kind: "slider" }>,
  images: ImageSpec[],
  times: number[],
): Promise<PixelBuffer[]> {
  return page.evaluate(
    async ({ layout, images, assets, times, width, height }) => {
      const engine = window.__labEngine;
      const setDoc = window.__labSetDoc;
      const testImages = window.__labTestImages;
      const doc = structuredClone(window.__fixtures?.["slider-x"]);
      if (!engine || !setDoc || !testImages || !doc) throw new Error("Lab hooks are unavailable");
      engine.resize(width, height);
      doc.assets = assets;
      doc.shots[0].layout = layout;
      doc.shots[0].duration = layout.assetIds.length * layout.step;
      const bitmaps: Record<string, ImageBitmap> = {};
      for (const spec of images) {
        if (spec.bands) {
          bitmaps[spec.id] = await testImages.bands(spec.width, spec.height, spec.bands);
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
      return times.map((t) => {
        engine.renderAt(t);
        return { width, height, data: engine.readPixels() };
      });
    },
    { layout, images, assets: images.map(assetRef), times, width: WIDTH, height: HEIGHT },
  );
}

function sliderX(images: ImageSpec[]): Extract<Layout, { kind: "slider" }> {
  return { kind: "slider", assetIds: images.map((i) => i.id), axis: "x", shape: "mobile", step: 2 };
}

/** The layout's nodes at `t`, keyed by asset id. */
function nodesAt(layout: Extract<Layout, { kind: "slider" }>, images: ImageSpec[], t: number) {
  const nodes = resolveSliderLayout(layout, "4:5", images.map(assetRef), t);
  return (assetId: string): LayoutNode => {
    const shown = nodes.filter((n) => n.assetId === assetId && n.opacity > 0.01);
    const nearest = shown.sort((a, b) => Math.abs(a.transform.x) - Math.abs(b.transform.x))[0];
    if (!nearest) throw new Error(`No visible card for ${assetId}`);
    return nearest;
  };
}

const ACTIVE: Rgb = [51, 102, 204];
const LEFT: Rgb = [138, 30, 58];
const BLACK: Rgb = [0, 0, 0];

/** Four flat screenshots: the active card, black on its right, a colour on its left. */
const FLAT: ImageSpec[] = [
  { id: "slider-active", ...MOBILE, bands: [hex(ACTIVE)] },
  { id: "slider-right", ...MOBILE, bands: [hex(BLACK)] },
  { id: "slider-far", ...MOBILE, bands: ["#808080"] },
  { id: "slider-left", ...MOBILE, bands: [hex(LEFT)] },
];

test("the active slider card is colour-exact and its neighbours are 65% over the background", async ({
  page,
}) => {
  await ready(page);
  const layout = sliderX(FLAT);
  const [frame] = await renderSlider(page, layout, FLAT, [0]);
  const node = nodesAt(layout, FLAT, 0);
  expectRgbNear(patch(frame, 8, 8), ASH, 2);

  const active = box(node("slider-active"));
  const activeColour = patch(frame, active.cx, active.cy);
  expect(
    deltaE(activeColour, ACTIVE),
    `active card centre ${activeColour.map((c) => c.toFixed(1)).join(", ")}`,
  ).toBeLessThan(1);

  // The reference mixes neighbours as encoded sRGB values: a pixel of 15 at 65% over 223
  // shows 88 (docs/presets-plan/reference.md). A linear-light mix would show about 139.
  const left = box(node("slider-left"));
  expectRgbNear(patch(frame, left.cx, left.cy), overSrgb(LEFT, NEIGHBOUR_OPACITY, ASH), 2);
});

test("a faded neighbour fades as one card: no body slab shows through a black screen", async ({
  page,
}) => {
  await ready(page);
  const layout = sliderX(FLAT);
  const [frame] = await renderSlider(page, layout, FLAT, [0]);
  const right = box(nodesAt(layout, FLAT, 0)("slider-right"));
  // Over a pure-black screen the faded card is 0.35 × the background. A screen faded on its
  // own would show the light body slab behind it instead.
  const expected = overSrgb(BLACK, NEIGHBOUR_OPACITY, ASH);
  expectRgbNear(patch(frame, right.cx, right.cy), expected, 2);
  // Every pixel of the card's inner area, not only the centre (the slab could show in spots).
  const inset = right.w * 0.12;
  let worst = 0;
  for (let y = Math.ceil(right.y0 + inset); y < right.y1 - inset; y += 3) {
    for (let x = Math.ceil(right.x0 + inset); x < Math.min(WIDTH, right.x1 - inset); x += 3) {
      const i = (y * WIDTH + x) * 4;
      for (let c = 0; c < 3; c++)
        worst = Math.max(worst, Math.abs(frame.data[i + c] - expected[c]));
    }
  }
  expect(worst, "largest difference from 0.35 × background inside the card").toBeLessThanOrEqual(3);
});

test("a portrait card shows the whole screenshot width, top row first", async ({ page }) => {
  await ready(page);
  // Wider than the card (0.65 vs 0.4615), so a fit to height would crop the sides.
  const images: ImageSpec[] = [
    { id: "slider-marks", width: 780, height: 1200, marks: true },
    ...FLAT.slice(1),
  ];
  const layout = sliderX(images);
  const [frame] = await renderSlider(page, layout, images, [0]);
  const card = box(nodesAt(layout, images, 0)("slider-marks"));

  // Top band: red just below the card's top edge, in the middle of the width. The band is
  // 0.077 card widths tall on screen; the patch stays clear of the anti-aliased edge.
  const top = patch(frame, card.cx, card.y0 + card.w * 0.04);
  expectRgbNear(top, [255, 0, 0], 3);

  // Across a row inside the screenshot, green and blue each fill 10% of the card's width,
  // from its left and right edges: the screenshot is fitted to width, not cropped.
  const y = Math.round(card.y0 + card.w * 0.5);
  const run = (match: (r: number, g: number, b: number) => boolean) => {
    let first = -1;
    let last = -1;
    for (let x = Math.floor(card.x0); x <= Math.ceil(card.x1); x++) {
      const i = (y * WIDTH + x) * 4;
      if (match(frame.data[i], frame.data[i + 1], frame.data[i + 2])) {
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

test("a portrait card's corners are rounded at 7.5% of its width", async ({ page }) => {
  await ready(page);
  const layout = sliderX(FLAT);
  const [frame] = await renderSlider(page, layout, FLAT, [0]);
  const card = box(nodesAt(layout, FLAT, 0)("slider-active"));
  const radius = card.w * 0.075;
  // On the corner's diagonal, the arc is 0.29 r in from each edge. At 0.12 r the point is
  // outside it (background); at 0.5 r it is inside (the screenshot). With the landscape
  // radius of 1.6% both points would be inside the card.
  const sample = (a: number) =>
    avgRegion(frame, card.x0 + a - 1, card.y0 + a - 1, card.x0 + a + 1, card.y0 + a + 1);
  expectRgbNear(sample(radius * 0.12), ASH, 3);
  expectRgbNear(sample(radius * 0.5), ACTIVE, 3);
  // The same at the bottom-right corner.
  const sampleEnd = (a: number) =>
    avgRegion(frame, card.x1 - a - 1, card.y1 - a - 1, card.x1 - a + 1, card.y1 - a + 1);
  expectRgbNear(sampleEnd(radius * 0.12), ASH, 3);
  expectRgbNear(sampleEnd(radius * 0.5), ACTIVE, 3);
});

test("slider frames create no GPU objects: the fade targets are allocated with the document", async ({
  page,
}) => {
  await ready(page);
  const created = await page.evaluate(async () => {
    const engine = window.__labEngine;
    const setDoc = window.__labSetDoc;
    const doc = structuredClone(window.__fixtures?.["slider-x"]);
    if (!engine || !setDoc || !doc) throw new Error("Lab hooks are unavailable");
    // The slider is the second shot, so the warm-up render at t = 0 doesn't draw it.
    const slider = doc.shots[0];
    const intro = structuredClone(slider);
    intro.id = "intro";
    intro.duration = 2;
    intro.layout = { kind: "single", device: "card", assetId: doc.assets[0].id };
    doc.shots = [intro, slider];
    doc.loop = false;
    await setDoc(doc);
    // The engine's renderer is private; the context is reached through it.
    const gl = (
      engine as unknown as { renderer: { getContext(): WebGL2RenderingContext } }
    ).renderer.getContext();
    const counts = { texture: 0, framebuffer: 0, renderbuffer: 0 };
    const originals = {
      createTexture: gl.createTexture,
      createFramebuffer: gl.createFramebuffer,
      createRenderbuffer: gl.createRenderbuffer,
    };
    gl.createTexture = () => {
      counts.texture++;
      return originals.createTexture.call(gl);
    };
    gl.createFramebuffer = () => {
      counts.framebuffer++;
      return originals.createFramebuffer.call(gl);
    };
    gl.createRenderbuffer = () => {
      counts.renderbuffer++;
      return originals.createRenderbuffer.call(gl);
    };
    try {
      // A whole step of the slider, where up to five cards have different opacities at once.
      for (let frame = 0; frame <= 20; frame++) engine.renderAt(2 + frame * 0.1);
    } finally {
      Object.assign(gl, originals);
    }
    return counts;
  });
  expect(created, "WebGL objects created while slider cards fade").toEqual({
    texture: 0,
    framebuffer: 0,
    renderbuffer: 0,
  });
});

test.describe("slider editing", () => {
  interface EditorWindow {
    __editorStore?: { getState: () => { doc: ProjectDoc } };
  }

  const sliderShot = (page: Page) =>
    page.evaluate(() => {
      const doc = (window as unknown as EditorWindow).__editorStore?.getState().doc;
      const shot = doc?.shots[0];
      if (!shot || shot.layout.kind !== "slider") throw new Error("Shot 0 is not a slider");
      return { assetIds: shot.layout.assetIds, step: shot.layout.step, duration: shot.duration };
    });

  /** First run → gallery → Mobile Slider → demo content, with shot 1 selected. */
  async function openMobileSlider(page: Page): Promise<void> {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/lab/ui");
    await page.evaluate(async () => {
      localStorage.clear();
      sessionStorage.clear();
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase("mockupmotion-v2");
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error("deleteDatabase blocked"));
      });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Start with a template" }).click();
    await page.locator('[data-testid="template-card"][data-template-id="mobile-slider"]').click();
    await page.getByRole("button", { name: "Apply template" }).click();
    await page.getByRole("button", { name: "Use demo content" }).click();
    await expect
      .poll(async () => (await sliderShot(page)).assetIds.length, { timeout: 20_000 })
      .toBeGreaterThanOrEqual(3);
    await page
      .locator('[data-testid="shot-card"]')
      .first()
      .click({ position: { x: 6, y: 6 } });
    await expect(page.getByRole("slider", { name: "Step length" })).toBeVisible();
  }

  test("changing the step length sets the shot length, and undo restores both", async ({
    page,
  }) => {
    await openMobileSlider(page);
    const before = await sliderShot(page);
    const n = before.assetIds.length;
    expect(before.step).toBe(2);
    expect(before.duration).toBe(n * 2);

    // The duration control is read-only for a slider and says why.
    const hint = page.getByText("Set by step length × screenshots");
    await expect(hint).toBeVisible();
    await expect(page.getByRole("slider", { name: "Duration" })).toHaveAttribute(
      "aria-describedby",
      (await hint.getAttribute("id")) ?? "",
    );
    await expect(page.getByRole("slider", { name: "Duration" })).toHaveAttribute(
      "data-disabled",
      "",
    );

    // Page Up moves the slider ten 0.1 s steps at once, 2.0 → 3.0 s, as one edit. (Ten arrow
    // presses are ten edits, which coalesce into one undo step only within 800 ms.)
    const step = page.getByRole("slider", { name: "Step length" });
    await step.focus();
    await step.press("PageUp");
    await expect.poll(async () => (await sliderShot(page)).step).toBe(3);
    expect((await sliderShot(page)).duration).toBe(n * 3);
    await expect(page.getByText(`${(n * 3).toFixed(1)} s`).first()).toBeVisible();

    await page.getByRole("button", { name: "Undo" }).click();
    expect(await sliderShot(page)).toEqual(before);
  });

  test("a screenshot added from the Media tab joins the slider and adds one step", async ({
    page,
  }) => {
    await openMobileSlider(page);
    const before = await sliderShot(page);

    await page.getByRole("tab", { name: "Media" }).click();
    const png = await sharp({
      create: { width: 780, height: 1688, channels: 3, background: "#3366CC" },
    })
      .png()
      .toBuffer();
    await page.getByTestId("media-input").setInputFiles({
      name: "extra-mobile.png",
      mimeType: "image/png",
      buffer: png,
    });
    const card = page.locator("[draggable=true]", { has: page.getByAltText("extra-mobile.png") });
    await expect(card).toBeVisible();
    await card.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Add to slider" }).click();

    const added = await page.evaluate(
      () =>
        (window as unknown as EditorWindow).__editorStore
          ?.getState()
          .doc.assets.find((a) => a.name === "extra-mobile.png")?.id,
    );
    expect(added, "the upload is in the project").toBeTruthy();
    const after = await sliderShot(page);
    expect(after.assetIds).toEqual([...before.assetIds, added]);
    expect(after.duration).toBe(before.duration + before.step);

    // The inspector lists it, and its menu now offers to take it out again.
    await expect(
      page.getByRole("list", { name: "Slider screenshots" }).getByText("extra-mobile.png"),
    ).toBeVisible();
    await card.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Remove from slider" }).click();
    expect(await sliderShot(page)).toEqual(before);
  });
});
