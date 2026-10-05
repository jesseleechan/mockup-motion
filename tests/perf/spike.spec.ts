import { test } from "@playwright/test";
import type { Engine } from "../../src/engine/Engine";

test("Spike 2: preview render timing after GPU completion", async ({ page }) => {
  // A measurement, not a gate. SwiftShader on CI needs more than the default 45 s for 60 frames.
  test.setTimeout(180_000);
  await page.goto("/lab?fixture=card-hero&t=0&aspect=16:9");
  await page.waitForFunction(() => window.__labReady === true, { timeout: 15000 });
  const elapsed = await page.evaluate(() => {
    const engine = window.__labEngine;
    if (!engine) throw new Error("Engine not ready");
    engine.resize(1440, 810);
    const start = performance.now();
    for (let frame = 0; frame < 60; frame++) engine.renderAt((frame / 60) * 5);
    engine.readPixels();
    return performance.now() - start;
  });
  console.log(`[Spike Gate] 60 frames plus GPU readback: ${elapsed.toFixed(1)} ms`);
});

declare global {
  interface Window {
    __labReady?: boolean;
    __labEngine?: Engine;
  }
}
