import type { Aspect, AssetRef, CameraMove, Layout, ScrollSpec } from "../../doc/types";
import { responsiveScreens, responsiveScrollDuration } from "../responsive-scroll";
import { MAX_SHOT_DURATION } from "./limits";
import { framesDuration } from "./rows";

export { MAX_SHOT_DURATION };

type SliderLayout = Extract<Layout, { kind: "slider" }>;
type OrbitLayout = Extract<Layout, { kind: "orbit" }>;
type TourLayout = Extract<Layout, { kind: "tour" }>;
type ResponsiveTourLayout = Extract<Layout, { kind: "responsive-tour" }>;
/** Stepped layouts that show one list of screenshots: slider, orbit and tour (Site Tour). */
export type ListSteppedLayout = SliderLayout | OrbitLayout | TourLayout;
/**
 * Layouts that step one screenshot (or one page) per `step` seconds and loop natively: slider,
 * orbit, tour (Site Tour) and responsive-tour (Responsive Tour, a desktop and a mobile
 * screenshot per page).
 */
export type SteppedLayout = ListSteppedLayout | ResponsiveTourLayout;

export function isSteppedLayout(layout: Layout): layout is SteppedLayout {
  return (
    layout.kind === "slider" ||
    layout.kind === "orbit" ||
    layout.kind === "tour" ||
    layout.kind === "responsive-tour"
  );
}

// Quality bar §2.2 (carousel steps): 1.6–4.0 s per screenshot.
export const SLIDER_MIN_STEP = 1.6;
export const SLIDER_MAX_STEP = 4.0;

/**
 * The most screenshots one slider shot shows. A slider lasts N × step, so even at the shortest
 * step 18 screenshots (28.8 s) fit in a shot and 19 (30.4 s) don't. Later ones are left out.
 */
export const SLIDER_MAX_SCREENSHOTS = Math.floor(MAX_SHOT_DURATION / SLIDER_MIN_STEP);

/**
 * The screenshots a slider or Site Tour shot shows: the first SLIDER_MAX_SCREENSHOTS of its
 * list.
 */
export function sliderAssetIds(layout: SliderLayout | TourLayout): string[] {
  return layout.assetIds.slice(0, SLIDER_MAX_SCREENSHOTS);
}

/**
 * The most screenshots an orbit shows (quality bar §4): beyond 6 the ring's back cards crowd
 * behind the front one. Later ones are left out. 6 × 4.0 s fits in a 30 s shot.
 */
export const ORBIT_MAX_SCREENSHOTS = 6;

/**
 * The fewest screenshots a list layout needs (quality-bar §4): 3 for a slider, stack or Site
 * Tour, 3 pages for a Responsive Tour, 4 for an orbit or Frames. Other layouts have no list, so
 * 0.
 */
export function minShotScreenshots(layout: Layout): number {
  switch (layout.kind) {
    case "slider":
    case "tour":
    case "responsive-tour":
      return 3;
    case "orbit":
    case "rows":
    case "columns":
      return 4;
    default:
      return 0;
  }
}

/** The screenshots an orbit shot shows: the first ORBIT_MAX_SCREENSHOTS of its list. */
export function orbitAssetIds(layout: OrbitLayout): string[] {
  return layout.assetIds.slice(0, ORBIT_MAX_SCREENSHOTS);
}

/** The screenshots a slider, orbit or Site Tour shot shows. */
export function steppedAssetIds(layout: ListSteppedLayout): string[] {
  return layout.kind === "orbit" ? orbitAssetIds(layout) : sliderAssetIds(layout);
}

/**
 * The pages a Responsive Tour shows: one per pair (page i is the i-th desktop and the i-th mobile
 * screenshot, presets round two D12), at most the slider's SLIDER_MAX_SCREENSHOTS, so the loop
 * fits in 30 s. Later pages are left out.
 */
export function responsiveTourPageCount(layout: ResponsiveTourLayout): number {
  const pairs = Math.max(layout.desktopIds.length, layout.mobileIds.length);
  return Math.min(SLIDER_MAX_SCREENSHOTS, pairs);
}

/** How many steps a stepped shot takes: one per shown screenshot, or per page of a tour. */
export function steppedCount(layout: SteppedLayout): number {
  return layout.kind === "responsive-tour"
    ? responsiveTourPageCount(layout)
    : steppedAssetIds(layout).length;
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

/**
 * The longest step of a slider or orbit, counting only the screenshots it shows: an orbit shows
 * at most 6, so its 7th and later screenshots don't shorten its step.
 */
export function steppedStepMax(layout: SteppedLayout): number {
  return sliderStepMax(steppedCount(layout));
}

/** `step` limited to 1.6 s … steppedStepMax(layout). */
export function clampSteppedStep(step: number, layout: SteppedLayout): number {
  return Math.min(steppedStepMax(layout), Math.max(SLIDER_MIN_STEP, step));
}

/**
 * Shot length that keeps a stepped loop (slider, orbit, Site Tour, Responsive Tour) seamless: one
 * step per shown screenshot or page.
 */
export function sliderDuration(layout: SteppedLayout): number {
  return Math.max(1, steppedCount(layout)) * layout.step;
}

/**
 * The shot length a layout sets itself, or null when the user sets it. A stepped layout lasts
 * N × step so it loops natively; a scrolling responsive layout lasts its holds plus moves
 * (contracts.md §5). Without both screenshots it lasts its holds alone.
 */
export function fixedShotDuration(
  layout: Layout,
  scroll?: ScrollSpec,
  assets: AssetRef[] = [],
): number | null {
  if (isSteppedLayout(layout)) return sliderDuration(layout);
  if (layout.kind === "responsive" && scroll?.enabled) {
    const screens = responsiveScreens(layout, assets);
    return screens ? responsiveScrollDuration(scroll, screens) : Math.max(1, scroll.hold);
  }
  return null;
}

/**
 * The camera a layout allows. A stepped layout's camera is still (quality bar §4): a camera
 * move would end the shot on another pose, so the native loop would pop. Responsive Scroll's is
 * still too: the scroll is the shot's one move (quality bar §2.5). Other layouts keep theirs.
 */
export function fixedShotCamera(layout: Layout, camera: CameraMove): CameraMove {
  const still = isSteppedLayout(layout) || layout.kind === "responsive";
  if (!still || isStillCamera(camera)) return camera;
  return { preset: "static", intensity: 0, easing: camera.easing };
}

/** A camera with no move and no intensity. */
export function isStillCamera(camera: CameraMove): boolean {
  return camera.preset === "static" && camera.intensity === 0;
}

/**
 * The shortest shot a layout allows. Only Frames (rows or columns) has one: its speed limit
 * (quality-bar §2.5).
 */
export function minShotDuration(layout: Layout, aspect: Aspect): number {
  return layout.kind === "rows" || layout.kind === "columns" ? framesDuration(layout, aspect) : 1;
}
