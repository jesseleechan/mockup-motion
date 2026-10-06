import React from "react";
import type { EasingId, Shot } from "../../../doc/types";
import { Field, Section, Select, Slider } from "../../../ui";
import { CAMERA_LABELS, CAMERA_PRESET_ORDER, EASING_LABELS, optionsFor } from "../../labels";
import { useShotUpdate } from "./useShotUpdate";

const CAMERA_EASINGS: EasingId[] = ["smooth", "gentle", "spring", "linear"];

export const CameraSection: React.FC<{ shot: Shot }> = ({ shot }) => {
  const update = useShotUpdate(shot.id);
  const { camera } = shot;

  return (
    <Section title="Camera">
      <div className="space-y-3">
        <Field label="Move" stacked>
          <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Camera move">
            {CAMERA_PRESET_ORDER.map((preset) => {
              const isActive = camera.preset === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() =>
                    update(
                      (target) => {
                        target.camera.preset = preset;
                      },
                      { label: `Change camera to ${CAMERA_LABELS[preset].toLowerCase()}` },
                    )
                  }
                  className={`px-2 py-1.5 rounded-md text-left text-[11px] font-medium border truncate transition-colors ${
                    isActive
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                      : "border-[var(--color-line)] text-[var(--color-text-2)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]"
                  }`}
                >
                  {CAMERA_LABELS[preset]}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Intensity" value={`${Math.round(camera.intensity * 100)}%`}>
          <Slider
            aria-label="Intensity"
            min={0}
            max={100}
            step={5}
            value={Math.round(camera.intensity * 100)}
            onChange={(val) =>
              update(
                (target) => {
                  target.camera.intensity = val / 100;
                },
                { coalesceKey: `camera-intensity-${shot.id}` },
              )
            }
          />
        </Field>

        <Field label="Easing">
          <Select
            aria-label="Camera easing"
            value={camera.easing}
            onChange={(easing) =>
              update(
                (target) => {
                  target.camera.easing = easing;
                },
                { label: "Change camera easing" },
              )
            }
            options={optionsFor(
              EASING_LABELS,
              // A template may use an easing the picker doesn't offer; show it rather than a blank.
              CAMERA_EASINGS.includes(camera.easing)
                ? CAMERA_EASINGS
                : [...CAMERA_EASINGS, camera.easing],
            )}
          />
        </Field>

        <Field label="Float" value={`${Math.round(camera.float * 100)}%`}>
          <Slider
            aria-label="Float"
            min={0}
            max={100}
            step={5}
            value={Math.round(camera.float * 100)}
            onChange={(val) =>
              update(
                (target) => {
                  target.camera.float = val / 100;
                },
                { coalesceKey: `camera-float-${shot.id}` },
              )
            }
          />
        </Field>
      </div>
    </Section>
  );
};
