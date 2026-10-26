import React from "react";
import type { AssetRef, DeviceKind, Layout, Shot } from "../../../doc/types";
import { isSteppedLayout } from "../../../motion";
import { Field, Section, Select } from "../../../ui";
import { DEVICE_LABELS, LAYOUT_LABELS, optionsFor } from "../../labels";
import { useShotUpdate } from "./useShotUpdate";

const SINGLE_DEVICES: DeviceKind[] = ["browser", "phone", "card"];
// Picking a layout here makes a single device. Frames, sliders, orbits, Responsive Scroll and Page
// Columns come from their templates, so the picker lists them only on a shot that already uses one.
const PICKER_LAYOUTS: Layout["kind"][] = ["single"];

interface LayoutSectionProps {
  shot: Shot;
  assets: AssetRef[];
}

/** Layout kind plus the layout's own parameters (device, lanes, card shape). */
export const LayoutSection: React.FC<LayoutSectionProps> = ({ shot, assets }) => {
  const update = useShotUpdate(shot.id);
  const { layout } = shot;

  const handleKindChange = (kind: Layout["kind"]) => {
    update(
      (target) => {
        target.layout = {
          kind: "single",
          device: "browser",
          assetId: assets.find((a) => a.kind === "image")?.id ?? "",
        };
      },
      { label: `Change layout to ${LAYOUT_LABELS[kind].toLowerCase()}` },
    );
  };

  return (
    <Section title="Layout">
      <Field label="Layout">
        <Select
          aria-label="Layout"
          value={layout.kind}
          onChange={handleKindChange}
          options={optionsFor(
            // A deck is a slider arrangement (stack plan D4); it reads as a stack.
            layout.kind === "slider" && layout.arrangement === "deck"
              ? { ...LAYOUT_LABELS, slider: "Stack" }
              : LAYOUT_LABELS,
            PICKER_LAYOUTS.includes(layout.kind)
              ? PICKER_LAYOUTS
              : [...PICKER_LAYOUTS, layout.kind],
          )}
        />
      </Field>

      {layout.kind === "single" && (
        <Field label="Device">
          <Select
            aria-label="Device"
            value={layout.device}
            onChange={(device) =>
              update(
                (target) => {
                  if (target.layout.kind === "single") target.layout.device = device;
                },
                { label: `Change device to ${DEVICE_LABELS[device].toLowerCase()}` },
              )
            }
            options={optionsFor(DEVICE_LABELS, SINGLE_DEVICES)}
          />
        </Field>
      )}

      {layout.kind === "rows" && (
        <>
          <Field label="Rows">
            <Select
              aria-label="Rows"
              value={String(layout.rows)}
              onChange={(val) =>
                update((target) => {
                  if (target.layout.kind === "rows")
                    target.layout.rows = parseInt(val, 10) as 1 | 2 | 3;
                })
              }
              options={[
                { value: "1", label: "1 row" },
                { value: "2", label: "2 rows" },
                { value: "3", label: "3 rows" },
              ]}
            />
          </Field>
          {/* Frames has no tilt by design (quality bar §4); its speed is the Pace section. */}
        </>
      )}

      {layout.kind === "slider" && (
        <Field label="Direction">
          <Select
            aria-label="Direction"
            value={layout.axis}
            onChange={(axis) =>
              update(
                (target) => {
                  if (target.layout.kind === "slider") target.layout.axis = axis;
                },
                { label: "Change slider direction" },
              )
            }
            options={[
              { value: "x", label: "Horizontal" },
              { value: "y", label: "Vertical" },
            ]}
          />
        </Field>
      )}

      {(isSteppedLayout(layout) || layout.kind === "pageColumns") && (
        <>
          <Field label="Card shape">
            <Select
              aria-label="Card shape"
              value={layout.shape}
              onChange={(shape) =>
                update(
                  (target) => {
                    const next = target.layout;
                    if (isSteppedLayout(next) || next.kind === "pageColumns") next.shape = shape;
                  },
                  { label: "Change card shape" },
                )
              }
              options={[
                { value: "mobile", label: "Mobile" },
                { value: "desktop", label: "Desktop" },
              ]}
            />
          </Field>
        </>
      )}

      {layout.kind === "columns" && (
        <>
          <Field label="Columns">
            <Select
              aria-label="Columns"
              value={String(layout.columns)}
              onChange={(val) =>
                update((target) => {
                  if (target.layout.kind === "columns")
                    target.layout.columns = parseInt(val, 10) as 2 | 3 | 4 | 5;
                })
              }
              options={[
                { value: "2", label: "2 columns" },
                { value: "3", label: "3 columns" },
                { value: "4", label: "4 columns" },
                { value: "5", label: "5 columns" },
              ]}
            />
          </Field>
        </>
      )}
    </Section>
  );
};
