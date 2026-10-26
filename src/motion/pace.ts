import type { Aspect, AssetRef, Layout, Shot } from "../doc/types";
import {
  clampSteppedStep,
  fixedShotDuration,
  isSteppedLayout,
  MAX_SHOT_DURATION,
  sliderDuration,
} from "./layouts/duration";
import { framesDuration } from "./layouts/rows";
import { pageColumnsPacedDuration } from "./layouts/page-columns";

/**
 * One pace control for every looping preset (quality-bar §2.2, "Pace"). Default is today's
 * timing; Calm and Brisk scale it by ×1.2 and ×0.8, then the preset's own limits clamp it.
 * `Shot.pace` stores the choice (unset is Default) and the timing fields follow from it.
 */
export type Pace = "calm" | "default" | "brisk";

/** The order the inspector offers them in. */
export const PACES: readonly Pace[] = ["calm", "default", "brisk"];

// ×1.2 rather than ×1.25 keeps every Calm value inside an existing range (the slider step and
// the Responsive Scroll hold) without clamping (docs/polish-plan/inspectors.md, P5).
export const PACE_TIME_SCALE: Readonly<Record<Pace, number>> = {
  calm: 1.2,
  default: 1,
  brisk: 0.8,
};

/** The Default step of a slider, stack or orbit (quality-bar §2.2). */
export const DEFAULT_STEP = 2;
/** The Default hold of Responsive Scroll (quality-bar §2.2). */
export const DEFAULT_RESPONSIVE_HOLD = 1;
// The reference loop is 15 s (docs/presets-plan/reference.md); shorter loops feel hurried.
export const FRAMES_MIN_LOOP = 15;

/** Why an option the limits make equal to Default is disabled. */
export const PACE_LIMIT_REASONS = {
  brisk: "Already at the speed limit",
  calm: "No room in 30 s",
} as const;

type FramesLayout = Extract<Layout, { kind: "rows" | "columns" }>;
type PacedFields = Pick<Shot, "layout" | "scroll">;

function isFramesLayout(layout: Layout): layout is FramesLayout {
  return (layout.kind === "rows" || layout.kind === "columns") && layout.travel === "period";
}

/** The shot's pace; unset is Default. */
export function paceOf(shot: Pick<Shot, "pace">): Pace {
  return shot.pace ?? "default";
}

/**
 * A slider, stack, orbit, Site Tour, Frames, Page Columns or scrolling Responsive Scroll shot: one
 * that has a pace.
 */
export function isPacedShot(shot: PacedFields): boolean {
  return (
    isSteppedLayout(shot.layout) ||
    isFramesLayout(shot.layout) ||
    shot.layout.kind === "pageColumns" ||
    (shot.layout.kind === "responsive" && shot.scroll?.enabled === true)
  );
}

/** A Frames shot's Default loop: its 15 s reference, or longer to stay under its speed limit. */
export function framesDefaultLoop(layout: FramesLayout, aspect: Aspect): number {
  return Math.max(FRAMES_MIN_LOOP, framesDuration(layout, aspect));
}

const roundTo = (value: number, unit: number) => Math.round(value / unit) * unit;
// Rounding in tenths or halves can leave float noise (2.4000000000000004); this trims it.
const tidy = (value: number) => Math.round(value * 1000) / 1000;

/**
 * The value of the shot's pace knob at each pace, clamped by its limits, or null for a shot
 * without a pace: a slider's or orbit's `layout.step` (0.1 s steps, 1.6 s up to 30 s / shown
 * screenshots), a Frames shot's `duration` (0.5 s steps, its speed limit up to 30 s), a Page
 * Columns shot's `duration` (its loop in 0.5 s steps, its speed limit up to 29.2 s, plus the
 * 0.8 s wrap crossfade; the pages' heights set it, so it needs `assets`) or Responsive Scroll's
 * `scroll.hold`.
 */
