import { expect, test } from "@playwright/test";
import type { ProjectDoc } from "../../src/doc/types";
import type { AssetProvider, Engine } from "../../src/engine/Engine";
import type { labTestImages } from "../../src/lab/test-images";
import type { schedule } from "../../src/motion";

declare global {
  interface Window {
    __labReady?: boolean;
    __labEngine?: Engine;
    __createLabAssetProvider?: () => AssetProvider;
    __fixtures?: Record<string, ProjectDoc>;
    __labSchedule?: typeof schedule;
    __labTestImages?: typeof labTestImages;
  }
}

type Rgb = [number, number, number];
interface ScreenSample {
  nodeId: string;
  assetId: string | null;
  /** Mean colour per cell of an 8x8 grid over the screen's central 40%; null = not fully visible. */
  cells: (Rgb | null)[];
}

const MIN_COMMON_CELLS = 8;

/**
 * Two screens differ when, over the centre cells both show, some channel's mean differs by more
 * than 6. Comparing the same cells means a clipped screen is never mistaken for different content.
 * Returns null when they share too few visible cells to compare.
 */
function centresDiffer(a: ScreenSample, b: ScreenSample): boolean | null {
  const common = a.cells.flatMap((cell, i) => (cell && b.cells[i] ? [i] : []));
  if (common.length < MIN_COMMON_CELLS) return null;
  const mean = (s: ScreenSample) =>
    [0, 1, 2].map((c) => common.reduce((sum, i) => sum + s.cells[i]![c], 0) / common.length);
  const ma = mean(a);
  const mb = mean(b);
  return ma.some((value, c) => Math.abs(value - mb[c]) > 6);
}

test("F04: Frames shows different demo sites on its screens", async ({ page }) => {
  // Start asset-free so the engine's texture cache cannot hold images from the first render.
  await page.goto("/lab?fixture=text-title&t=0&aspect=16:9");
  await page.waitForFunction(() => window.__labReady === true);
  const result = await page.evaluate(async () => {
    // Frames' rows of cards at 16:9.
    const doc = structuredClone(window.__fixtures?.["frames-16x9"]);
    const engine = window.__labEngine;
    const createProvider = window.__createLabAssetProvider;
    const scheduleDoc = window.__labSchedule;
    const images = window.__labTestImages;
    if (!doc || !engine || !createProvider || !scheduleDoc || !images)
      throw new Error("F04 lab hooks are unavailable");
    const layout = doc.shots[0].layout;
    if (layout.kind !== "rows") throw new Error("Expected a rows layout");
    // Vignette darkens screens near the frame edge; measure the screenshots alone.
    doc.style.vignette = 0;
    doc.style.grain = 0;
    const width = 1280;
    const height = 720;
    const t = scheduleDoc(doc).total * 0.5;
    const provider = createProvider();
    // The lab's ResizeObserver can resize the engine while setDocument awaits its fetches, so
    // each render sizes the engine in the same task as the render and readback.
    const renderFrame = () => {
      engine.resize(width, height);
      engine.renderAt(t);
      const frame = engine.readPixels();
      if (frame.length !== width * height * 4) throw new Error(`Readback is ${frame.length} bytes`);
      return frame;
    };

    // Mask pass: the same layout with every screen solid magenta, under separate ids of the same
    // size so node positions match and the texture cache cannot mix the passes. Pick reports
    // made-up UVs for shadow and frame meshes, so only magenta pixels are screen pixels.
    const maskDoc = structuredClone(doc);
    const maskLayout = maskDoc.shots[0].layout;
    if (maskLayout.kind !== "rows") throw new Error("Expected a rows layout");
    maskLayout.assetIds = maskLayout.assetIds.map((id) => `mask:${id}`);
    maskDoc.assets = doc.assets.map((asset) => ({ ...asset, id: `mask:${asset.id}` }));
    await engine.setDocument(maskDoc, {
      async getImage(id, maxWidth) {
        const asset = maskDoc.assets.find((a) => a.id === id);
        if (!asset?.width || !asset.height) throw new Error(`No mask size for ${id}`);
        const w = Math.min(asset.width, maxWidth);
        return images.bands(w, Math.round((asset.height * w) / asset.width), ["#FF00FF"]);
      },
      getText: provider.getText.bind(provider),
    });
    const mask = renderFrame();

    const requested = new Set<string>();
    await engine.setDocument(doc, {
      async getImage(id, maxWidth) {
        requested.add(id);
        return provider.getImage(id, maxWidth);
      },
      getText: provider.getText.bind(provider),
    });
    const pixels = renderFrame();
    const nodes = engine.debugInfo().nodes;

    // Bin each screen's central 40% (uv 0.3..0.7) into 8x8 cells of mean colour.
    const lo = 0.3;
    const hi = 0.7;
    const grid = 8;
    const cellOf = (x: number) => Math.min(grid - 1, Math.floor(((x - lo) / (hi - lo)) * grid));
    const sums = new Map<string, number[][]>();
    const step = 4;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const i = (y * width + x) * 4;
        if (mask[i] < 240 || mask[i + 1] > 15 || mask[i + 2] < 240) continue;
        const hit = engine.pick(x, y);
        if (!hit || hit.u < lo || hit.u > hi || hit.v < lo || hit.v > hi) continue;
        const cells =
          sums.get(hit.nodeId) ?? Array.from({ length: grid * grid }, () => [0, 0, 0, 0]);
        const cell = cells[cellOf(hit.v) * grid + cellOf(hit.u)];
        cell[0] += pixels[i];
        cell[1] += pixels[i + 1];
        cell[2] += pixels[i + 2];
        cell[3]++;
        sums.set(hit.nodeId, cells);
      }
    }
    // Rows screens are all the same size, so a fully visible cell holds about the most samples of
    // any cell. One cut by the frame edge holds fewer and would average only part of its area.
    const fullCell = Math.max(...[...sums.values()].flatMap((cells) => cells.map((c) => c[3])));
    const screens = [...sums.entries()].map(([nodeId, cells]) => ({
      nodeId,
      assetId: nodes.find((node) => node.id === nodeId)?.assetId ?? null,
      cells: cells.map(([r, g, b, n]) => (n >= 0.85 * fullCell ? [r / n, g / n, b / n] : null)),
    }));
    return {
      requested: [...requested].sort(),
      unloaded: nodes.filter((n) => n.assetId && !n.textureLoaded).map((n) => n.id),
      fullCell,
      screens: screens as ScreenSample[],
    };
  });

  const summary = result.screens.map((s) => ({
    node: s.nodeId,
    asset: s.assetId,
    visibleCells: s.cells.filter(Boolean).length,
  }));
  console.log(`F04 samples per full cell: ${result.fullCell}; screens: ${JSON.stringify(summary)}`);
  // Frames' preview holds five demo captures (src/templates/demo-preview.ts).
  expect(result.requested, "the provider must load every distinct demo capture").toHaveLength(5);
  expect(result.unloaded, "every screen has its texture").toEqual([]);

  // Greedily collect screens that are comparable with, and differ from, every one already chosen.
  const distinct: ScreenSample[] = [];
  for (const screen of result.screens) {
    if (distinct.every((other) => centresDiffer(screen, other) === true)) distinct.push(screen);
  }
  console.log("F04 visually distinct screens:", distinct.map((s) => s.assetId).join(", "));
  expect(
    distinct.length,
    `3 screens with different centres; screens: ${JSON.stringify(summary)}`,
  ).toBeGreaterThanOrEqual(3);
});
