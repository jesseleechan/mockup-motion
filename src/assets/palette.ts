import { formatHex, oklab, oklch } from "culori";
import type { Background } from "../doc/types";

export interface LabColor {
  l: number;
  a: number;
  b: number;
  weight: number;
}

/**
 * Extracts k dominant colors from an RGBA image buffer using k-means clustering in OKLab space.
 * Weights pixels by chromaticity so plain white/grey web page backgrounds do not displace brand colors.
 */
export function dominantColors(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  k = 5,
): string[] {
  if (rgba.length === 0 || w <= 0 || h <= 0) {
    return ["#141417", "#2A2A30", "#F1EDE6", "#3B82F6", "#64748B"];
  }

  // Sample grid of ~64x64 points
  const stepX = Math.max(1, Math.floor(w / 64));
  const stepY = Math.max(1, Math.floor(h / 64));
  const samples: LabColor[] = [];

  for (let y = 0; y < h; y += stepY) {
    for (let x = 0; x < w; x += stepX) {
      const idx = (y * w + x) * 4;
      const alpha = rgba[idx + 3];
      if (alpha < 64) continue; // Skip transparent pixels

      const r = rgba[idx] / 255;
      const g = rgba[idx + 1] / 255;
      const b = rgba[idx + 2] / 255;

      const lab = oklab({ mode: "rgb", r, g, b });
      if (!lab) continue;

      const chroma = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
      // Weight by chroma + base weight so pure neutrals don't drown brand accents
      const weight = chroma * 3.5 + 0.35;

      samples.push({
        l: lab.l,
        a: lab.a,
        b: lab.b,
        weight,
      });
    }
  }

  if (samples.length === 0) {
    return ["#141417", "#2A2A30", "#F1EDE6", "#3B82F6", "#64748B"];
  }

  // Seed k initial centroids deterministically
  const centroids: { l: number; a: number; b: number }[] = [];
  const seedStep = Math.floor(samples.length / k);
  for (let i = 0; i < k; i++) {
    const s = samples[Math.min(samples.length - 1, i * seedStep)];
    centroids.push({ l: s.l, a: s.a, b: s.b });
  }

  // 10 k-means iterations in OKLab
  const clusterWeights = new Float64Array(k);
  const clusterSumL = new Float64Array(k);
  const clusterSumA = new Float64Array(k);
  const clusterSumB = new Float64Array(k);

  for (let iter = 0; iter < 10; iter++) {
    clusterWeights.fill(0);
    clusterSumL.fill(0);
    clusterSumA.fill(0);
    clusterSumB.fill(0);

    for (const sample of samples) {
      let bestDist = Infinity;
      let bestIdx = 0;

      for (let c = 0; c < k; c++) {
        const dl = sample.l - centroids[c].l;
        const da = sample.a - centroids[c].a;
        const db = sample.b - centroids[c].b;
        const dist = dl * dl + da * da + db * db;
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = c;
        }
      }

      const w = sample.weight;
      clusterWeights[bestIdx] += w;
      clusterSumL[bestIdx] += sample.l * w;
      clusterSumA[bestIdx] += sample.a * w;
      clusterSumB[bestIdx] += sample.b * w;
    }

    for (let c = 0; c < k; c++) {
      if (clusterWeights[c] > 0) {
        centroids[c].l = clusterSumL[c] / clusterWeights[c];
        centroids[c].a = clusterSumA[c] / clusterWeights[c];
        centroids[c].b = clusterSumB[c] / clusterWeights[c];
      }
    }
  }

  // Rank centroids by cumulative cluster weight
  const ranked = centroids
    .map((c, i) => ({ ...c, weight: clusterWeights[i] }))
    .sort((a, b) => b.weight - a.weight);

  const result: string[] = [];
  for (const c of ranked) {
    const hex = formatHex(oklab({ mode: "oklab", l: c.l, a: c.a, b: c.b }));
    if (hex && !result.includes(hex)) {
      result.push(hex);
    }
  }

  // Pad to k if needed
  while (result.length < k) {
    result.push(result[0] ?? "#141417");
  }

  return result.slice(0, k);
}

