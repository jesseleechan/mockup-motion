import type { Aspect, CameraMove, Layout } from "../../doc/types";
import { MAX_SHOT_DURATION } from "./limits";
import { framesDuration } from "./rows";

export { MAX_SHOT_DURATION };

type SliderLayout = Extract<Layout, { kind: "slider" }>;

// Quality bar §2.2 (carousel steps): 1.6–4.0 s per screenshot.
export const SLIDER_MIN_STEP = 1.6;
export const SLIDER_MAX_STEP = 4.0;

/**
 * The most screenshots one slider shot shows. A slider lasts N × step, so even at the shortest
 * step 18 screenshots (28.8 s) fit in a shot and 19 (30.4 s) don't. Later ones are left out.
 */
export const SLIDER_MAX_SCREENSHOTS = Math.floor(MAX_SHOT_DURATION / SLIDER_MIN_STEP);

/** The screenshots a slider shot shows: the first SLIDER_MAX_SCREENSHOTS of its list. */
export function sliderAssetIds(layout: SliderLayout): string[] {
  return layout.assetIds.slice(0, SLIDER_MAX_SCREENSHOTS);
}

/**
 * The longest step that keeps a slider of `count` screenshots within MAX_SHOT_DURATION:
 * min(4.0, 30 / N), rounded down to the inspector's 0.1 s steps.
 */
export function sliderStepMax(count: number): number {
  const shown = Math.min(Math.max(1, count), SLIDER_MAX_SCREENSHOTS);
  // Tenths of a second; the epsilon keeps an exact quotient (30 / 15 = 2.0) from rounding down.
  return Math.min(SLIDER_MAX_STEP, Math.floor((MAX_SHOT_DURATION * 10) / shown + 1e-9) / 10);
}

/** `step` limited to 1.6 s … sliderStepMax(count). */
export function clampSliderStep(step: number, count: number): number {
  return Math.min(sliderStepMax(count), Math.max(SLIDER_MIN_STEP, step));
}

/** Shot length that keeps a slider loop seamless: one step per shown screenshot. */
export function sliderDuration(layout: SliderLayout): number {
  return Math.max(1, sliderAssetIds(layout).length) * layout.step;
}

/**
 * The shot length a layout sets itself, or null when the user sets it. A slider lasts
 * N × step so it loops natively (contracts.md §5).
 */
export function fixedShotDuration(layout: Layout): number | null {
  return layout.kind === "slider" ? sliderDuration(layout) : null;
}

/**
 * The camera a layout allows. A slider's camera is still (quality bar §4): a camera move would
 * end the shot on another pose, so the native loop would pop. Other layouts keep theirs.
 */
export function fixedShotCamera(layout: Layout, camera: CameraMove): CameraMove {
  if (layout.kind !== "slider" || isStillCamera(camera)) return camera;
  return { preset: "static", intensity: 0, easing: camera.easing, float: 0 };
}

function isStillCamera(camera: CameraMove): boolean {
  return (
    camera.preset === "static" &&
    camera.intensity === 0 &&
    camera.float === 0 &&
    camera.progressRange === undefined
  );
}

/**
 * The shortest shot a layout allows. Only Frames (rows or columns with travel "period") has
 * one: its speed limit (quality-bar §2.5).
 */
export function minShotDuration(layout: Layout, aspect: Aspect): number {
  const frames = layout.kind === "rows" || layout.kind === "columns";
  return frames && layout.travel === "period" ? framesDuration(layout, aspect) : 1;
}
