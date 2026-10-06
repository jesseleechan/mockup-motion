import React from "react";
import type { Shot } from "../../../doc/types";
import { Field, Section, Select } from "../../../ui";
import { TRANSITION_LABELS, optionsFor } from "../../labels";
import { useShotUpdate } from "./useShotUpdate";

/** The transition from the previous shot. The timeline chip edits duration and easing. */
export const TransitionSection: React.FC<{ shot: Shot }> = ({ shot }) => {
  const update = useShotUpdate(shot.id);

  return (
    <Section title="Transition">
      <Field label="Transition in">
        <Select
          aria-label="Transition in"
          value={shot.transitionIn?.kind || "cut"}
          onChange={(kind) =>
            update(
              (target) => {
                target.transitionIn = { kind, duration: 0.5, easing: "smooth" };
              },
              { label: "Change shot transition" },
            )
          }
          options={optionsFor(TRANSITION_LABELS)}
        />
      </Field>
    </Section>
  );
};
