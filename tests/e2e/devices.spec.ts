import { expect, test, type Page } from "@playwright/test";
import { avgRegion, inkBounds, renderAndRead, screenLeaks } from "../helpers/pixels";

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
    // Still mode fixes the canvas at 1280×720, so the lab's ResizeObserver cannot
    // shrink it while the test bitmap loads.
    await page.goto("/lab?still=1&fixture=devices-browser&t=0&aspect=16:9&w=1280");
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

  // Card screens showed a light dotted diagonal or a light line through the middle (P02, P04
  // evidence). It was not z-fighting: where the rounded box's distance is flat across a 2 × 2
  // pixel quad (its medial axis), fwidth(d) is 0, smoothstep(-0, 0, d) is undefined, SwiftShader
  // returned 1 and the screen discarded the quad, so the slab behind showed through. The frontal
  // frames leaked before the fix; the tilted ones check that it holds off-axis.
  test("card screens hide the slab behind them, frontal and tilted", async ({ page }) => {
    await openCardLab(page);
    const cases: CardCase[] = [
      // P04's evidence frame: Frames at 4:5, 1080 px wide, t = 10 s.
      {
        name: "Frames, 4:5 at 1080 px",
        aspect: "4:5",
        width: 1080,
        tilt: null,
        shotFrom: "frames-4x5",
        preset: "static",
        t: 10,
      },
      // P02's evidence frame: the desktop slider on the y axis at 1:1, 1200 px wide, t = 0.
      {
        name: "slider-y, 1:1 at 1200 px",
        aspect: "1:1",
        width: 1200,
        tilt: null,
        shotFrom: "slider-y",
        preset: "static",
        t: 0,
      },
      // The dotted 45° diagonal from P04 (whole quads missing along the medial axis).
      {
        name: "single card, 1:1 at 1079 px",
        aspect: "1:1",
        width: 1079,
        tilt: null,
        preset: "static",
        t: 0,
      },
      // A light line through the middle of a card in a moving row.
      {
        name: "card rows, 16:9 at 1276 px",
        aspect: "16:9",
        width: 1276,
        tilt: 0,
        preset: "static",
        t: 0.5,
      },
      {
        name: "card rows, 1:1 at 1084 px",
        aspect: "1:1",
        width: 1084,
        tilt: 0,
        preset: "static",
        t: 0.5,
      },
      {
        name: "single card, heroTilt start",
        aspect: "16:9",
        width: 1200,
        tilt: null,
        preset: "heroTilt",
        t: 0,
      },
      {
        name: "single card, heroTilt end",
        aspect: "16:9",
        width: 1200,
        tilt: null,
        preset: "heroTilt",
        t: 5,
      },
      { name: "card rows, tilt 8°", aspect: "16:9", width: 1200, tilt: 8, preset: "static", t: 2 },
    ];
    for (const c of cases) {
      await setCardDoc(page, c);
      const pixels = await page.evaluate(renderAndRead, c.t);
      const leaks = screenLeaks(pixels, SCREEN_GREY);
      expect(leaks.screenPixels, `${c.name}: grey screen pixels`).toBeGreaterThan(50000);
      expect(leaks.samples, `${c.name}: screen pixels that are not the screenshot`).toEqual([]);
    }
  });

  // The frames above depend on where rounding puts a quad. Giving every screen vertex the same
  // UV makes the distance flat across the whole screen, so fwidth(d) is 0 on every fragment.
  test("a card screen stays opaque where its edge distance is flat", async ({ page }) => {
    await openCardLab(page);
    const c: CardCase = {
      name: "flat UVs",
      aspect: "16:9",
      width: 1200,
      tilt: null,
      preset: "static",
      t: 0,
    };
    await setCardDoc(page, c);
    const flattened = await page.evaluate(() => {
      const engine = window.__labEngine as unknown as { scene: import("three").Scene } | undefined;
      if (!engine) throw new Error("Lab engine is not ready");
      let count = 0;
      engine.scene.traverse((object) => {
        const mesh = object as import("three").Mesh;
        const material = mesh.material as import("three").ShaderMaterial | undefined;
        if (!mesh.isMesh || !material?.uniforms?.uBorderWidth) return;
        const uv = mesh.geometry.getAttribute("uv");
        for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, 0.5);
        uv.needsUpdate = true;
        count++;
      });
      return count;
    });
    expect(flattened, "the card's screen mesh").toBe(1);
    const pixels = await page.evaluate(renderAndRead, c.t);
    const leaks = screenLeaks(pixels, SCREEN_GREY);
    expect(leaks.screenPixels, "grey screen pixels").toBeGreaterThan(200000);
    expect(leaks.samples, "screen pixels that are not the screenshot").toEqual([]);
  });
});

// The screenshot is flat mid grey. The background (#3F3F46) and the light card slab
// (#F4F4F5, lit) are both far from it, so either one showing inside the screen counts as a leak.
const SCREEN_GREY = [128, 128, 128] as const;

interface CardCase {
  name: string;
  aspect: "16:9" | "1:1" | "4:5";
  width: number;
  /** null: one card; otherwise two rows of cards at this tilt. */
  tilt: number | null;
  /** A lab fixture whose first shot replaces that layout, with grey screenshots. */
  shotFrom?: string;
  preset: "static" | "heroTilt";
  t: number;
}

async function openCardLab(page: Page): Promise<void> {
  await page.goto("/lab?still=1&fixture=card-hero&t=0&aspect=4:5&w=1080");
  await page.waitForFunction(() => window.__labReady === true, { timeout: 15000 });
  await page.waitForFunction(() => Boolean(window.__labTestImages && window.__labSetDoc));
}

async function setCardDoc(page: Page, c: CardCase): Promise<void> {
  await page.evaluate(async (c) => {
    const fixture = window.__fixtures?.["card-hero"];
    const images = window.__labTestImages;
    const setDoc = window.__labSetDoc;
    const engine = window.__labEngine;
    if (!fixture || !images || !setDoc || !engine)
      throw new Error("Lab pixel hooks are unavailable");
    const [aw, ah] = c.aspect.split(":").map(Number);
    engine.resize(c.width, Math.round((c.width * ah) / aw));
    const doc = structuredClone(fixture);
    doc.aspect = c.aspect;
    doc.style.background = { kind: "solid", color: "#3F3F46" };
    doc.style.frameAppearance = "light";
    doc.style.shadow = "none";
    doc.style.grain = 0;
    doc.style.vignette = 0;
    const assetId = "card-grey";
    doc.assets = [
      {
        id: assetId,
        kind: "image",
        name: assetId,
        mime: "image/png",
        bytes: 1,
        width: 1600,
        height: 1000,
      },
    ];
    doc.shots[0].layout =
      c.tilt === null
        ? { kind: "single", device: "card", assetId }
        : { kind: "rows", rows: 2, device: "card", tilt: c.tilt, speed: 0.35, assetIds: [assetId] };
    doc.shots[0].camera = { preset: c.preset, intensity: 1, easing: "smooth", float: 0 };
    if (c.shotFrom) {
      const shot = structuredClone(window.__fixtures?.[c.shotFrom]?.shots[0]);
      if (!shot || !("assetIds" in shot.layout)) {
        throw new Error(`${c.shotFrom} has no multi-card layout`);
      }
      shot.layout.assetIds = shot.layout.assetIds.map(() => assetId);
      doc.shots[0] = shot;
    }
    const bitmap = await images.bands(1600, 1000, ["#808080"]);
    await setDoc(doc, { [assetId]: bitmap });
  }, c);
}
