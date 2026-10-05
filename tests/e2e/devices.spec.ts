import { expect, test } from "@playwright/test";
import { avgRegion, inkBounds, renderAndRead } from "../helpers/pixels";

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
    await page.waitForFunction(() => Boolean(window.__labTestImages && window.__labSetDoc));
    await page.evaluate(async () => {
      const fixture = window.__fixtures?.["devices-browser"];
      const images = window.__labTestImages;
      const setDoc = window.__labSetDoc;
      const engine = window.__labEngine;
      if (!fixture || !images || !setDoc || !engine)
        throw new Error("Lab pixel hooks are unavailable");
      engine.resize(1280, 720);
      const doc = structuredClone(fixture);
      doc.style.background = { kind: "solid", color: "#808080" };
      doc.style.grain = 0;
      doc.style.vignette = 0;
      doc.shots[0].camera = { preset: "static", intensity: 0, easing: "smooth", float: 0 };
      const layout = doc.shots[0].layout;
      if (layout.kind !== "single") throw new Error("Expected a single browser layout");
      const assetId = "f00-edge-columns";
      layout.assetId = assetId;
      doc.assets.push({
        id: assetId,
        kind: "image",
        name: assetId,
        mime: "image/png",
        bytes: 1,
        width: 1600,
        height: 1000,
      });
      const bitmap = await images.edgeColumns(1600, 1000);
      await setDoc(doc, { [assetId]: bitmap });
    });
    const pixels = await page.evaluate(renderAndRead, 0);
    const sampledBackground = avgRegion(pixels, 0, 0, 8, 8).map(Math.round) as [
      number,
      number,
      number,
    ];
    const bounds = inkBounds(pixels, sampledBackground, 12);
    expect(bounds, "browser screen should be visible against the solid background").not.toBeNull();
    if (!bounds) throw new Error("Browser screen bounds were not found");
    const rows = Math.max(1, Math.floor(bounds.height * 0.25));
    const magentaCountNear = (x: number) => {
      let count = 0;
      for (let y = bounds.y + rows; y < bounds.y + bounds.height - rows; y++) {
        for (let dx = 0; dx <= 6; dx++) {
          const i = (y * pixels.width + x + dx) * 4;
          if (
            i >= 0 &&
            i + 2 < pixels.data.length &&
            pixels.data[i] > 200 &&
            pixels.data[i + 1] < 80 &&
            pixels.data[i + 2] > 200
          )
            count++;
        }
      }
      return count;
    };
    expect(magentaCountNear(bounds.x)).toBeGreaterThan(0);
    expect(magentaCountNear(bounds.x + bounds.width - 7)).toBeGreaterThan(0);
  });

  test("renders solid bodies at yaw 34° / pitch 28° (isoDrift) with no errors", async ({
    page,
  }) => {
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
