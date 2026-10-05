import { expect } from "@playwright/test";
import { evaluate } from "../../src/motion";
import type { ProjectDoc } from "../../src/doc/types";

interface GlyphReadback {
  doc: ProjectDoc;
  t: number;
  width: number;
  height: number;
  words: { x: number; y: number; w: number; h: number }[];
  alpha: number[];
  pixels: Uint8ClampedArray | Uint8Array;
}

export function decode(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
export function encode(c: number): number {
  return (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255;
}
/** Independent Canvas coverage → linear-light compositing oracle. */
export function expectGlyphCompositing(result: GlyphReadback, fg: string, bg: string): void {
  const textFrame = evaluate(result.doc, result.t).layers[0].frame.texts[0];
  const wordFrame = textFrame.words[0];
  const opacity = wordFrame.opacity * textFrame.opacity;
  const word = result.words[0];
  const blockX = Math.round((1280 - result.width) / 2);
  const blockY = Math.round((720 - result.height) / 2) + (wordFrame.dy * 720) / 100;
  const alphaAt = (x: number, y: number) => {
    const at = (x: number, y: number) =>
      result.alpha[
        Math.max(0, Math.min(result.height - 1, y)) * result.width +
          Math.max(0, Math.min(result.width - 1, x))
      ];
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    return (
      (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) +
      (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy
    );
  };
  const taps = [
    [0, 0, 0.25],
    [1, 0, 0.125],
    [-1, 0, 0.125],
    [0, 1, 0.125],
    [0, -1, 0.125],
    [1, 1, 0.0625],
    [-1, 1, 0.0625],
    [1, -1, 0.0625],
    [-1, -1, 0.0625],
  ];
  const foreground = [1, 3, 5].map((i) => parseInt(fg.slice(i, i + 2), 16));
  const backdrop = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16));
  let checked = 0;
  let maximumError = 0;
  for (let y = Math.ceil(blockY + word.y + 2); y < blockY + word.y + word.h - 2; y++) {
    for (let x = blockX + word.x + 2; x < blockX + word.x + word.w - 2; x++) {
      const localX = x - blockX;
      const localY = y - blockY;
      const coverage =
        wordFrame.blur > 0.001
          ? taps.reduce(
              (sum, [dx, dy, weight]) =>
                sum + alphaAt(localX + dx * wordFrame.blur, localY + dy * wordFrame.blur) * weight,
              0,
            )
          : alphaAt(localX, localY);
      const alpha = coverage * opacity;
      if (alpha <= 0.02 || alpha >= 0.98) continue;
      checked++;
      for (let channel = 0; channel < 3; channel++) {
        const expected = encode(
          decode(foreground[channel]) * alpha + decode(backdrop[channel]) * (1 - alpha),
        );
        maximumError = Math.max(
          maximumError,
          Math.abs(result.pixels[(y * 1280 + x) * 4 + channel] - expected),
        );
      }
    }
  }
  expect(checked, "real translucent edge pixels must be measured").toBeGreaterThan(50);
  expect(maximumError, "glyph edges must match independent linear compositing").toBeLessThanOrEqual(
    2,
  );
}
