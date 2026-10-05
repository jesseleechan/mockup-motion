/**
 * Section detection and suggested scroll stop generation.
 * Pure algorithmic implementation with no DOM or Three.js dependencies.
 */

export interface SectionDetectionOptions {
  /** Target downscale width for row feature analysis (default: 256) */
  sampleWidth?: number;
  /** Viewport height in source pixels (used for minimum distance merging) */
  viewportHeight?: number;
  /** Transition sensitivity threshold (0..1, default: 0.10) */
  threshold?: number;
}

/**
 * Detects section boundary y-offsets in source pixels from RGBA pixel data.
 * Downscales to ~256px wide, computes per-row mean color and edge energy,
 * finds prominent full-width transitions and uniform divider bands,
 * and merges boundaries closer than 0.6 viewport heights.
 */
export function detectSections(
  rgba: Uint8ClampedArray | Uint8Array,
  w: number,
  h: number,
  options: SectionDetectionOptions = {},
): number[] {
  if (w <= 0 || h <= 0) {
    return [0];
  }

  const channels = rgba.length >= w * h * 4 ? 4 : 3;
  if (rgba.length < w * h * channels) {
    return [0];
  }

  const sampleW = Math.min(options.sampleWidth ?? 256, w);
  const stepX = w / sampleW;

  // Viewport height estimate: default to ~16:10 for desktop or ~9:19.5 for mobile
  const isMobile = w < 900;
  const defaultVh = isMobile ? Math.round(w / 0.4615) : Math.round(w / 1.6);
  const vh = options.viewportHeight ?? defaultVh;

  // Compute per-row features: mean R, G, B, Lum, and horizontal edge energy
  const rowLum = new Float32Array(h);
  const rowEnergy = new Float32Array(h);
  const rowR = new Float32Array(h);
  const rowG = new Float32Array(h);
  const rowB = new Float32Array(h);

  let minEnergy = Infinity;

  for (let y = 0; y < h; y++) {
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let energy = 0;
    let prevR = 0;
    let prevG = 0;
    let prevB = 0;

    const rowOffset = y * w * channels;

    for (let x = 0; x < sampleW; x++) {
      const srcX = Math.min(w - 1, Math.floor(x * stepX));
      const idx = rowOffset + srcX * channels;
      const r = rgba[idx];
      const g = rgba[idx + 1];
      const b = rgba[idx + 2];

      sumR += r;
      sumG += g;
      sumB += b;

      if (x > 0) {
        energy += Math.abs(r - prevR) + Math.abs(g - prevG) + Math.abs(b - prevB);
      }
      prevR = r;
      prevG = g;
      prevB = b;
    }

    const mr = sumR / sampleW;
    const mg = sumG / sampleW;
    const mb = sumB / sampleW;
    rowR[y] = mr;
    rowG[y] = mg;
    rowB[y] = mb;
    rowLum[y] = 0.2126 * mr + 0.7152 * mg + 0.0722 * mb;
    const avgEnergy = energy / sampleW;
    rowEnergy[y] = avgEnergy;
    if (avgEnergy < minEnergy) minEnergy = avgEnergy;
  }

  // Smooth features across small vertical window to reject noise
  const smoothedLum = new Float32Array(h);
  const smoothedEnergy = new Float32Array(h);
  const kRadius = 2;
  for (let y = 0; y < h; y++) {
    let lumSum = 0;
    let energySum = 0;
    let count = 0;
    for (let dy = -kRadius; dy <= kRadius; dy++) {
      const ny = y + dy;
      if (ny >= 0 && ny < h) {
        lumSum += rowLum[ny];
        energySum += rowEnergy[ny];
        count++;
      }
    }
    smoothedLum[y] = lumSum / count;
    smoothedEnergy[y] = energySum / count;
  }

  interface Candidate {
    y: number;
    score: number;
  }
  const candidates: Candidate[] = [{ y: 0, score: 9999 }];

  // 1. Detect step transitions (comparing region above y with region below y)
  const W = Math.max(8, Math.min(28, Math.round(vh * 0.02)));
  const deltas = new Float32Array(h);

  for (let y = W; y < h - W; y++) {
    let lumAbove = 0;
    let lumBelow = 0;
    let rAbove = 0;
    let rBelow = 0;
    let gAbove = 0;
    let gBelow = 0;
    let bAbove = 0;
    let bBelow = 0;
    let energyAbove = 0;
    let energyBelow = 0;

    for (let k = 1; k <= W; k++) {
      lumAbove += rowLum[y - k];
      lumBelow += rowLum[y + k];
      rAbove += rowR[y - k];
      rBelow += rowR[y + k];
      gAbove += rowG[y - k];
      gBelow += rowG[y + k];
      bAbove += rowB[y - k];
      bBelow += rowB[y + k];
      energyAbove += rowEnergy[y - k];
      energyBelow += rowEnergy[y + k];
    }

    const dLum = Math.abs(lumBelow - lumAbove) / W;
    const dR = Math.abs(rBelow - rAbove) / W;
    const dG = Math.abs(gBelow - gAbove) / W;
    const dB = Math.abs(bBelow - bAbove) / W;
    const dEnergy = Math.abs(energyBelow - energyAbove) / W;

    deltas[y] = dLum * 1.5 + (dR + dG + dB) * 0.5 + dEnergy * 1.2;
  }

  let maxDelta = 0;
  for (let y = W; y < h - W; y++) {
    if (deltas[y] > maxDelta) maxDelta = deltas[y];
  }

  const threshold = Math.max(2.5, (options.threshold ?? 0.08) * maxDelta);
  const peakWindow = Math.round(W * 1.2);

  for (let y = W; y < h - W; y++) {
    const d = deltas[y];
    if (d >= threshold) {
      let isPeak = true;
      for (let dy = -peakWindow; dy <= peakWindow; dy++) {
        if (dy !== 0 && deltas[y + dy] > d) {
          isPeak = false;
          break;
        }
      }
      if (isPeak) {
        candidates.push({ y, score: d });
        y += Math.floor(peakWindow * 0.5);
      }
    }
  }

  // 2. Detect uniform whitespace/padding bands (where rows have minimal edge energy)
  const uniformThreshold = minEnergy + 2.5;
  let bandStart = -1;

  for (let y = 10; y < h - 10; y++) {
    const isUniform = rowEnergy[y] <= uniformThreshold;
    if (isUniform && bandStart === -1) {
      bandStart = y;
    } else if (!isUniform && bandStart !== -1) {
      const bandHeight = y - bandStart;
      if (bandHeight >= 12) {
        // In web layouts, DOM section containers meet at the midpoint of inter-section whitespace
        // or where the new section's content begins (band end).
        const midY = Math.round((bandStart + y) / 2);
        candidates.push({ y: midY, score: bandHeight * 2.0 });
        candidates.push({ y: y, score: bandHeight * 1.5 });
        candidates.push({ y: bandStart, score: bandHeight * 0.8 });
      }
      bandStart = -1;
    }
  }

  // Sort candidates by vertical position
  candidates.sort((a, b) => a.y - b.y);

  // Cluster and merge boundaries closer than minMergeDistance
  // We use a cluster-based approach: candidates within tolerance merge to their highest-scoring point
  const clusterDist = Math.max(20, Math.round(0.12 * vh));
  const merged: Candidate[] = [];

  for (const cand of candidates) {
    if (merged.length === 0) {
      merged.push(cand);
      continue;
    }

    const last = merged[merged.length - 1];
    if (cand.y - last.y < clusterDist) {
      if (last.y !== 0 && cand.score > last.score) {
        merged[merged.length - 1] = cand;
      }
    } else {
      merged.push(cand);
    }
  }

  // Ensure 0 is always the first boundary
  const result = merged.map((c) => c.y);
  if (result[0] !== 0) {
    result.unshift(0);
  }

  return result;
}

