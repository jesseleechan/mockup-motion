import React from "react";
import type { EasingId, Shot } from "../../../doc/types";
import { Field, Section, SegmentedControl, Select, Slider } from "../../../ui";
import { CAMERA_LABELS, CAMERA_PRESET_ORDER, EASING_LABELS, optionsFor } from "../../labels";
import { useShotUpdate } from "./useShotUpdate";

const CAMERA_EASINGS: EasingId[] = ["smooth", "gentle", "spring", "linear"];

export const CameraSection: React.FC<{ shot: Shot }> = ({ shot }) => {
  const update = useShotUpdate(shot.id);
  const { camera } = shot;

  return (
    <Section title="Camera">
      <div className="space-y-3">
        <Field label="Move">
          <SegmentedControl
            aria-label="Camera move"
            size="sm"
            value={camera.preset}
            onChange={(preset) =>
              update(
                (target) => {
                  target.camera.preset = preset;
                },
                { label: `Change camera to ${CAMERA_LABELS[preset].toLowerCase()}` },
              )
            }
            options={optionsFor(CAMERA_LABELS, CAMERA_PRESET_ORDER)}
          />
        </Field>

        {/* A still camera has no move to scale or ease. */}
        {camera.preset === "pushIn" && (
          <>
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
          </>
        )}

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
