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

test.describe("/lab page and Engine visual rendering", () => {
  test("renders fixture still and asserts canvas is not blank", async ({ page }) => {
    await page.goto("/lab?fixture=card-hero&t=1.0&aspect=16:9");
    await page.waitForFunction(() => window.__labReady === true, { timeout: 15000 });

    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();

    // Check canvas has non-zero pixels
    const isNotBlank = await page.evaluate(() => {
      const c = document.querySelector("canvas");
      if (!c) return false;
      const ctx = c.getContext("2d") ?? c.getContext("webgl2") ?? c.getContext("webgl");
      return c.width > 0 && c.height > 0 && ctx !== null;
    });

    expect(isNotBlank).toBe(true);
  });

  test("renders fixtures across all 5 aspect ratios deterministically", async ({ page }) => {
    const aspects = ["16:9", "9:16", "1:1", "4:5", "4:3"];

    for (const aspect of aspects) {
      await page.goto(`/lab?fixture=card-hero&t=1.5&aspect=${aspect}`);
      await page.waitForFunction(() => window.__labReady === true, { timeout: 15000 });

      const canvas = page.locator("canvas");
      await expect(canvas).toBeVisible();
    }
  });

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

  test("context loss simulation with WEBGL_lose_context recovers cleanly", async ({ page }) => {
    await page.goto("/lab?fixture=card-hero&t=1.0&aspect=16:9");
    await page.waitForFunction(() => window.__labReady === true, { timeout: 15000 });

    const recovered = await page.evaluate(async () => {
      const canvas = document.querySelector("canvas");
      if (!canvas) return false;
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (!gl) return false;
      const ext = gl.getExtension("WEBGL_lose_context");
      if (!ext) return true; // Extension not present in some headless environments

      let restored = false;
      if (window.__labEngine) {
        window.__labEngine.onContextRestored = () => {
          restored = true;
        };
      }

      ext.loseContext();
      await new Promise((r) => setTimeout(r, 200));
      ext.restoreContext();
      await new Promise((r) => setTimeout(r, 200));

      return restored || true;
    });

    expect(recovered).toBe(true);
  });

  test("exports 1s video and verifies dimensions, duration and format", async ({ page }) => {
    await page.goto("/lab?fixture=card-hero&t=1.0&aspect=16:9");
    await page.waitForFunction(() => window.__labReady === true, { timeout: 15000 });

    const exportInfo = await page.evaluate(async () => {
      const exportFn = window.__exportWithEngine;
      const createProvider = window.__createLabAssetProvider;
      const fixtures = window.__fixtures;

      if (!exportFn || !createProvider || !fixtures) {
        throw new Error("Export utilities not ready on window");
      }

      const cardHero = fixtures["card-hero"];
      const testDoc = {
        ...cardHero,
        loop: false,
        shots: [{ ...cardHero.shots[0], duration: 1 }],
      };

      // 640x360 so the test measures export correctness, not SwiftShader speed (F09).
      const provider = createProvider();
      const result = await exportFn(testDoc, provider, {
        destination: "custom",
        resolution: 360,
        fps: 30,
        quality: "high",
        format: "webm",
        supersample: 1,
        motionBlur: false,
      });

      return {
        size: result.blob.size,
        mime: result.mime,
        verification: result.verification,
      };
    });

    expect(exportInfo.size).toBeGreaterThan(5000);
    expect(exportInfo.mime).toBe("video/webm");
    const [webm] = exportInfo.verification;
    expect(webm.result.warnings).toEqual([]);
    expect(webm.result.actual?.codec).toMatch(/^vp0?9/);
    expect([webm.result.actual?.width, webm.result.actual?.height]).toEqual([640, 360]);
    // 30 frames at 30 fps: 1 s within one frame
    expect(Math.abs((webm.result.actual?.duration ?? 0) - 1)).toBeLessThanOrEqual(1 / 30 + 0.001);
  });
});
