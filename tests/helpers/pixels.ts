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

/** Centroids and counts of the pure red, green, blue and yellow quadrant fixture colours (F01). */
export function quadrantCentroids(pixels: PixelBuffer) {
  const points = {
    red: { x: 0, y: 0, count: 0 },
    green: { x: 0, y: 0, count: 0 },
    blue: { x: 0, y: 0, count: 0 },
    yellow: { x: 0, y: 0, count: 0 },
  };
  for (let y = 0; y < pixels.height; y++) {
    for (let x = 0; x < pixels.width; x++) {
      const i = (y * pixels.width + x) * 4;
      const r = pixels.data[i];
      const g = pixels.data[i + 1];
      const b = pixels.data[i + 2];
      const point =
        r > 140 && g < 100 && b < 100
          ? points.red
          : g > 140 && r < 100 && b < 100
            ? points.green
            : b > 140 && r < 100 && g < 100
              ? points.blue
              : r > 140 && g > 140 && b < 100
                ? points.yellow
                : null;
      if (point) {
        point.x += x;
        point.y += y;
        point.count++;
      }
    }
  }
  for (const point of Object.values(points)) {
    if (point.count > 0) {
      point.x /= point.count;
      point.y /= point.count;
    }
  }
  return points;
}

/**
 * Finds pixels inside flat-coloured card screens that are not the screen colour. Scans every row
 * and every column for runs of screen-coloured pixels (a card screen is convex, so one run per
 * card per line) and checks the pixels inside each run, `inset` px from its ends and from the
 * card's edges. A run bridges gaps narrower than `inset`, so a dot or a line across the scan
 * direction counts as a leak; a line along a row is caught by the column scan. The light slab is
 * the only thing behind a screen, so a leak is the slab (or the hairline border) showing through.
 * `screenPixels` counts the pixels the row scan checked.
 */
export function screenLeaks(
  px: PixelBuffer,
  screen: readonly [number, number, number],
  inset = 24,
): { screenPixels: number; samples: string[]; count: number } {
  const diff = (i: number) =>
    Math.max(
      Math.abs(px.data[i] - screen[0]),
      Math.abs(px.data[i + 1] - screen[1]),
      Math.abs(px.data[i + 2] - screen[2]),
    );
  // A flat screenshot renders within dither (±1) of its colour. One threshold for both tests, so
  // an anti-aliased edge pixel can neither start a run nor count as a leak inside one.
  const tolerance = 4;
  const isScreen = (x: number, y: number) => diff((y * px.width + x) * 4) <= tolerance;
  const leaks = new Set<number>();
  const rows = scanLines(px.height, px.width, (line, pos) => [pos, line], isScreen, inset);
  const columns = scanLines(px.width, px.height, (line, pos) => [line, pos], isScreen, inset);
  for (const [x, y] of [...rows.inside, ...columns.inside]) {
    const i = (y * px.width + x) * 4;
    if (diff(i) > tolerance) leaks.add(i);
  }
  const samples = [...leaks].slice(0, 8).map((i) => {
    const x = (i / 4) % px.width;
    const y = Math.floor(i / 4 / px.width);
    return `(${x}, ${y}) = ${px.data[i]}, ${px.data[i + 1]}, ${px.data[i + 2]}`;
  });
  return { screenPixels: rows.inside.length, samples, count: leaks.size };
}

/** The pixels inside screen runs along one axis; `at` maps (line, position) to (x, y). */
function scanLines(
  lines: number,
  length: number,
  at: (line: number, pos: number) => [number, number],
  isScreen: (x: number, y: number) => boolean,
  inset: number,
): { inside: [number, number][] } {
  const screenAt = (line: number, pos: number) => isScreen(...at(line, pos));
  const lineHasScreen: boolean[] = [];
  for (let line = 0; line < lines; line++) {
    let any = false;
    for (let pos = 0; pos < length && !any; pos++) any = screenAt(line, pos);
    lineHasScreen.push(any);
  }
  const inside: [number, number][] = [];
  for (let line = 0; line < lines; line++) {
    // Skip lines near a card's edge across the scan direction.
    let near = false;
    for (let d = -inset; d <= inset && !near; d++) {
      const other = line + d;
      near = other < 0 || other >= lines || !lineHasScreen[other];
    }
    if (near) continue;
    let pos = 0;
    while (pos < length) {
      while (pos < length && !screenAt(line, pos)) pos++;
      const start = pos;
      // A run ends at a gap wider than any leak (a gap between cards).
      let end = pos;
      while (pos < length) {
        if (screenAt(line, pos)) {
          end = pos;
          pos++;
          continue;
        }
        let gap = pos;
        while (gap < length && !screenAt(line, gap) && gap - pos < inset) gap++;
        if (gap < length && gap - pos < inset && screenAt(line, gap)) {
          pos = gap;
          continue;
        }
        break;
      }
      for (let p = start + inset; p <= end - inset; p++) inside.push(at(line, p));
    }
  }
  return { inside };
}
