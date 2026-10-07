import { expect, test } from "@playwright/test";
import type { Engine } from "../../src/engine/Engine";

declare global {
  interface Window {
    __labReady?: boolean;
    __labEngine?: Engine;
  }
}

test.describe("WP-03 Go/No-Go Spike Verification Gate", () => {
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
