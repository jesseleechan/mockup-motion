import type { Aspect, Layout } from "../doc/types";
import { framesAssetIds, MAX_SHOT_DURATION, minShotDuration } from "../motion";

type FramesLayout = Extract<Layout, { kind: "rows" | "columns" }>;

/**
 * The loop lengths a Frames shot offers as one-click chips (docs/phone-frames-plan/README.md
 * §8, suggestion 4). Every lane moves one asset period per loop, so a longer loop moves slower.
 */
export const LOOP_LENGTHS = [15, 20, 30] as const;

export interface LoopLengthChip {
  seconds: number;
  /** The shot already lasts this long. */
  pressed: boolean;
  /** Shorter than the shot's minimum: its lanes would pass the speed limit (quality-bar §2.5). */
  disabled: boolean;
  /** Why the chip is disabled, shown on hover and focus. */
  reason?: string;
}

/**
 * The loop length chips of a Frames shot (rows or columns with travel "period"). A chip below
 * `minShotDuration` for the shown screenshots is disabled, so a click never sets a length the
 * store would raise anyway. 30 s is always allowed: `framesAssetIds` keeps the minimum at or
 * under it.
 */
export function loopLengthChips(
  layout: FramesLayout,
  aspect: Aspect,
  duration: number,
): LoopLengthChip[] {
  const shortest = Math.min(MAX_SHOT_DURATION, minShotDuration(layout, aspect));
  const shown = framesAssetIds(layout, aspect).length;
  return LOOP_LENGTHS.map((seconds) => {
    const disabled = seconds < shortest;
    return {
      seconds,
      // Durations move in 0.5 s steps, so a small tolerance only absorbs float noise.
      pressed: Math.abs(duration - seconds) < 1e-6,
      disabled,
      reason: disabled
        ? `${shown} ${shown === 1 ? "screenshot needs" : "screenshots need"} at least ${formatSeconds(shortest)}`
        : undefined,
    };
  });
}

/** "19.5 s", "20 s": whole seconds drop the decimal. */
export function formatSeconds(seconds: number): string {
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)} s`;
}
