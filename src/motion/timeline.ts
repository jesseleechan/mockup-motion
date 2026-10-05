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
}

export interface ActiveTimeline {
  layers: ActiveShot[];
  transition?: {
    kind: Transition["kind"];
    progress: number;
    direction?: Transition["direction"];
  };
}

/**
 * Schedule all shots in a document.
 * Follows contracts.md §5:
 * - Shot i starts at s_0 = 0 and s_{i+1} = s_i + duration_i - transitionIn_{i+1}.duration
 * - totalDuration = s_last + duration_last
 * - If doc.loop is true and (shots.length > 1 or shots[0].transitionIn.kind !== 'cut'):
 *   totalDuration -= shots[0].transitionIn.duration
 */
export function schedule(doc: ProjectDoc): { shots: ScheduledShot[]; total: number } {
  const n = doc.shots.length;
  if (n === 0) {
    return { shots: [], total: 0 };
  }

  const shots: ScheduledShot[] = [];
  let currentStart = 0;

  for (let i = 0; i < n; i++) {
    const shot = doc.shots[i];
    if (i > 0) {
      const transIn = shot.transitionIn;
      const transDuration = transIn.kind === "cut" ? 0 : Math.max(0, transIn.duration);
      currentStart = shots[i - 1].start + doc.shots[i - 1].duration - transDuration;
    }
    const end = currentStart + shot.duration;
    shots.push({ index: i, start: currentStart, end });
  }

  let total = shots[n - 1].end;

  if (doc.loop && (n > 1 || doc.shots[0].transitionIn.kind !== "cut")) {
    const d0 = doc.shots[0].transitionIn.duration;
    if (d0 > 0) {
      total = Math.max(0.001, total - d0);
    }
  }

  return { shots, total };
}

/**
 * Determine active layer(s) and transition for a given time t.
 * Implements loop wrap blending where shot-0 local time clamps to 0.
 */
export function activeLayers(doc: ProjectDoc, t: number): ActiveTimeline {
  const n = doc.shots.length;
  if (n === 0) {
    return { layers: [] };
  }

  const { shots: scheduled, total } = schedule(doc);
  if (total <= 0) {
    return {
      layers: [{ shot: doc.shots[0], index: 0, localT: 0, weight: 1.0 }],
    };
  }

  // Normalize time for looping or clamping
  let normT: number;
  if (doc.loop) {
    if (t === total) {
      normT = 0;
    } else {
      normT = ((t % total) + total) % total;
    }
  } else {
    normT = Math.max(0, Math.min(total, t));
  }

  const d0 = doc.shots[0].transitionIn.duration;
  const hasWrap =
    doc.loop &&
    (n > 1 || doc.shots[0].transitionIn.kind !== "cut") &&
    doc.shots[0].transitionIn.kind !== "cut" &&
    d0 > 0;

  // 1. Check loop wrap transition in [total - d0, total)
  if (hasWrap && normT >= total - d0) {
    const outgoingIndex = n - 1;
    const outgoingShot = doc.shots[outgoingIndex];
    const outgoingLocalT = normT - scheduled[outgoingIndex].start;

    const incomingShot = doc.shots[0];
    // contracts.md §5: "with shot-0 local time t - total, clamped to 0"
    const incomingLocalT = 0;

    const rawP = Math.max(0, Math.min(1, (normT - (total - d0)) / d0));
    const easedP = ease(incomingShot.transitionIn.easing, rawP);

    return {
      layers: [
        { shot: outgoingShot, index: outgoingIndex, localT: outgoingLocalT, weight: 1 - easedP },
        { shot: incomingShot, index: 0, localT: incomingLocalT, weight: easedP },
      ],
      transition: {
        kind: incomingShot.transitionIn.kind,
        progress: easedP,
        direction: incomingShot.transitionIn.direction,
      },
    };
  }

  // 2. Check internal transitions between shots i-1 and i (for i >= 1)
  for (let i = n - 1; i >= 1; i--) {
    const shot = doc.shots[i];
    const trans = shot.transitionIn;
    const transDuration = trans.kind === "cut" ? 0 : Math.max(0, trans.duration);

    if (transDuration > 0) {
      const transStart = scheduled[i].start;
      const transEnd = transStart + transDuration;

      if (normT >= transStart && normT < transEnd) {
        const outgoingIndex = i - 1;
        const outgoingShot = doc.shots[outgoingIndex];
        const outgoingLocalT = normT - scheduled[outgoingIndex].start;

        const incomingLocalT = normT - transStart;
        const rawP = Math.max(0, Math.min(1, (normT - transStart) / transDuration));
        const easedP = ease(trans.easing, rawP);

        return {
          layers: [
            {
              shot: outgoingShot,
              index: outgoingIndex,
              localT: outgoingLocalT,
              weight: 1 - easedP,
            },
            {
              shot,
              index: i,
              localT: incomingLocalT,
              weight: easedP,
            },
          ],
          transition: {
            kind: trans.kind,
            progress: easedP,
            direction: trans.direction,
          },
        };
      }
    }
  }

  // 3. Single active shot (no active transition)
  let activeIndex = 0;
  for (let i = 0; i < n; i++) {
    if (i === n - 1 || normT < scheduled[i + 1].start) {
      activeIndex = i;
      break;
    }
  }

  const shot = doc.shots[activeIndex];
  const localT = Math.max(0, Math.min(shot.duration, normT - scheduled[activeIndex].start));

  return {
    layers: [{ shot, index: activeIndex, localT, weight: 1.0 }],
  };
}
