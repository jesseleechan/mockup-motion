import { expect, test, type Page } from "@playwright/test";

/**
 * Pixel baselines for every look the product ships. One test per still, so a failure names the
 * still and the others still run. Baselines are Linux-only and generated in CI; see README.md.
 */

const TEMPLATES = ["scroll-story", "mobile-scroll-story"];

const DEVICES = ["browser", "phone", "card"];
const BACKGROUNDS = ["solid", "gradient"];

interface Still {
  name: string;
  fixture: string;
  aspect: string;
  t: number;
}

// The sliders step every 2.0 s: 1.9 s is the rest pose (step 0 has settled) and 2.5 s is
// mid-step (step 1 started at 2.0 s), presets plan P05. The Stack presets are slider decks and
// the orbits and Site Tours step on the same timing, so they use the same times (stack plan D7,
// orbit plan D7, presets round two T1).
const SLIDER_TEMPLATES = [
  "desktop-slider",
  "mobile-slider",
  "desktop-stack",
  "mobile-stack",
  "desktop-orbit",
  "mobile-orbit",
  "desktop-site-tour",
  "mobile-site-tour",
];
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
// Before & After sweeps from 1.0 to 3.0 s: 2.0 s is mid-sweep (both designs, both labels and the
// divider) and 4.0 s holds the new design (presets round two, T2).
const COMPARE_TEMPLATES = ["desktop-before-after", "mobile-before-after"];
for (const id of COMPARE_TEMPLATES) {
  for (const aspect of ["16:9", "9:16"]) {
    for (const t of [2, 4]) {
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
// The dark option of the flat presets, at 16:9 only: Frames mid-travel, the sliders and orbits
// mid-step, where the neighbour fade (an sRGB blend) shows against the near-black fill, the
// Site Tours mid-step, a dark frame with two pages on its screen, and Before & After mid-sweep.
const DARK_STILLS: Record<string, number> = {
  frames: 2.4,
  "mobile-frames": 2.4,
  "desktop-slider": 2.5,
  "mobile-slider": 2.5,
  "desktop-stack": 2.5,
  "mobile-stack": 2.5,
  "desktop-orbit": 2.5,
  "mobile-orbit": 2.5,
  "desktop-site-tour": 2.5,
  "mobile-site-tour": 2.5,
  "desktop-before-after": 2,
  "mobile-before-after": 2,
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
}
for (const name of BACKGROUNDS) {
  STILLS.push({ name: `bg-${name}`, fixture: `bg-${name}`, aspect: "16:9", t: 1 });
}
// Responsive Scroll: the works hold (3.6 s, both screens on one section) at every aspect, side by
// side or stacked, plus 16:9 mid-move (2.05 s, the shared timing). Responsive Scroll plan R06.
for (const aspect of ["16:9", "4:3", "1:1", "4:5", "9:16"]) {
  const tag = aspect.replace(":", "x");
  STILLS.push({
    name: `responsive-scroll-${tag}-t3.6`,
    fixture: "responsive-scroll",
    aspect,
    t: 3.6,
  });
}
STILLS.push({
  name: "responsive-scroll-16x9-t2.05",
  fixture: "responsive-scroll",
  aspect: "16:9",
  t: 2.05,
});
// Page Columns (presets round two, T3), mid-drift at 4.0 s on each aspect's own fixture (the
// loop follows the aspect): desktop 3 columns at 16:9, 2 at 1:1 and 1 at 9:16; mobile 3 at 16:9
// and 1:1 and 2 at 4:5. Mobile at 16:9 shows the phone-width cap. Plus each preset's dark option
// at 16:9.
const PAGE_COLUMNS_STILLS: [string, string[]][] = [
  ["desktop-page-columns", ["16:9", "1:1", "9:16"]],
  ["mobile-page-columns", ["16:9", "1:1", "4:5"]],
];
for (const [id, aspects] of PAGE_COLUMNS_STILLS) {
  for (const aspect of aspects) {
    const tag = aspect.replace(":", "x");
    STILLS.push({ name: `${id}-${tag}-t4`, fixture: `${id}-${tag}`, aspect, t: 4 });
  }
  STILLS.push({ name: `${id}-dark-16x9-t4`, fixture: `${id}-dark-16x9`, aspect: "16:9", t: 4 });
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
