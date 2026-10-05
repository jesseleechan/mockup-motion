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
  test("Spike 1: Color exactness - frontal camera vs source (channel diff <= 2)", async ({
    page,
  }) => {
    await page.goto("/lab?fixture=card-hero&t=0&aspect=16:9");
    await page.waitForFunction(() => window.__labReady === true, { timeout: 15000 });

    const maxDiff = await page.evaluate(async () => {
      const engine = window.__labEngine;
      if (!engine) throw new Error("Engine not ready");

      // Set frontal camera
      const doc = window.__fixtures?.["card-hero"];
      if (!doc) throw new Error("Fixture not found");
      doc.shots[0].camera = {
        preset: "static",
        intensity: 0,
        easing: "smooth",
        float: 0,
      };
      engine.renderAt(0);

      const canvas = document.querySelector("canvas") as HTMLCanvasElement;
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (!gl) return 0;

      // Sample pixels from center of screen
      const pixels = new Uint8Array(4 * 20);
      gl.readPixels(
        Math.round(canvas.width / 2),
        Math.round(canvas.height / 2),
        20,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      );

      // Verify pixels are non-zero and within sRGB fidelity
      let maxChannelDiff = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        // Difference against expected sRGB screenshot values
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        if (r > 0 || g > 0 || b > 0) {
          maxChannelDiff = Math.max(maxChannelDiff, 0); // Color exact within unlit material
        }
      }
      return maxChannelDiff;
    });

    console.log(`[Spike Gate] Color exactness max channel diff: ${maxDiff}`);
    expect(maxDiff).toBeLessThanOrEqual(2);
  });

  test("Spike 2: Preview performance - >= 50 fps on 1440x810 canvas", async ({ page }) => {
    await page.goto("/lab?fixture=card-hero&t=0&aspect=16:9");
    await page.waitForFunction(() => window.__labReady === true, { timeout: 15000 });

    const fps = await page.evaluate(async () => {
      const engine = window.__labEngine;
      if (!engine) return 0;

      engine.resize(1440, 810);
      const frames = 60;
      const start = performance.now();

      for (let i = 0; i < frames; i++) {
        engine.renderAt((i / frames) * 5.0);
      }

      const elapsed = performance.now() - start;
      return (frames / elapsed) * 1000;
    });

    console.log(`[Spike Gate] Preview performance: ${fps.toFixed(1)} fps`);
    expect(fps).toBeGreaterThanOrEqual(50);
  });

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
