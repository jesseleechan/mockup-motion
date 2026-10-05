import type { Engine } from "../../src/engine/Engine";

export interface PixelBuffer {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

/** Pass directly to page.evaluate so render and readback happen in one browser task. */
export function renderAndRead(t: number): PixelBuffer {
  const engine = (window as Window & { __labEngine?: Engine }).__labEngine;
  if (!engine) throw new Error("Lab engine is not ready");
  engine.renderAt(t);
  const data = engine.readPixels();
  const canvas = document.querySelector("canvas");
  if (!canvas) throw new Error("Lab canvas is missing");
  return { width: canvas.width, height: canvas.height, data };
}

export function avgRegion(
  px: PixelBuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): [number, number, number] {
  const left = Math.max(0, Math.floor(x0));
  const top = Math.max(0, Math.floor(y0));
  const right = Math.min(px.width, Math.ceil(x1));
  const bottom = Math.min(px.height, Math.ceil(y1));
  if (right <= left || bottom <= top) throw new Error("Pixel region is empty");
  const total: [number, number, number] = [0, 0, 0];
  let count = 0;
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const i = (y * px.width + x) * 4;
      total[0] += px.data[i];
      total[1] += px.data[i + 1];
      total[2] += px.data[i + 2];
      count++;
    }
  }
  return total.map((channel) => channel / count) as [number, number, number];
}

export function expectRgbNear(
  actual: readonly number[],
  expected: readonly number[],
  tolerance: number,
): void {
  const differences = actual.map((value, i) => Math.abs(value - expected[i]));
  if (differences.some((difference) => difference > tolerance)) {
    throw new Error(
      `Expected RGB (${expected.join(", ")}) ±${tolerance}, received (${actual.map((n) => n.toFixed(1)).join(", ")})`,
    );
  }
}

export function inkBounds(
  px: PixelBuffer,
  background: readonly [number, number, number],
  threshold: number,
): { x: number; y: number; width: number; height: number } | null {
  let minX = px.width;
  let minY = px.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < px.height; y++) {
    for (let x = 0; x < px.width; x++) {
      const i = (y * px.width + x) * 4;
      if (
        Math.max(
          Math.abs(px.data[i] - background[0]),
          Math.abs(px.data[i + 1] - background[1]),
          Math.abs(px.data[i + 2] - background[2]),
        ) > threshold
      ) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return maxX < minX ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}
