import type { ProjectDoc, Shot, Transition } from "../doc/types";
import { ease } from "./easing";

export interface ScheduledShot {
  index: number;
  start: number;
  end: number;
}

export interface ActiveShot {
  shot: Shot;
  index: number;
  localT: number;
  weight: number;
  /**
   * Only on the incoming shot 0 during the loop wrap: its unclamped time, t − total (< 0).
   * `localT` stays clamped to 0 (contracts.md §5); Frames layouts use this instead so
   * their lanes keep moving in step with the outgoing layer.
   */
  wrapT?: number;
}

export interface ActiveTimeline {
  layers: ActiveShot[];
  transition?: {
    kind: Transition["kind"];
    progress: number;
  };
}

/**
 * Schedule the document's shot (contracts.md §5). A document has one shot; multi-shot reels
 * were cut on 19 October 2026, and `sanitizeDoc` keeps only shot 0.
 * - The shot runs from 0 to its duration.
 * - When doc.loop is true and shots[0].transitionIn is a fade, the loop wraps that much early:
 *   totalDuration = duration - transitionIn.duration.
 */
export function schedule(doc: ProjectDoc): { shots: ScheduledShot[]; total: number } {
  const shot = doc.shots[0];
  if (!shot) {
    return { shots: [], total: 0 };
  }

  let total = shot.duration;
  if (hasWrapFade(doc)) {
    total = Math.max(0.001, total - shot.transitionIn.duration);
  }

  return { shots: [{ index: 0, start: 0, end: shot.duration }], total };
}

/** Whether the loop wraps with a crossfade rather than a cut. */
function hasWrapFade(doc: ProjectDoc): boolean {
  const transition = doc.shots[0]?.transitionIn;
  return doc.loop && transition?.kind === "fade" && transition.duration > 0;
}

/**
 * Determine the active layer(s) and the wrap transition for a given time t.
 * Implements the loop wrap blending, where shot-0 local time clamps to 0.
 */
export function activeLayers(doc: ProjectDoc, t: number): ActiveTimeline {
  const shot = doc.shots[0];
  if (!shot) {
    return { layers: [] };
  }

  const { total } = schedule(doc);
  if (total <= 0) {
    return { layers: [{ shot, index: 0, localT: 0, weight: 1.0 }] };
  }

  // Normalize time for looping or clamping
  let normT: number;
  if (doc.loop) {
    normT = t === total ? 0 : ((t % total) + total) % total;
  } else {
    normT = Math.max(0, Math.min(total, t));
  }

  // The loop wrap crossfade in [total - d0, total): the shot's end fades into its start.
  const d0 = shot.transitionIn.duration;
  if (hasWrapFade(doc) && normT >= total - d0) {
    const rawP = Math.max(0, Math.min(1, (normT - (total - d0)) / d0));
    const easedP = ease(shot.transitionIn.easing, rawP);

    return {
      layers: [
        { shot, index: 0, localT: normT, weight: 1 - easedP },
        // contracts.md §5: "with shot-0 local time t - total, clamped to 0"
        { shot, index: 0, localT: 0, weight: easedP, wrapT: normT - total },
      ],
      transition: { kind: shot.transitionIn.kind, progress: easedP },
    };
  }

  const localT = Math.max(0, Math.min(shot.duration, normT));
  return { layers: [{ shot, index: 0, localT, weight: 1.0 }] };
}
