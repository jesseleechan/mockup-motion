import { expect, test } from "@playwright/test";
import type { ProjectDoc } from "../../src/doc/types";
import type { Engine } from "../../src/engine/Engine";
import type { exportWithEngine } from "../../src/export/engine-export";
import type { createLabAssetProvider } from "../../src/lab/asset-provider";

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

// Moved from tests/e2e in F13: it measures GPU throughput, which SwiftShader (local and CI)
// cannot reach. Run it with `npm run test:perf` on a machine with a real GPU.
test("Spike 3: Export speed - 6s at 1080p30 finishes in <= 12s", async ({ page }) => {
  test.setTimeout(30000);
  await page.goto("/lab?fixture=card-hero&t=0&aspect=16:9");
  await page.waitForFunction(() => window.__labReady === true, { timeout: 15000 });

  const exportDurationSec = await page.evaluate(async () => {
    const exportFn = window.__exportWithEngine;
    const createProvider = window.__createLabAssetProvider;
    const fixtures = window.__fixtures;

    if (!exportFn || !createProvider || !fixtures) {
      throw new Error("Export utilities not ready");
    }

    const cardHero = fixtures["card-hero"];
    // 6s doc
    const testDoc = {
      ...cardHero,
      shots: [{ ...cardHero.shots[0], duration: 6 }],
    };

    const provider = createProvider();
    const start = performance.now();

    await exportFn(testDoc, provider, {
      destination: "custom",
      resolution: 1080,
      fps: 30,
      quality: "high",
      format: "webm",
      supersample: 1,
      motionBlur: false,
    });

    return (performance.now() - start) / 1000;
  });

  console.log(`[Spike Gate] 6s 1080p30 export finished in: ${exportDurationSec.toFixed(2)}s`);
  expect(exportDurationSec).toBeLessThanOrEqual(12.0);
});

declare global {
  interface Window {
    __labReady?: boolean;
    __labEngine?: Engine;
    __exportWithEngine?: typeof exportWithEngine;
    __createLabAssetProvider?: typeof createLabAssetProvider;
    __fixtures?: Record<string, ProjectDoc>;
  }
}