export function paceTargets(
  shot: PacedFields,
  aspect: Aspect,
  assets: AssetRef[] = [],
): Record<Pace, number> | null {
  if (!isPacedShot(shot)) return null;
  const { layout } = shot;
  const targets = {} as Record<Pace, number>;
  for (const pace of PACES) {
    const scale = PACE_TIME_SCALE[pace];
    if (isSteppedLayout(layout)) {
      targets[pace] = tidy(clampSteppedStep(roundTo(DEFAULT_STEP * scale, 0.1), layout));
    } else if (layout.kind === "pageColumns") {
      targets[pace] = pageColumnsPacedDuration(layout, aspect, assets, scale);
    } else if (isFramesLayout(layout)) {
      const shortest = framesDuration(layout, aspect);
      const scaled = roundTo(framesDefaultLoop(layout, aspect) * scale, 0.5);
      targets[pace] = Math.min(MAX_SHOT_DURATION, Math.max(shortest, scaled));
    } else {
      // The moves already run at the scroll speed limit, so only the hold scales.
      targets[pace] = tidy(roundTo(DEFAULT_RESPONSIVE_HOLD * scale, 0.1));
    }
  }
  return targets;
}

/** The current value of the shot's pace knob, or null for a shot without a pace. */
export function paceKnob(shot: Pick<Shot, "layout" | "scroll" | "duration">): number | null {
  if (!isPacedShot(shot)) return null;
  if (isSteppedLayout(shot.layout)) return shot.layout.step;
  if (isFramesLayout(shot.layout) || shot.layout.kind === "pageColumns") return shot.duration;
  return shot.scroll?.hold ?? DEFAULT_RESPONSIVE_HOLD;
}

/**
 * The pace whose value is nearest the shot's knob, for a shot saved before paces existed. Ties
 * go to Default, so a value halfway between two paces, or a pace a limit makes equal to Default,
 * reads as Default.
 */
export function nearestPace(
  shot: Pick<Shot, "layout" | "scroll" | "duration">,
  aspect: Aspect,
  assets: AssetRef[] = [],
): Pace {
  const targets = paceTargets(shot, aspect, assets);
  const knob = paceKnob(shot);
  if (!targets || knob === null) return "default";
  let best: Pace = "default";
  let bestDistance = Math.abs(knob - targets.default);
  for (const pace of ["brisk", "calm"] as const) {
    const distance = Math.abs(knob - targets[pace]);
    // The epsilon keeps float noise from breaking a tie (|0.9 − 0.8| vs |0.9 − 1.0|).
    if (distance < bestDistance - 1e-9) {
      best = pace;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * The paces whose value equals Default's for this shot, with the reason: Brisk at a speed
 * limit, Calm when a longer loop would pass 30 s.
 */
export function paceLimited(
  shot: PacedFields,
  aspect: Aspect,
  assets: AssetRef[] = [],
): Partial<Record<Exclude<Pace, "default">, string>> {
  const targets = paceTargets(shot, aspect, assets);
  if (!targets) return {};
  const limited: Partial<Record<Exclude<Pace, "default">, string>> = {};
  for (const pace of ["calm", "brisk"] as const) {
    if (Math.abs(targets[pace] - targets.default) < 1e-9) limited[pace] = PACE_LIMIT_REASONS[pace];
  }
  return limited;
}

/**
 * Sets the shot's timing from its pace, in place (an immer draft or a plain object): the knob
 * and the duration that follows from it. A shot without a pace is left alone. Fields are only
 * written when they change, so a no-op edit stays a no-op.
 */
export function fitPace(shot: Shot, aspect: Aspect, assets: AssetRef[]): void {
  const targets = paceTargets(shot, aspect, assets);
  if (!targets) return;
  const value = targets[paceOf(shot)];
  const { layout } = shot;
  let duration: number | null;
  if (isSteppedLayout(layout)) {
    if (layout.step !== value) layout.step = value;
    duration = sliderDuration(layout);
  } else if (isFramesLayout(layout) || layout.kind === "pageColumns") {
    duration = value;
  } else {
    if (shot.scroll && shot.scroll.hold !== value) shot.scroll.hold = value;
    duration = fixedShotDuration(layout, shot.scroll, assets);
  }
  if (duration !== null && shot.duration !== duration) shot.duration = duration;
}

/** A copy of the shot at `pace`, with its timing fitted. */
export function applyPace(shot: Shot, pace: Pace, aspect: Aspect, assets: AssetRef[]): Shot {
  const next = structuredClone(shot);
  setPace(next, pace);
  fitPace(next, aspect, assets);
  return next;
}

/** Stores `pace` on the shot, in place: Default is stored as no pace. */
export function setPace(shot: Shot, pace: Pace): void {
  if (pace === "default") {
    if (shot.pace !== undefined) delete shot.pace;
  } else if (shot.pace !== pace) {
    shot.pace = pace;
  }
}
