import { expect, test } from "@playwright/test";
import type { ProjectDoc } from "../../src/doc/types";
import type { Engine } from "../../src/engine/Engine";
import type { exportWithEngine } from "../../src/export/engine-export";
import type { createLabAssetProvider } from "../../src/lab/asset-provider";

declare global {
  interface Window {
    __labReady?: boolean;
    __labEngine?: Engine;
    __exportWithEngine?: typeof exportWithEngine;
    __createLabAssetProvider?: typeof createLabAssetProvider;
    __fixtures?: Record<string, ProjectDoc>;
  }
}

test.describe("WP-03 Go/No-Go Spike Verification Gate", () => {
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

  test("Spike 4: Memory - 20 setDocument cycles return memory to baseline", async ({ page }) => {
    await page.goto("/lab?fixture=card-hero&t=0&aspect=16:9");
    await page.waitForFunction(() => window.__labReady === true, { timeout: 15000 });

    const memoryCheck = await page.evaluate(async () => {
      const engine = window.__labEngine;
      if (!engine)
        return { baselineGeometries: 0, finalGeometries: 0, baselineTextures: 0, finalTextures: 0 };

      const provider = engine.getCurrentAssets();
      const doc = engine.getCurrentDoc();
      if (!provider || !doc)
        return { baselineGeometries: 0, finalGeometries: 0, baselineTextures: 0, finalTextures: 0 };

      const baseline = engine.getMemoryInfo();

      // Run 20 cycles
      for (let i = 0; i < 20; i++) {
        await engine.setDocument(doc, provider);
      }

      const final = engine.getMemoryInfo();

      return {
        baselineGeometries: baseline.geometries,
        finalGeometries: final.geometries,
        baselineTextures: baseline.textures,
        finalTextures: final.textures,
      };
    });

    console.log("[Spike Gate] Memory cycle check:", memoryCheck);
    expect(memoryCheck.finalGeometries).toBe(memoryCheck.baselineGeometries);
    expect(memoryCheck.finalTextures).toBe(memoryCheck.baselineTextures);
  });
});
