import { expect, test } from "@playwright/test";

test.describe("WP-08 Shadows, Post-Processing & Motion Blur E2E", () => {
  test("motion blur: renderAccumulated with shutter = 0 is pixel-identical to renderAt", async ({
    page,
  }) => {
    await page.goto("/lab?fixture=orbit-loop&t=1.0&aspect=16:9");
    await page.waitForFunction(() => window.__labReady === true, { timeout: 15000 });

    const diff = await page.evaluate(async () => {
      const engine = window.__labEngine;
      if (!engine) throw new Error("Engine not ready");

      const canvas = document.querySelector("canvas") as HTMLCanvasElement;
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (!gl) return 0;

      // 1. Render standard renderAt(1.0)
      engine.renderAt(1.0);
      const pixelsAt = new Uint8Array(4 * 50);
      gl.readPixels(100, 100, 50, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixelsAt);

      // 2. Render renderAccumulated(1.0, 0, 1)
      engine.renderAccumulated(1.0, 0, 1);
      const pixelsAccum = new Uint8Array(4 * 50);
      gl.readPixels(100, 100, 50, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixelsAccum);

      let maxDiff = 0;
      for (let i = 0; i < pixelsAt.length; i++) {
        const d = Math.abs(pixelsAt[i] - pixelsAccum[i]);
        if (d > maxDiff) maxDiff = d;
      }
      return maxDiff;
    });

    expect(diff).toBe(0);
  });

  test("motion blur: renderAccumulated with shutter = 0.5/30 and 8 samples succeeds", async ({
    page,
  }) => {
    await page.goto("/lab?fixture=orbit-loop&t=1.0&aspect=16:9");
    await page.waitForFunction(() => window.__labReady === true, { timeout: 15000 });

    const success = await page.evaluate(async () => {
      const engine = window.__labEngine;
      if (!engine) return false;

      engine.renderAccumulated(1.0, 0.5 / 30, 8);

      const canvas = document.querySelector("canvas") as HTMLCanvasElement;
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (!gl) return false;

      const pixel = new Uint8Array(4);
      gl.readPixels(
        Math.round(canvas.width / 2),
        Math.round(canvas.height / 2),
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixel,
      );

      // Verify canvas rendered valid pixels
      return pixel[3] > 0;
    });

    expect(success).toBe(true);
  });

  test("shadow presets: renders soft, medium, dramatic without errors", async ({ page }) => {
    await page.goto("/lab?fixture=card-hero&t=0&aspect=16:9");
    await page.waitForFunction(() => window.__labReady === true, { timeout: 15000 });

    const success = await page.evaluate(async () => {
      const engine = window.__labEngine;
      if (!engine) return false;

      const doc = JSON.parse(JSON.stringify(window.__fixtures?.["card-hero"]));

      for (const preset of ["none", "soft", "medium", "dramatic"] as const) {
        doc.style.shadow = preset;
        await engine.setDocument(doc, window.__createLabAssetProvider!());
        engine.renderAt(0);
      }

      return true;
    });

    expect(success).toBe(true);
  });
});
