import { backgroundAssetId, collectAssetIds, resolveShotStyle } from "../../doc/assets";
import type { ExportQuality, ProjectDoc } from "../../doc/types";
import { aspectRatioValue, cameraPose, resolveLayout } from "../../motion";

export interface TextureSizingOptions {
  outputWidthPx: number;
  supersample: number;
  quality?: ExportQuality;
  /** Lab-only fixed camera distance (EngineOptions.cameraDistanceOverride). */
  cameraDistanceOverride?: number;
}

const WIDTH_STEP = 256;
const CAMERA_SAMPLES = 5;
// Logos are not drawn by the engine yet; a quarter of the frame width covers a
// logo mark above a 5-7% title (quality-bar §7) with room to spare.
const LOGO_FRAME_FRACTION = 0.25;

/** Quality-bar §3.1: about 1.5× the largest on-screen width, 2× for master. */
function oversampleFor(quality: ExportQuality | undefined): number {
  return quality === "master" ? 2.0 : 1.5;
}

function smallestCameraDistance(doc: ProjectDoc, shotIndex: number): number {
  const shot = doc.shots[shotIndex];
  let smallest = Infinity;
  for (let i = 0; i < CAMERA_SAMPLES; i++) {
    const p = i / (CAMERA_SAMPLES - 1);
    const pose = cameraPose(shot.camera, doc.aspect, p, p * shot.duration, shot.duration);
    smallest = Math.min(smallest, pose.distance);
  }
  // Guard against a degenerate preset: never size for a camera closer than 0.25×.
  return Math.max(0.25, smallest);
}

/**
 * Decode width in px for every image asset the document draws. Each screen asset
 * gets the largest width at which any of its nodes appears on screen (at the
 * shot's closest camera), times the quality oversample, clamped to the asset's
 * real width and rounded up to a multiple of 256 (minimum 256). The keys are
 * exactly `collectAssetIds(doc)`.
 */
export function textureWidths(doc: ProjectDoc, opts: TextureSizingOptions): Map<string, number> {
  const stageWidthUnits = aspectRatioValue(doc.aspect);
  const framePx = opts.outputWidthPx * opts.supersample;
  const oversample = oversampleFor(opts.quality);
  const needed = new Map<string, number>();
  const want = (assetId: string | null | undefined, widthPx: number) => {
    if (!assetId) return;
    needed.set(assetId, Math.max(needed.get(assetId) ?? 0, widthPx));
  };

  doc.shots.forEach((shot, shotIndex) => {
    const distance = opts.cameraDistanceOverride ?? smallestCameraDistance(doc, shotIndex);
    const nodes = resolveLayout(
      shot.layout,
      doc.aspect,
      doc.assets,
      0,
      shot.duration,
      shot.entrance ?? "none",
    );
    for (const node of nodes) {
      const onScreenPx = ((node.width * node.transform.scale) / stageWidthUnits) * framePx;
      want(node.assetId, (onScreenPx / distance) * oversample);
    }
    want(backgroundAssetId(resolveShotStyle(doc, shotIndex).background), framePx * oversample);
    for (const layer of shot.texts ?? []) {
      want(layer.logoAssetId, framePx * LOGO_FRAME_FRACTION * oversample);
    }
  });
  want(backgroundAssetId(doc.style.background), framePx * oversample);
  // A layout can list more assets than it places at t = 0; size those for a full frame.
  for (const assetId of collectAssetIds(doc)) {
    if (!needed.has(assetId)) want(assetId, framePx * oversample);
  }

  const widths = new Map<string, number>();
  for (const [assetId, widthPx] of needed) {
    let width = Math.max(WIDTH_STEP, Math.ceil(widthPx / WIDTH_STEP) * WIDTH_STEP);
    // Clamp last so a 780 px phone screenshot is requested at 780, never upscaled.
    const realWidth = doc.assets.find((asset) => asset.id === assetId)?.width;
    if (realWidth && realWidth > 0) width = Math.min(width, realWidth);
    widths.set(assetId, width);
  }
  return widths;
}
