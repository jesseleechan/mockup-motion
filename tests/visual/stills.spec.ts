import { expect, test, type Page } from "@playwright/test";

/**
 * Pixel baselines for every look the product ships. One test per still, so a failure names the
 * still and the others still run. Baselines are Linux-only and generated in CI; see README.md.
 */

const TEMPLATES = ["scroll-story"];

const DEVICES = ["browser", "phone", "tablet", "laptop", "card"];
const BACKGROUNDS = ["solid", "gradient", "mesh", "ambient", "image"];
const TRANSITIONS = ["fade", "blur", "push", "zoom", "wipe"];
const TEXT_ANIMS: Record<string, number> = {
  fadeUp: 0.375,
  maskReveal: 0.375,
  blurIn: 0.375,
  wordStagger: 0.375,
  typewriter: 0.15,
};

interface Still {
  name: string;
  fixture: string;
  aspect: string;
  t: number;
}

// The sliders step every 2.0 s: 1.9 s is the rest pose (step 0 has settled) and 2.5 s is
// mid-step (step 1 started at 2.0 s), presets plan P05.
const SLIDER_TEMPLATES = ["desktop-slider", "mobile-slider"];
const SLIDER_TIMES = [1.9, 2.5];

const STILLS: Still[] = [];
for (const id of TEMPLATES) {
  for (const aspect of ["16:9", "9:16"]) {
    for (const t of [0.8, 2.4]) {
      STILLS.push({ name: `${id}-${aspect.replace(":", "x")}-t${t}`, fixture: id, aspect, t });
    }
  }
}
for (const id of SLIDER_TEMPLATES) {
  for (const aspect of ["16:9", "9:16"]) {
    for (const t of SLIDER_TIMES) {
      STILLS.push({ name: `${id}-${aspect.replace(":", "x")}-t${t}`, fixture: id, aspect, t });
    }
  }
}
// Frames' row count depends on the aspect, so each aspect has its own fixture (LabPage).
for (const aspect of ["16:9", "9:16"]) {
  const tag = aspect.replace(":", "x");
  for (const t of [0.8, 2.4]) {
    STILLS.push({ name: `frames-${tag}-t${t}`, fixture: `frames-${tag}`, aspect, t });
  }
}
// Mobile Frames the same way (column count per aspect), plus 4:5, the one aspect that crops its
// outer columns (Frames plan D11).
const MOBILE_FRAMES_STILLS: [string, number[]][] = [
  ["16:9", [0.8, 2.4]],
  ["9:16", [0.8, 2.4]],
  ["4:5", [0.8]],
];
for (const [aspect, times] of MOBILE_FRAMES_STILLS) {
  const tag = aspect.replace(":", "x");
  for (const t of times) {
    STILLS.push({
      name: `mobile-frames-${tag}-t${t}`,
      fixture: `mobile-frames-${tag}`,
      aspect,
      t,
    });
  }
}
// The dark option of the four presets, at 16:9 only: Frames mid-travel, the sliders mid-step, where
// the neighbour fade (an sRGB blend) shows against the near-black fill.
const DARK_STILLS: Record<string, number> = {
  frames: 2.4,
  "mobile-frames": 2.4,
  "desktop-slider": 2.5,
  "mobile-slider": 2.5,
};
for (const [id, t] of Object.entries(DARK_STILLS)) {
  STILLS.push({ name: `${id}-dark-16x9-t${t}`, fixture: `${id}-dark-16x9`, aspect: "16:9", t });
}
for (const device of DEVICES) {
  STILLS.push({
    name: `device-${device}-frontal`,
    fixture: `device-${device}-frontal`,
    aspect: "16:9",
    t: 1,
  });
  STILLS.push({
    name: `device-${device}-tilted`,
    fixture: `device-${device}-tilted`,
    aspect: "16:9",
    t: 4.2,
  });
}
for (const name of BACKGROUNDS) {
  STILLS.push({ name: `bg-${name}`, fixture: `bg-${name}`, aspect: "16:9", t: 1 });
}
for (const kind of TRANSITIONS) {
  STILLS.push({
    name: `transition-${kind}`,
    fixture: `transition-${kind}`,
    aspect: "16:9",
    t: 3.6,
  });
}
for (const [anim, t] of Object.entries(TEXT_ANIMS)) {
  STILLS.push({ name: `text-${anim}`, fixture: `text-${anim}`, aspect: "16:9", t });
}
// F01: quadrants on every device. F02: source colour bands on a frameless card.
for (const device of DEVICES) {
  STILLS.push({ name: `orient-${device}`, fixture: `orient-${device}`, aspect: "16:9", t: 1 });
}
STILLS.push({ name: "color-bands", fixture: "color-bands", aspect: "16:9", t: 1 });

function stillWidth(aspect: string): number {
  return aspect === "9:16" ? 360 : 640;
}

async function openStill(page: Page, still: Still) {
  const w = stillWidth(still.aspect);
  await page.goto(
    `/lab?still=1&fixture=${still.fixture}&aspect=${encodeURIComponent(still.aspect)}&t=${still.t}&w=${w}`,
  );
  // The GitHub runner is about 5x slower than a laptop on SwiftShader.
  await page.waitForFunction(() => window.__labReady === true, { timeout: 60_000 });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

test.describe("F13 visual stills", () => {
  test.describe.configure({ timeout: 120_000 });

  for (const still of STILLS) {
    test(still.name, async ({ page }) => {
      await openStill(page, still);
      const canvas = page.locator("[data-testid='lab-still'] canvas");
      await expect(canvas).toBeVisible();
      await expect(canvas).toHaveScreenshot(`${still.name}.png`, { maxDiffPixelRatio: 0.002 });
    });
  }
});

declare global {
  interface Window {
    __labReady?: boolean;
  }
}
