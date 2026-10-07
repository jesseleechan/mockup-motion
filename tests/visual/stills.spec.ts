import { expect, test, type Page } from "@playwright/test";

/**
 * Pixel baselines for every look the product ships. One test per still, so a failure names the
 * still and the others still run. Baselines are Linux-only and generated in CI; see README.md.
 */

const TEMPLATES = [
  "quiet-hero",
  "tilted-showcase",
  "responsive-pair",
  "responsive-trio",
  "phone-spotlight",
  "phone-parade",
  "portfolio-rows",
  "isometric-wall",
  "cascade-stack",
  "scroll-story",
  "launch-reel",
  "case-study-reel",
];

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

const STILLS: Still[] = [];
for (const id of TEMPLATES) {
  for (const aspect of ["16:9", "9:16"]) {
    for (const t of [0.8, 2.4]) {
      STILLS.push({ name: `${id}-${aspect.replace(":", "x")}-t${t}`, fixture: id, aspect, t });
    }
  }
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
