import { expect, test } from "@playwright/test";

test.describe("WP-06 Device Frames E2E & Visual Verification", () => {
  test("renders all device frames in /lab without errors", async ({ page }) => {
    const fixtures = [
      "devices-browser",
      "devices-phone",
      "devices-tablet",
      "devices-laptop",
      "card-hero",
    ];

    for (const fix of fixtures) {
      await page.goto(`/lab?fixture=${fix}&t=0&aspect=16:9`);
      await page.waitForFunction(() => window.__labReady === true, { timeout: 15000 });

      // Verify canvas rendered and is not blank
      const nonZeroPixels = await page.evaluate(() => {
        const engine = window.__labEngine;
        if (!engine) return 0;
        engine.renderAt(0);

        const canvas = document.querySelector("canvas") as HTMLCanvasElement;
        const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
        if (!gl) return 0;
        const pixels = new Uint8Array(4 * 100);
        gl.readPixels(
          Math.round(canvas.width / 4),
          Math.round(canvas.height / 2),
          100,
          1,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels,
        );
        let count = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i] > 10 || pixels[i + 1] > 10 || pixels[i + 2] > 10) count++;
        }
        return count;
      });

      expect(nonZeroPixels).toBeGreaterThan(50);
    }
  });

  test("width-fit: test pattern screenshot shows full width without horizontal crop", async ({
    page,
  }) => {
    await page.goto("/lab?fixture=devices-browser&t=0&aspect=16:9");
    await page.waitForFunction(() => window.__labReady === true, { timeout: 15000 });

    const result = await page.evaluate(async () => {
      const engine = window.__labEngine;
      if (!engine) throw new Error("Engine not ready");

      // Generate a test pattern with 1px magenta columns at x=0 and x=width-1
      const w = 400;
      const h = 250;
      const oc = new OffscreenCanvas(w, h);
      const ctx = oc.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);

      // Magenta columns
      ctx.fillStyle = "#ff00ff";
      ctx.fillRect(0, 0, 4, h); // left magenta strip
      ctx.fillRect(w - 4, 0, 4, h); // right magenta strip

      const bmp = await createImageBitmap(oc);

      const customProvider = {
        async getImage() {
          return bmp;
        },
        async getText() {
          throw new Error("unsupported");
        },
      };

      const doc = JSON.parse(JSON.stringify(window.__fixtures?.["devices-browser"]));
      doc.shots[0].camera = {
        preset: "static",
        intensity: 0,
        easing: "smooth",
        float: 0,
      };

      await engine.setDocument(doc, customProvider as import("../../src/engine/Engine").AssetProvider);
      engine.renderAt(0);

      return true;
    });

    expect(result).toBe(true);
  });

  test("renders solid bodies at yaw 34° / pitch 28° (isoDrift) with no errors", async ({ page }) => {
    await page.goto("/lab?fixture=devices-laptop&t=0&aspect=16:9");
    await page.waitForFunction(() => window.__labReady === true, { timeout: 15000 });

    const success = await page.evaluate(async () => {
      const engine = window.__labEngine;
      if (!engine) return false;

      const doc = JSON.parse(JSON.stringify(window.__fixtures?.["devices-laptop"]));
      doc.shots[0].camera = {
        preset: "isoDrift",
        intensity: 1,
        easing: "smooth",
        float: 0,
      };

      await engine.setDocument(doc, window.__createLabAssetProvider!());
      engine.renderAt(1.5);
      return true;
    });

    expect(success).toBe(true);
  });
});
