import type { Layout } from "../../doc/types";
import { isSteppedLayout, steppedCount } from "../../motion/layouts/duration";

/** What the slim timeline marks on its scrubber (docs/polish-plan/stage-timeline.md, item 2). */
export interface TimelineMarks {
  /**
   * Shot times at which a step starts: one per screenshot for Slider, Stack, Orbit and Site Tour,
   * one per page for Responsive Tour.
   */
  steps: number[];
  /** Frames lanes move one asset period per loop, so their loop point is worth marking. */
  loopPoint: boolean;
}

/**
 * The marks for a shot's layout over a loop of `loop` seconds. A stepped layout moves one
 * screenshot every `step` seconds from t = 0 (src/motion/layouts/slider.ts, orbit.ts), so step k
 * starts at k × step. Steps at or past the loop end are dropped: the loop wraps there.
 */
export function timelineMarks(layout: Layout, loop: number): TimelineMarks {
  if (isSteppedLayout(layout)) {
    const count = Math.max(1, steppedCount(layout));
    const steps: number[] = [];
    for (let k = 0; k < count; k++) {
      const time = k * layout.step;
      if (time < loop - 1e-6) steps.push(time);
    }
    return { steps, loopPoint: false };
  }
  return { steps: [], loopPoint: layout.kind === "rows" || layout.kind === "columns" };
}

/** Where `time` sits along a track of `width` px for a loop of `loop` seconds. */
export function timeToX(time: number, loop: number, width: number): number {
  if (loop <= 0) return 0;
  return (Math.min(Math.max(time, 0), loop) / loop) * width;
}

/**
 * The time under pointer offset `x` on a track of `width` px. Within `snapPx` of a step the
 * time snaps to it, so a step is easy to land on.
 */
export function xToTime(x: number, loop: number, width: number, steps: number[], snapPx = 0) {
  if (width <= 0 || loop <= 0) return 0;
  const time = (Math.min(Math.max(x, 0), width) / width) * loop;
  for (const step of steps) {
    if (Math.abs(timeToX(step, loop, width) - x) <= snapPx) return step;
  }
  return time;
}

// One frame at the editor's 30 fps preview, as the stage's frame-step buttons use.
const FRAME = 1 / 30;
// Times closer than this count as the same time, so a step under the playhead is "here".
const EPSILON = 1e-6;

/**
 * Where a key press on the scrubber moves the playhead, or null for a key it doesn't handle.
 * Arrows move to the previous or next step where the preset has steps, otherwise one frame;
 * with Shift they move one second. Home and End go to the start and the loop end.
 */
export function scrubberKeyTime(
  key: string,
  shift: boolean,
  playhead: number,
  loop: number,
  steps: number[],
): number | null {
  const clamp = (time: number) => Math.min(Math.max(time, 0), loop);
  if (key === "Home") return 0;
  if (key === "End") return loop;
  if (key !== "ArrowLeft" && key !== "ArrowRight") return null;
  const forward = key === "ArrowRight";
  if (shift) return clamp(playhead + (forward ? 1 : -1));
  if (steps.length > 1) {
    if (forward) return steps.find((time) => time > playhead + EPSILON) ?? loop;
    return [...steps].reverse().find((time) => time < playhead - EPSILON) ?? 0;
  }
  return clamp(playhead + (forward ? FRAME : -FRAME));
}
