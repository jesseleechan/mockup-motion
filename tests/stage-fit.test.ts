import { describe, expect, it } from "vitest";
import { fitPreview, STAGE_PADDING } from "../src/editor/stage/fit";

describe("fitPreview (F05)", () => {
  it("is limited by height in a wide stage", () => {
    const size = fitPreview(1200, 600, 16 / 9);
    const availHeight = 600 - 2 * STAGE_PADDING;
    expect(size.width).toBe(Math.floor(availHeight * (16 / 9)));
    expect(availHeight - size.height).toBeGreaterThanOrEqual(0);
    expect(availHeight - size.height).toBeLessThanOrEqual(1);
  });

  it("is limited by width in a tall stage", () => {
    const size = fitPreview(500, 1200, 16 / 9);
    expect(size.width).toBe(500 - 2 * STAGE_PADDING);
    expect(size.height).toBe(Math.floor(size.width / (16 / 9)));
  });

  it("keeps the aspect ratio within a pixel and never exceeds the padded stage", () => {
    for (const ratio of [16 / 9, 9 / 16, 1, 4 / 5, 4 / 3]) {
      for (const [w, h] of [
        [1037, 611],
        [640, 900],
        [1920, 400],
      ]) {
        const size = fitPreview(w, h, ratio);
        expect(size.width).toBeLessThanOrEqual(w - 2 * STAGE_PADDING);
        expect(size.height).toBeLessThanOrEqual(h - 2 * STAGE_PADDING);
        expect(Math.abs(size.width / ratio - size.height)).toBeLessThan(1);
      }
    }
  });

  it("scales the fitted size by zoom", () => {
    const fit = fitPreview(1200, 800, 4 / 3);
    const half = fitPreview(1200, 800, 4 / 3, 0.5);
    expect(Math.abs(half.width - fit.width / 2)).toBeLessThanOrEqual(1);
  });

  it("collapses to zero when the stage is smaller than its padding", () => {
    expect(fitPreview(40, 40, 1)).toEqual({ width: 0, height: 0 });
  });
});
