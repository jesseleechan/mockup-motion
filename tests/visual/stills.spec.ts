import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";

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

function stillWidth(aspect: string): number {
  return aspect === "9:16" ? 360 : 640;
}

async function openStill(page: Page, fixture: string, aspect: string, t: number) {
  const w = stillWidth(aspect);
  await page.goto(
    `/lab?still=1&fixture=${fixture}&aspect=${encodeURIComponent(aspect)}&t=${t}&w=${w}`,
  );
  await page.waitForFunction(() => window.__labReady === true, { timeout: 20_000 });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

async function expectStill(page: Page, name: string) {
  const canvas = page.locator("[data-testid='lab-still'] canvas");
  await expect(canvas).toBeVisible();
  const snapshotPath = test.info().snapshotPath(name);
  const updating = test.info().config.updateSnapshots !== "none";
  if (!fs.existsSync(snapshotPath) && !updating) {
    test.info().annotations.push({
      type: "baseline",
      description: `No baseline for this OS (${name}). Run with --update-snapshots to create it.`,
    });
    return;
  }
  await expect(canvas).toHaveScreenshot(name, { maxDiffPixelRatio: 0.002 });
}

test.describe("WP-18 visual stills", () => {
  test.describe.configure({ timeout: 180_000 });

  test("every template at 16:9 and 9:16, two times", async ({ page }) => {
    for (const id of TEMPLATES) {
      for (const aspect of ["16:9", "9:16"]) {
        for (const t of [0.8, 2.4]) {
          await openStill(page, id, aspect, t);
          const aspectName = aspect.replace(":", "x");
          await expectStill(page, `${id}-${aspectName}-t${t}.png`);
        }
      }
    }
  });

  test("every device, frontal and tilted", async ({ page }) => {
    for (const device of DEVICES) {
      await openStill(page, `device-${device}-frontal`, "16:9", 1);
      await expectStill(page, `device-${device}-frontal.png`);
      await openStill(page, `device-${device}-tilted`, "16:9", 4.2);
      await expectStill(page, `device-${device}-tilted.png`);
    }
  });

  test("every background", async ({ page }) => {
    for (const name of BACKGROUNDS) {
      await openStill(page, `bg-${name}`, "16:9", 1);
      await expectStill(page, `bg-${name}.png`);
    }
  });

  test("every transition at progress 0.5", async ({ page }) => {
    for (const kind of TRANSITIONS) {
      await openStill(page, `transition-${kind}`, "16:9", 3.6);
      await expectStill(page, `transition-${kind}.png`);
    }
  });

  test("every text animation at its midpoint", async ({ page }) => {
    for (const [anim, t] of Object.entries(TEXT_ANIMS)) {
      await openStill(page, `text-${anim}`, "16:9", t);
      await expectStill(page, `text-${anim}.png`);
    }
  });
});
