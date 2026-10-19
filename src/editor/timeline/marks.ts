import type { Layout } from "../../doc/types";
import { isSteppedLayout, steppedAssetIds } from "../../motion/layouts/duration";

/** What the slim timeline marks on its scrubber (docs/polish-plan/stage-timeline.md, item 2). */
export interface TimelineMarks {
  /** Shot times at which a step starts: one per screenshot for Slider, Stack and Orbit. */
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
    const count = Math.max(1, steppedAssetIds(layout).length);
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
