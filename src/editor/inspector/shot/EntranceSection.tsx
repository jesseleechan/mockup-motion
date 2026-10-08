import React from "react";
import type { Aspect, Shot } from "../../../doc/types";
import { fixedShotDuration, minShotDuration } from "../../../motion";
import { loopSkipsEntrance } from "../../../motion/evaluate";
import { useEditorStore } from "../../../state/store";
import { Field, Section, Select, Slider } from "../../../ui";
import { ENTRANCE_LABELS, optionsFor } from "../../labels";
import { useShotUpdate } from "./useShotUpdate";

/** Shot duration and how the layout's devices appear at the start of the shot. */
export const EntranceSection: React.FC<{ shot: Shot; aspect: Aspect }> = ({ shot, aspect }) => {
  const update = useShotUpdate(shot.id);
  const skipped = useEditorStore((s) =>
    loopSkipsEntrance(
      s.doc,
      s.doc.shots.findIndex((candidate) => candidate.id === shot.id),
    ),
  );
  const hintId = `entrance-hint-${shot.id}`;
  // Frames needs a long enough shot to stay under its speed limit (quality-bar §2.5).
  const shortest = Math.min(30, minShotDuration(shot.layout, aspect));
  // A slider lasts one step per screenshot, so its loop stays seamless (contracts.md §5).
  const fixed = fixedShotDuration(shot.layout) !== null;

  return (
    <Section title="Entrance and duration">
      <div className="space-y-3">
        <Field
          label="Duration"
          value={`${shot.duration.toFixed(1)} s`}
          hint={fixed ? "Set by step length × screenshots" : undefined}
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

        <Field
          label="Entrance"
          hint={skipped ? "Loops start with the first shot in place." : undefined}
          hintId={hintId}
        >
          <Select
            aria-label="Entrance"
            aria-describedby={skipped ? hintId : undefined}
            value={shot.entrance}
            onChange={(entrance) =>
              update(
                (target) => {
                  target.entrance = entrance;
                },
                { label: "Change entrance animation" },
              )
            }
            options={optionsFor(ENTRANCE_LABELS)}
          />
        </Field>
      </div>
    </Section>
  );
};
