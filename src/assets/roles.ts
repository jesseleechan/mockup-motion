import type { AssetRef, AssetRole } from "../doc/types";

export interface ImageAnalysisInput {
  width: number;
  height: number;
  rgba?: Uint8Array | Uint8ClampedArray;
  hasAlpha?: boolean;
  opaqueFraction?: number;
}

export interface ImageAnalysisResult {
  role: AssetRole;
  tall: boolean;
  hasStatusBar: boolean;
  bottomColor: string;
}

/**
 * Computes average color of the bottom row of pixels in hex "#RRGGBB".
 */
export function computeBottomRowColor(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): string {
  if (width <= 0 || height <= 0 || rgba.length < width * 4) {
    return "#000000";
  }

  const rowStartIndex = (height - 1) * width * 4;
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let count = 0;

  for (let x = 0; x < width; x++) {
    const idx = rowStartIndex + x * 4;
    totalR += rgba[idx];
    totalG += rgba[idx + 1];
    totalB += rgba[idx + 2];
    count++;
  }

  if (count === 0) return "#000000";

  const r = Math.round(totalR / count)
    .toString(16)
    .padStart(2, "0");
  const g = Math.round(totalG / count)
    .toString(16)
    .padStart(2, "0");
  const b = Math.round(totalB / count)
    .toString(16)
    .padStart(2, "0");

  return `#${r}${g}${b}`;
}

/**
 * Detects whether mobile screenshot has an existing status bar at the top:
 * A uniform top strip (40-60 px at @3x / ~3.5-6% of height) with glyph clusters
 * on left and right, leaving center background uniform.
 */
export function detectStatusBar(
  rgba: Uint8Array | Uint8ClampedArray | undefined,
  width: number,
  height: number,
): boolean {
  if (!rgba || width <= 100 || height <= 200 || rgba.length < width * height * 4) {
    return false;
  }

  // Strip height: roughly 40-60 px at @3x (approx 4.5% of height)
  const stripH = Math.max(16, Math.min(70, Math.round(height * 0.045)));
  if (stripH >= height) return false;

  // Sample top strip background color from top-middle (where notch or empty space is)
  const midX = Math.floor(width / 2);
  const midY = Math.floor(stripH / 2);
  const bgIdx = (midY * width + midX) * 4;
  const bgR = rgba[bgIdx];
  const bgG = rgba[bgIdx + 1];
  const bgB = rgba[bgIdx + 2];

  // Check left third and right third for high-contrast pixels (glyph clusters)
  let leftContrasting = 0;
  let rightContrasting = 0;
  let centerContrasting = 0;

  const leftBound = Math.floor(width * 0.3);
  const rightBound = Math.floor(width * 0.7);

  const sampleStep = 2; // sample every 2 pixels for speed
  let totalLeftSamples = 0;
  let totalRightSamples = 0;
  let totalCenterSamples = 0;

  for (let y = 4; y < stripH; y += sampleStep) {
    for (let x = 4; x < width - 4; x += sampleStep) {
      const idx = (y * width + x) * 4;
      const dr = Math.abs(rgba[idx] - bgR);
      const dg = Math.abs(rgba[idx + 1] - bgG);
      const db = Math.abs(rgba[idx + 2] - bgB);
      const diff = dr + dg + db;
      const isContrast = diff > 80;

      if (x < leftBound) {
        totalLeftSamples++;
        if (isContrast) leftContrasting++;
      } else if (x > rightBound) {
        totalRightSamples++;
        if (isContrast) rightContrasting++;
      } else {
        totalCenterSamples++;
        if (isContrast) centerContrasting++;
      }
    }
  }

  const leftFrac = totalLeftSamples > 0 ? leftContrasting / totalLeftSamples : 0;
  const rightFrac = totalRightSamples > 0 ? rightContrasting / totalRightSamples : 0;
  const centerFrac = totalCenterSamples > 0 ? centerContrasting / totalCenterSamples : 0;

  // Status bar has clusters on left (time) and right (battery/wifi), center relatively clean
  const hasLeftCluster = leftFrac > 0.03 && leftFrac < 0.45;
  const hasRightCluster = rightFrac > 0.03 && rightFrac < 0.45;
  const centerUniform = centerFrac < 0.2;

  return hasLeftCluster && hasRightCluster && centerUniform;
}

/**
 * Classifies asset role based on dimensions and alpha characteristics:
 * - Width <= 1,300 with aspect < 0.75 -> mobile
 * - Aspect 0.65-0.85 with width >= 1,500 -> tablet
 * - Small image (<= 1,024) with alpha and <= 20% opaque -> logo
 * - Otherwise -> desktop
 */
export function detectRole(input: {
  width: number;
  height: number;
  hasAlpha?: boolean;
  opaqueFraction?: number;
}): AssetRole {
  const { width, height, hasAlpha = false, opaqueFraction = 1.0 } = input;
  if (width <= 0 || height <= 0) return "desktop";

  const aspect = width / height;

  // Small image with alpha and low opacity fraction -> logo
  if (width <= 1024 && height <= 1024 && hasAlpha && opaqueFraction <= 0.2) {
    return "logo";
  }

  // Tablet: aspect 0.65-0.85 with width >= 1,500
  if (aspect >= 0.65 && aspect <= 0.85 && width >= 1500) {
    return "tablet";
  }

  // Mobile: width <= 1,300 with aspect < 0.75
  if (width <= 1300 && aspect < 0.75) {
    return "mobile";
  }

  return "desktop";
}

/**
 * Analyzes image and returns full role, tall flag, status bar, and bottomColor.
 */
export function analyzeImage(input: ImageAnalysisInput): ImageAnalysisResult {
  const { width, height, rgba } = input;
  const aspect = height > 0 ? width / height : 1.0;

  let hasAlpha = input.hasAlpha ?? false;
  let opaqueFraction = input.opaqueFraction ?? 1.0;

  if (rgba && rgba.length >= width * height * 4) {
    let opaquePixels = 0;
    let anyTransparent = false;
    const totalPixels = width * height;
    const step = Math.max(1, Math.floor(totalPixels / 20000)); // Sample up to 20k pixels

    let sampled = 0;
    for (let i = 3; i < rgba.length; i += step * 4) {
      sampled++;
      if (rgba[i] > 20) {
        opaquePixels++;
      }
      if (rgba[i] < 250) {
        anyTransparent = true;
      }
    }

    hasAlpha = anyTransparent;
    opaqueFraction = sampled > 0 ? opaquePixels / sampled : 1.0;
  }

  const role = detectRole({ width, height, hasAlpha, opaqueFraction });

  // Tall indicator: aspect < 0.5 (desktop) or < 0.4 (mobile)
  const isTall = role === "mobile" ? aspect < 0.4 : aspect < 0.5;

  let hasStatusBar = false;
  if (role === "mobile" && rgba) {
    hasStatusBar = detectStatusBar(rgba, width, height);
  }

  const bottomColor = rgba ? computeBottomRowColor(rgba, width, height) : "#000000";

  return {
    role,
    tall: isTall,
    hasStatusBar,
    bottomColor,
  };
}

/**
 * Enhances an AssetRef with analysis metadata.
 */
export function applyAnalysisToAsset(
  asset: AssetRef,
  analysis: ImageAnalysisResult,
): AssetRef {
  return {
    ...asset,
    role: asset.role ?? analysis.role,
    meta: {
      ...asset.meta,
      tall: analysis.tall,
      hasStatusBar: analysis.hasStatusBar,
      bottomColor: analysis.bottomColor,
    },
  };
}