/**
 * Derives 4 candidate backgrounds (light, dark, mesh, ambient) from the extracted palette per quality-bar §6.
 * - Chroma lowered by 40-60% (C <= 0.09 light, C <= 0.12 dark).
 * - Lightness shifted away from the screenshot's average by at least 0.25 L.
 */
export function suggestBackgrounds(palette: string[], assetId = ""): Background[] {
  const parsed = palette.map((hex) => oklch(hex)).filter(Boolean);
  if (parsed.length === 0) {
    return [
      { kind: "solid", color: "#F1EDE6" },
      { kind: "gradient", stops: ["#141417", "#2A2A30"], angle: 145 },
      { kind: "mesh", colors: ["#1B1B2F", "#3A2F4F", "#6B4E71", "#C3A6A0"], drift: 0.05, seed: 1 },
      { kind: "ambient", assetId, blur: 0.8, dim: 0.2 },
    ];
  }

  // Compute screenshot average lightness
  const avgL = parsed.reduce((acc, c) => acc + (c?.l ?? 0.5), 0) / parsed.length;

  // Primary brand accent is the highest-chroma color
  const sortedByChroma = [...parsed].sort((a, b) => (b?.c ?? 0) - (a?.c ?? 0));
  const primary = sortedByChroma[0] ?? parsed[0]!;
  const secondary = sortedByChroma[1] ?? parsed[1] ?? primary;

  // Light suggestion: Lightness >= 0.88 (ensuring |L - avgL| >= 0.25 when avgL is dark/mid),
  // with chroma lowered by 50% (capped at 0.04 for calm elegance)
  const lightTargetL = Math.max(0.88, avgL + 0.25 > 1 ? 0.92 : avgL + 0.25);
  const lightChroma = Math.min((primary.c ?? 0.02) * 0.5, 0.035);
  const lightColor1 = formatHex(oklch({ mode: "oklch", l: lightTargetL, c: lightChroma, h: primary.h ?? 60 }));
  const lightColor2 = formatHex(oklch({ mode: "oklch", l: lightTargetL - 0.06, c: lightChroma * 0.8, h: secondary.h ?? (primary.h ?? 60) + 20 }));

  const lightBg: Background = {
    kind: "gradient",
    stops: [lightColor1 ?? "#F1EDE6", lightColor2 ?? "#E3DCD0"],
    angle: 135,
  };

  // Dark suggestion: Lightness <= 0.22 (ensuring |L - avgL| >= 0.25 when avgL is light/mid),
  // with chroma lowered by 50% (capped at 0.05)
  const darkTargetL = Math.min(0.22, avgL - 0.25 < 0 ? 0.16 : avgL - 0.25);
  const darkChroma = Math.min((primary.c ?? 0.03) * 0.5, 0.045);
  const darkColor1 = formatHex(oklch({ mode: "oklch", l: darkTargetL, c: darkChroma, h: primary.h ?? 260 }));
  const darkColor2 = formatHex(oklch({ mode: "oklch", l: darkTargetL + 0.08, c: darkChroma * 1.2, h: secondary.h ?? (primary.h ?? 260) + 30 }));

  const darkBg: Background = {
    kind: "gradient",
    stops: [darkColor1 ?? "#141417", darkColor2 ?? "#2A2A30"],
    angle: 145,
  };

  // Mesh suggestion: 4 harmonious low-chroma colors
  const meshColors: string[] = [];
  const baseH = primary.h ?? 240;
  for (let i = 0; i < 4; i++) {
    const l = 0.22 + i * 0.14;
    const c = Math.min(0.04 + (i % 2) * 0.02, 0.06);
    const h = (baseH + i * 35) % 360;
    const col = formatHex(oklch({ mode: "oklch", l, c, h }));
    if (col) meshColors.push(col);
  }

  const meshBg: Background = {
    kind: "mesh",
    colors: meshColors.length === 4 ? meshColors : ["#1B1B2F", "#3A2F4F", "#6B4E71", "#C3A6A0"],
    drift: 0.05,
    seed: 42,
  };

  // Ambient suggestion
  const ambientBg: Background = {
    kind: "ambient",
    assetId,
    blur: 0.8,
    dim: 0.25,
  };

  return [lightBg, darkBg, meshBg, ambientBg];
}
