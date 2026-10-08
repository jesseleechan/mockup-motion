// Quality-bar §2.5: a marquee never moves faster than 0.12 frame widths per second.
export const MARQUEE_MAX_FRAME_WIDTHS_PER_SECOND = 0.12;
// Quality-bar §2.5: Frames (rows with travel "period") has its own limit, in frame heights
// (stage units) per second, so a whole asset period fits in one loop at every aspect.
export const FRAMES_MAX_FRAME_HEIGHTS_PER_SECOND = 0.2;

/**
 * Marquee velocity in stage units per second, the same for any number of screenshots.
 *
 * A seamless native loop would need the travel per shot to be a whole asset period
 * (N cards). At 0.12 frame widths per second an 8 s shot travels at most 0.96 frame
 * widths, less than two cards at 16:9 and less than one at 9:16, so with three or more
 * screenshots no whole period fits. Instead the travel is snapped to a whole number of
 * card steps: after `shotDuration` (the loop length, for a single looping shot) every card
 * sits where a card sat at t = 0, so the loop wrap crossfade keeps the cards in place and
 * only dissolves the screens (contracts.md §5). When even one step would break the limit
 * (short shots, narrow frames), the marquee runs at its target speed and the crossfade
 * carries the loop on its own.
 */
export function marqueeVelocity(
  speed: number,
  frameWidth: number,
  step: number,
  shotDuration: number,
): number {
  const vMax = MARQUEE_MAX_FRAME_WIDTHS_PER_SECOND * frameWidth;
  const duration = Math.max(0.1, shotDuration);
  const target = Math.max(0.05, Math.min(1.0, speed)) * vMax;
  const maxSteps = Math.floor((vMax * duration) / step);
  if (maxSteps < 1) return target;
  const steps = Math.min(maxSteps, Math.max(1, Math.round((target * duration) / step)));
  return (steps * step) / duration;
}
