import React from "react";
import type { Aspect, Shot } from "../../../doc/types";
import { fixedShotDuration, minShotDuration } from "../../../motion";
import { useEditorStore } from "../../../state/store";
import { Field, Section, Slider } from "../../../ui";
import { useShotUpdate } from "./useShotUpdate";

/** The shot's duration: the loop length. */
export const DurationSection: React.FC<{ shot: Shot; aspect: Aspect }> = ({ shot, aspect }) => {
  const update = useShotUpdate(shot.id);
  // Frames needs a long enough shot to stay under its speed limit (quality-bar §2.5).
  const shortest = Math.min(30, minShotDuration(shot.layout, aspect));
  // A slider or orbit lasts one step per screenshot, so its loop stays seamless; a scrolling
  // responsive shot lasts its stops (contracts.md §5).
  const assets = useEditorStore((s) => s.doc.assets);
  const fixed = fixedShotDuration(shot.layout, shot.scroll, assets) !== null;

  return (
    <Section title="Duration">
      <Field
        label="Duration"
        value={`${shot.duration.toFixed(1)} s`}
        hint={
          fixed
            ? shot.layout.kind === "responsive"
              ? "Set by the scroll stops"
              : "Set by step length × screenshots"
            : undefined
        }
        hintId={`duration-hint-${shot.id}`}
      >
        <Slider
          aria-label="Duration"
          aria-describedby={fixed ? `duration-hint-${shot.id}` : undefined}
          disabled={fixed}
          min={shortest}
          max={shortest > 1 || fixed ? 30 : 15}
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
