import React from "react";
import type { Aspect, Shot } from "../../../doc/types";
import { fixedShotDuration, isPacedShot, minShotDuration, schedule } from "../../../motion";
import { useEditorStore } from "../../../state/store";
import { Field, Section, Slider } from "../../../ui";
import { useShotUpdate } from "./useShotUpdate";

/**
 * The shot's duration: the loop length. A slider, orbit or scrolling responsive shot sets its own
 * length so its loop stays seamless (contracts.md §5), and a Frames shot's pace sets its length
 * (src/motion/pace.ts); there it is a read-out, not a control.
 */
export const DurationSection: React.FC<{ shot: Shot; aspect: Aspect }> = ({ shot, aspect }) => {
  const update = useShotUpdate(shot.id);
  const doc = useEditorStore((s) => s.doc);
  const fixed =
    fixedShotDuration(shot.layout, shot.scroll, doc.assets) !== null || isPacedShot(shot);
  // Frames needs a long enough shot to stay under its speed limit (quality-bar §2.5).
  const shortest = Math.min(30, minShotDuration(shot.layout, aspect));
  const seconds = `${shot.duration.toFixed(1)} s`;

  if (fixed) {
    // What plays: a crossfade-wrapped loop (Responsive Scroll) wraps early by its fade, so the
    // loop is shorter than the shot (contracts.md §5). The transport shows the same total.
    const { total } = schedule(doc);
    return (
      <Section title="Duration">
        <Field label={doc.loop ? "Loop length" : "Length"}>
          <span className="block text-right text-[12px] tabular-nums text-[var(--color-text)]">
            {`${total.toFixed(1)} s`}
          </span>
        </Field>
      </Section>
    );
  }

  return (
    <Section title="Duration">
      <Field label="Duration" value={seconds}>
        <Slider
          aria-label="Duration"
          min={shortest}
          max={shortest > 1 ? 30 : 15}
          step={0.5}
          value={shot.duration}
          onChange={(val) =>
            update(
              (target) => {
                target.duration = Math.max(shortest, val);
              },
              { coalesceKey: `shot-duration-${shot.id}` },
            )
          }
        />
      </Field>
    </Section>
  );
};
