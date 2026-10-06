import { expect, test } from "@playwright/test";
import { CURATED_FONT_PAIRS } from "../../src/assets/fonts";

test.describe("WP-10 Text & Typography E2E & Visual Verification", () => {
  test("renders text-title fixture in /lab and verifies text is visible on canvas", async ({
    page,
  }) => {
    await page.goto("/lab?fixture=text-title&t=1.5&aspect=16:9");
    await page.waitForFunction(() => window.__labReady === true, { timeout: 15000 });

    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();

    // Verify canvas pixels are non-blank
    const stats = await page.evaluate(() => {
      const c = document.querySelector("canvas") as HTMLCanvasElement;
      const ctx = c.getContext("webgl2") || c.getContext("webgl");
      if (!ctx) return null;

      // Sample a horizontal stripe through the center of the canvas where text is anchored
      const w = 200;
      const h = 50;
      const startX = Math.round((c.width - w) / 2);
      const startY = Math.round((c.height - h) / 2);
      const pixels = new Uint8Array(w * h * 4);

      window.__labEngine?.renderAt(1.5);
      ctx.readPixels(startX, startY, w, h, ctx.RGBA, ctx.UNSIGNED_BYTE, pixels);

      let nonZeroCount = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        // Look for light text pixels (R, G, B > 100)
        if (pixels[i] > 100 && pixels[i + 1] > 100 && pixels[i + 2] > 100) {
          nonZeroCount++;
        }
      }

      return { totalPixels: w * h, lightTextPixels: nonZeroCount };
    });

    expect(stats).not.toBeNull();
    // Non-zero light text pixels should be present on the dark background
    expect(stats!.lightTextPixels).toBeGreaterThan(50);
  });

  test("all curated font pairs render without errors in the engine", async ({ page }) => {
    await page.goto("/lab?fixture=text-title&t=2.0&aspect=16:9");
    await page.waitForFunction(() => window.__labReady === true, { timeout: 15000 });

    const result = await page.evaluate(async (pairs) => {
      const engine = window.__labEngine;
      if (!engine) return false;

      const baseDoc = JSON.parse(JSON.stringify(window.__fixtures?.["text-title"]));

      for (const pair of pairs) {
        baseDoc.style.fonts = {
          display: pair.display,
          body: pair.body,
        };

        await engine.setDocument(baseDoc, window.__createLabAssetProvider!());
        engine.renderAt(2.0);
      }

      return true;
    }, CURATED_FONT_PAIRS);

    expect(result).toBe(true);
  });

  test("text animation timings: renders frame strip at 0, 0.2, 0.4, 0.6, 1.0s without errors", async ({
    page,
  }) => {
    await page.goto("/lab?fixture=text-title&t=0&aspect=16:9");
    await page.waitForFunction(() => window.__labReady === true, { timeout: 15000 });

    const timeSteps = [0.0, 0.2, 0.4, 0.6, 1.0, 2.0];

    const rendered = await page.evaluate((times) => {
      const engine = window.__labEngine;
      if (!engine) return false;

      for (const t of times) {
        engine.renderAt(t);
      }
      return true;
    }, timeSteps);

    expect(rendered).toBe(true);
  });

  test("exports 2s MP4 video with text layer via WebCodecs and verifies valid output", async ({
    page,
  }) => {
    await page.goto("/lab?fixture=text-title&t=0&aspect=16:9");
    await page.waitForFunction(() => window.__labReady === true, { timeout: 15000 });

    // Playwright's bundled Chromium has no H.264 encoder; only there may this test skip.
    const canEncodeAvc = await page.evaluate(async () => {
      const entry = performance
        .getEntriesByType("resource")
        .find((resource) => new URL(resource.name).pathname.endsWith("/deps/mediabunny.js"));
      if (!entry) throw new Error("The app's optimized Mediabunny module was not loaded");
      const media = await import(/* @vite-ignore */ entry.name);
      return media.canEncodeVideo("avc", { width: 1280, height: 720 }) as Promise<boolean>;
    });
    if (!canEncodeAvc) test.skip(true, "H.264 encoder unavailable in this Chromium build");

    const exportResult = await page.evaluate(async () => {
      const exportFn = window.__exportWithEngine;
      const doc = JSON.parse(JSON.stringify(window.__fixtures?.["text-title"]));
      const provider = window.__createLabAssetProvider?.();

      if (!exportFn || !doc || !provider) {
        throw new Error("Export dependencies missing in lab window");
      }

      doc.shots[0].duration = 2.0;

      const result = await exportFn(doc, provider, {
        destination: "custom",
        resolution: 720,
        fps: 30,
        quality: "web",
        format: "mp4",
        supersample: 1,
        motionBlur: false,
      });

      return {
        mime: result.mime,
        byteLength: result.blob.size,
        verification: result.verification,
      };
    });

    expect(exportResult.mime).toContain("mp4");
    expect(exportResult.byteLength).toBeGreaterThan(10000);
    const [mp4] = exportResult.verification;
    expect(mp4.label).toBe("MP4");
    expect(mp4.result.warnings).toEqual([]);
    expect(mp4.result.actual?.codec).toMatch(/^avc/);
    expect([mp4.result.actual?.width, mp4.result.actual?.height]).toEqual([1280, 720]);
  });
});
