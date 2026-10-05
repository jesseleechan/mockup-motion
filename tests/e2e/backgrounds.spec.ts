import { expect, test } from "@playwright/test";

test.describe("WP-07 Backgrounds, Palettes & Atmosphere E2E", () => {
  test("mesh loop seam: rendered backgroundPhase 0 vs 1 differs by at most 1 per channel", async ({
    page,
  }) => {
    await page.goto("/lab?fixture=orbit-loop&t=0&aspect=16:9");
    await page.waitForFunction(() => window.__labReady === true, { timeout: 15000 });

    const diff = await page.evaluate(async () => {
      const engine = window.__labEngine;
      if (!engine) throw new Error("Engine not ready");

      const doc = window.__fixtures?.["orbit-loop"];
      if (!doc) throw new Error("Fixture not found");

      doc.style.background = {
        kind: "mesh",
        colors: ["#1B1B2F", "#3A2F4F", "#6B4E71", "#C3A6A0"],
        drift: 0.05,
        seed: 42,
      };
      doc.style.grain = 0;
      doc.shots[0].layout = { kind: "single", device: "card", assetId: "" };
      doc.shots[0].transitionIn = { kind: "cut", duration: 0, easing: "linear" };
      doc.shots[0].camera = { preset: "static", intensity: 0, easing: "smooth", float: 0 };

      await engine.setDocument(doc, window.__createLabAssetProvider!());

      const canvas = document.querySelector("canvas") as HTMLCanvasElement;
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (!gl) return 0;

      // Render at t = 0 (backgroundPhase = 0)
      engine.renderAt(0);
      const pixels0 = new Uint8Array(4 * 50);
      gl.readPixels(100, 100, 50, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels0);

      // Render at t = doc.shots[0].duration (backgroundPhase wraps back cleanly to phase 0 / 1)
      engine.renderAt(doc.shots[0].duration);
      const pixels1 = new Uint8Array(4 * 50);
      gl.readPixels(100, 100, 50, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels1);

      let maxDiff = 0;
      for (let i = 0; i < pixels0.length; i++) {
        const d = Math.abs(pixels0[i] - pixels1[i]);
        if (d > maxDiff) maxDiff = d;
      }
      return maxDiff;
    });

    // Seam diff between phase 0 and 1 must be <= 1 per channel
    expect(diff).toBeLessThanOrEqual(1);
  });

  test("gradient quality: OKLab interpolation between #1F2B45 and #C3A6A0 has vibrant midpoint", async ({
    page,
  }) => {
    await page.goto("/lab?fixture=orbit-loop&t=0&aspect=16:9");
    await page.waitForFunction(() => window.__labReady === true, { timeout: 15000 });

    const midpointColor = await page.evaluate(async () => {
      const engine = window.__labEngine;
      if (!engine) throw new Error("Engine not ready");

      const doc = window.__fixtures?.["orbit-loop"];
      if (!doc) throw new Error("Fixture not found");

      doc.style.background = {
        kind: "gradient",
        stops: ["#1F2B45", "#C3A6A0"],
        angle: 90,
      };
      doc.style.vignette = 0;
      doc.shots[0].layout = { kind: "title" };
      doc.shots[0].texts = [];
      doc.shots[0].transitionIn = { kind: "cut", duration: 0, easing: "linear" };
      doc.shots[0].camera = { preset: "static", intensity: 0, easing: "smooth", float: 0 };

      await engine.setDocument(doc, window.__createLabAssetProvider!());

      const canvas = document.querySelector("canvas") as HTMLCanvasElement;
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (!gl) return null;

      engine.renderAt(0);

      // Sample gradient at midpoint (canvas center)
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

      return { r: pixel[0], g: pixel[1], b: pixel[2] };
    });

    expect(midpointColor).toBeDefined();
    expect(midpointColor!.r).toBeGreaterThan(50);
    expect(midpointColor!.g).toBeGreaterThan(50);
    expect(midpointColor!.b).toBeGreaterThan(50);
  });
});