/**
 * Suggests 3 to 5 well-spaced stops in the normalized scroll range [0..1].
 * Each stop aligns a section top with the viewport top.
 * - Always starts with 0
 * - Strictly ascending in [0..1]
 * - Ends at or near 1.0 (bottom of scroll range)
 * - Returns between 3 and 5 stops for scrollable content
 */
export function suggestStops(
  sections: number[],
  imageHeight: number,
  viewportHeight: number,
): number[] {
  const scrollablePx = Math.max(0, imageHeight - viewportHeight);
  if (scrollablePx <= 0) {
    return [0];
  }

  // Normalized stops for each section top landing at top of viewport
  const rawStops = sections
    .map((y) => Math.max(0, Math.min(1, y / scrollablePx)))
    .filter((stop, idx, arr) => arr.indexOf(stop) === idx)
    .sort((a, b) => a - b);

  // Ensure 0 is included
  if (rawStops.length === 0 || rawStops[0] !== 0) {
    rawStops.unshift(0);
  }

  // Ensure end stop at 1.0
  if (rawStops[rawStops.length - 1] < 0.95) {
    rawStops.push(1.0);
  } else {
    rawStops[rawStops.length - 1] = 1.0;
  }

  // If already between 3 and 5 stops, return directly
  if (rawStops.length >= 3 && rawStops.length <= 5) {
    return rawStops;
  }

  // If fewer than 3 stops (e.g. only 0 and 1), interpolate intermediate stop(s)
  if (rawStops.length < 3) {
    return [0, 0.5, 1.0];
  }

  // If more than 5 stops, select 4 or 5 most representative stops
  const targetCount = 4;
  const selected: number[] = [rawStops[0]];
  const remaining = rawStops.slice(1, rawStops.length - 1);
  const lastStop = rawStops[rawStops.length - 1];

  while (selected.length < targetCount - 1 && remaining.length > 0) {
    let bestIdx = 0;
    let maxMinDist = -1;

    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i];
      let minDist = Math.abs(cand - lastStop);
      for (const s of selected) {
        minDist = Math.min(minDist, Math.abs(cand - s));
      }
      if (minDist > maxMinDist) {
        maxMinDist = minDist;
        bestIdx = i;
      }
    }

    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

  selected.push(lastStop);
  selected.sort((a, b) => a - b);

  return selected;
}
