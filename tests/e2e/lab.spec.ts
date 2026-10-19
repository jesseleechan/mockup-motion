import { expect, test } from "@playwright/test";
import type { Engine } from "../../src/engine/Engine";

declare global {
  interface Window {
    __labReady?: boolean;
    __labEngine?: Engine;
  }
}

test.describe("/lab page and Engine visual rendering", () => {
  test("scrubbing determinism: rendering at t=2.0 gives identical frame after scrubbing", async ({
    page,
  }) => {
    await page.goto("/lab?fixture=card-scroll&t=2.0&aspect=16:9");
    await page.waitForFunction(() => window.__labReady === true, { timeout: 15000 });

    const snapshot1 = await page.locator("canvas").screenshot();

    // Scrub forward
    await page.evaluate(() => {
      const engine = window.__labEngine;
      engine?.renderAt(4.0);
    });
    await page.waitForTimeout(100);

    // Scrub back to 2.0
    await page.evaluate(() => {
      const engine = window.__labEngine;
      engine?.renderAt(2.0);
    });
    await page.waitForTimeout(100);

    const snapshot2 = await page.locator("canvas").screenshot();
    expect(snapshot1).toEqual(snapshot2);
  });
});
