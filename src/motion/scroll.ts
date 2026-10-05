import type { ScrollSpec } from "../doc/types";
import { ease } from "./easing";

const SPEED_LIMIT_VH_PER_SEC = 0.9;

/**
 * Calculates the minimum shot duration required for a scroll specification
 * to respect the 0.9 viewport heights/s speed limit and hold periods.
 */
export function minDurationFor(spec: ScrollSpec, scrollableFrames: number): number {
  if (!spec.enabled || scrollableFrames <= 0 || !spec.stops || spec.stops.length === 0) {
    return 0;
  }

  const n = spec.stops.length;
  const hold = Math.max(0, spec.hold);

  if (n === 1) {
    return hold;
  }

  let totalTravel = 0;
  for (let i = 1; i < n; i++) {
    totalTravel += Math.abs(spec.stops[i] - spec.stops[i - 1]) * scrollableFrames;
  }

  const minMoveTime = totalTravel / SPEED_LIMIT_VH_PER_SEC;
  return n * hold + minMoveTime;
}

/**
 * Evaluates the scroll position (0..1) within the scrollable range at shot time shotT.
 * Guarantees:
 * - Stays within 0..1
 * - Holds at stops for spec.hold seconds
 * - Never exceeds 0.9 viewport heights per second
 */
export function scrollPosition(
  spec: ScrollSpec,
  shotT: number,
  shotDuration: number,
  scrollableFrames: number,
): number {
  if (!spec.enabled || scrollableFrames <= 0 || !spec.stops || spec.stops.length === 0) {
    return 0;
  }

  const n = spec.stops.length;
  if (n === 1) {
    return Math.max(0, Math.min(1, spec.stops[0]));
  }

  let totalTravel = 0;
  for (let i = 1; i < n; i++) {
    totalTravel += Math.abs(spec.stops[i] - spec.stops[i - 1]) * scrollableFrames;
  }

  if (totalTravel === 0) {
    return Math.max(0, Math.min(1, spec.stops[0]));
  }

  if (shotT <= 0) {
    return Math.max(0, Math.min(1, spec.stops[0]));
  }

  const hold = Math.max(0, spec.hold);
  const totalHold = n * hold;
  const minMoveTotal = totalTravel / SPEED_LIMIT_VH_PER_SEC;
  const moveTimeAvailable = Math.max(minMoveTotal, shotDuration - totalHold);

  let curT = 0;

  for (let i = 0; i < n; i++) {
    // Hold phase at stop i
    const holdEnd = curT + hold;
    if (shotT < holdEnd) {
      return Math.max(0, Math.min(1, spec.stops[i]));
    }
    curT = holdEnd;

    // Movement phase between stop i and i+1
    if (i < n - 1) {
      const segTravel = Math.abs(spec.stops[i + 1] - spec.stops[i]) * scrollableFrames;
      const segDuration = moveTimeAvailable * (segTravel / totalTravel);
      const moveEnd = curT + segDuration;

      if (shotT < moveEnd) {
        const segP = (shotT - curT) / segDuration;
        const clampedP = Math.max(0, Math.min(1, segP));
        const easedP = ease(spec.easing, clampedP);
        const interpolated = spec.stops[i] + (spec.stops[i + 1] - spec.stops[i]) * easedP;
        return Math.max(0, Math.min(1, interpolated));
      }
      curT = moveEnd;
    }
  }

  return Math.max(0, Math.min(1, spec.stops[n - 1]));
}
