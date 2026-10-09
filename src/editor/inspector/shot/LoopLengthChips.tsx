import React from "react";
import clsx from "clsx";
import type { Aspect, Layout, Shot } from "../../../doc/types";
import { useEditorStore } from "../../../state/store";
import { Field, Tooltip } from "../../../ui";
import { formatSeconds, loopLengthChips } from "../../loop-length";

type FramesLayout = Extract<Layout, { kind: "rows" | "columns" }>;

interface LoopLengthChipsProps {
  shot: Shot;
  layout: FramesLayout;
  aspect: Aspect;
}

/**
 * One-click loop lengths for a Frames shot. Its speed follows the shot length, so a longer loop
 * is a calmer one. A chip sets the duration through `setShotDuration`, one undo step. A chip
 * under the shot's minimum stays focusable (aria-disabled) so its reason shows on hover and focus.
 */
export const LoopLengthChips: React.FC<LoopLengthChipsProps> = ({ shot, layout, aspect }) => {
  const index = useEditorStore((s) => s.doc.shots.findIndex((c) => c.id === shot.id));
  const setShotDuration = useEditorStore((s) => s.setShotDuration);
  const chips = loopLengthChips(layout, aspect, shot.duration);
  const reasonIdFor = (seconds: number) => `loop-length-${shot.id}-${seconds}`;

  return (
    <Field label="Loop length">
      <div role="group" aria-label="Loop length" className="flex items-center gap-1">
        {chips.map((chip) => {
          const reasonId = reasonIdFor(chip.seconds);
          const button = (
            <button
              key={chip.seconds}
              type="button"
              aria-pressed={chip.pressed}
              aria-disabled={chip.disabled || undefined}
              aria-describedby={chip.disabled ? reasonId : undefined}
              onClick={() => {
                if (!chip.disabled && !chip.pressed && index >= 0) {
                  setShotDuration(index, chip.seconds);
                }
              }}
              className={clsx(
                "h-6 min-w-10 px-2 rounded-sm border text-[11px] font-medium tabular-nums whitespace-nowrap transition-colors duration-120",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
                chip.pressed
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-text)]"
                  : "border-[var(--color-line)] text-[var(--color-text-2)]",
                chip.disabled
                  ? "opacity-40 cursor-not-allowed"
                  : !chip.pressed &&
                      "cursor-pointer hover:text-[var(--color-text)] hover:bg-[var(--color-hover)]",
              )}
            >
              {formatSeconds(chip.seconds)}
            </button>
          );
          return chip.disabled ? (
            <Tooltip key={chip.seconds} content={chip.reason}>
              {button}
            </Tooltip>
          ) : (
            button
          );
        })}
        {/* Outside the buttons, so a reason describes its chip without joining its name. */}
        {chips.map(
          (chip) =>
            chip.disabled && (
              <span key={chip.seconds} id={reasonIdFor(chip.seconds)} className="sr-only">
                {chip.reason}
              </span>
            ),
        )}
      </div>
    </Field>
  );
};
