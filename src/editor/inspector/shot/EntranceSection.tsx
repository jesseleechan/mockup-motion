import React from "react";
import type { Shot } from "../../../doc/types";
import { Field, Section, Select, Slider } from "../../../ui";
import { ENTRANCE_LABELS, optionsFor } from "../../labels";
import { useShotUpdate } from "./useShotUpdate";

/** Shot duration and how the layout's devices appear at the start of the shot. */
export const EntranceSection: React.FC<{ shot: Shot }> = ({ shot }) => {
  const update = useShotUpdate(shot.id);

  return (
    <Section title="Entrance and duration">
      <div className="space-y-3">
        <Field label="Duration" value={`${shot.duration.toFixed(1)} s`}>
          <Slider
            aria-label="Duration"
            min={1}
            max={15}
            step={0.5}
            value={shot.duration}
            onChange={(val) =>
              update(
                (target) => {
                  target.duration = val;
                },
                { coalesceKey: `shot-duration-${shot.id}` },
              )
            }
          />
        </Field>

        <Field label="Entrance">
          <Select
            aria-label="Entrance"
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
