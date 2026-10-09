import React from "react";
import type { Aspect, AssetRef, DeviceKind, Layout, Shot } from "../../../doc/types";
import { framesAssetIds, SLIDER_MIN_STEP, sliderStepMax } from "../../../motion";
import { useEditorStore } from "../../../state/store";
import { Field, Section, Select, Slider } from "../../../ui";
import { DEVICE_LABELS, LAYOUT_LABELS, optionsFor } from "../../labels";
import { useShotUpdate } from "./useShotUpdate";

const SINGLE_DEVICES: DeviceKind[] = ["browser", "phone", "laptop", "tablet", "card"];
const STACK_DEVICES: ("browser" | "card")[] = ["browser", "card"];
// Picking a layout here makes a single device or a title card (docs/plan/follow-ups.md); a slider
// comes from the Mobile Slider and Desktop Slider templates, so the picker only lists it on a
// shot that already uses it.
const PICKER_LAYOUTS = (Object.keys(LAYOUT_LABELS) as Layout["kind"][]).filter(
  (kind) => kind !== "slider",
);

interface LayoutSectionProps {
  shot: Shot;
  assets: AssetRef[];
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

type FramesLayout = Extract<Layout, { kind: "rows" | "columns" }>;

/** Desktop Frames and Mobile Frames: the speed follows the shot length (travel "period"). */
const FramesSpeedNote: React.FC<{ layout: FramesLayout; aspect: Aspect }> = ({
  layout,
  aspect,
}) => {
  const shown = framesAssetIds(layout, aspect).length;
  return (
    <Field label="Speed">
      <p className="text-[11px] text-[var(--color-text-2)]">Speed follows shot length</p>
      {shown < layout.assetIds.length && (
        <p className="mt-1 text-[11px] text-[var(--color-text-2)]">
          Shows the first {shown} screenshots, so the loop fits in 30 s.
        </p>
      )}
    </Field>
  );
};

/** Layout kind plus the layout's own parameters (device, arrangement, tilt, speed). */
export const LayoutSection: React.FC<LayoutSectionProps> = ({ shot, assets }) => {
  const update = useShotUpdate(shot.id);
  const aspect = useEditorStore((s) => s.doc.aspect);
  const { layout } = shot;

  const handleKindChange = (kind: Layout["kind"]) => {
    update(
      (target) => {
        if (kind === "title") {
          target.layout = { kind: "title" };
          if (target.texts.length === 0) {
            target.texts.push({
              id: crypto.randomUUID(),
              text: "Headline",
              role: "title",
              font: "display",
              size: 5.5,
              anchor: "center",
              align: "center",
              color: "",
              animation: "maskReveal",
              delay: 0,
            });
          }
        } else {
          target.layout = {
            kind: "single",
            device: "browser",
            assetId: assets.find((a) => a.kind === "image")?.id ?? "",
          };
        }
      },
      { label: `Change layout to ${LAYOUT_LABELS[kind].toLowerCase()}` },
    );
  };

  return (
    <Section title="Layout">
      <div className="space-y-3">
        <Field label="Layout">
          <Select
            aria-label="Layout"
            value={layout.kind}
            onChange={handleKindChange}
            options={optionsFor(
              LAYOUT_LABELS,
              layout.kind === "slider" ? [...PICKER_LAYOUTS, "slider"] : PICKER_LAYOUTS,
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

        {layout.kind === "pair" && (
          <Field label="Arrangement">
            <Select
              aria-label="Arrangement"
              value={layout.arrangement}
              onChange={(arrangement) =>
                update(
                  (target) => {
                    if (target.layout.kind === "pair") target.layout.arrangement = arrangement;
                  },
                  { label: "Change pair arrangement" },
                )
              }
              options={[
                { value: "overlap", label: "Overlap" },
                { value: "side", label: "Side by side" },
              ]}
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
            {/* Frames has no tilt by design (quality bar §4), so a period layout hides it. */}
            {layout.travel !== "period" && (
              <Field label="Tilt" value={`${layout.tilt}°`}>
                <Slider
                  aria-label="Tilt"
                  min={-30}
                  max={30}
                  step={1}
                  value={layout.tilt}
                  onChange={(val) =>
                    update((target) => {
                      if (target.layout.kind === "rows") target.layout.tilt = val;
                    })
                  }
                />
              </Field>
            )}
            {layout.travel === "period" ? (
              <FramesSpeedNote layout={layout} aspect={aspect} />
            ) : (
              <Field label="Speed" value={percent(layout.speed)}>
                <Slider
                  aria-label="Speed"
                  min={0.05}
                  max={1.0}
                  step={0.05}
                  value={layout.speed}
                  onChange={(val) =>
                    update((target) => {
                      if (target.layout.kind === "rows") target.layout.speed = val;
                    })
                  }
                />
              </Field>
            )}
          </>
        )}

        {layout.kind === "slider" && (
          <>
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
            <Field label="Card shape">
              <Select
                aria-label="Card shape"
                value={layout.shape}
                onChange={(shape) =>
                  update(
                    (target) => {
                      if (target.layout.kind === "slider") target.layout.shape = shape;
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
            <Field label="Step length" value={`${layout.step.toFixed(1)} s`}>
              <Slider
                aria-label="Step length"
                min={SLIDER_MIN_STEP}
                // One step per screenshot must fit in a 30 s shot (quality bar §2.2).
                max={sliderStepMax(layout.assetIds.length)}
                step={0.1}
                value={layout.step}
                onChange={(val) =>
                  update(
                    (target) => {
                      // Whole tenths; the store sets the shot length to screenshots × step.
                      if (target.layout.kind === "slider")
                        target.layout.step = Math.round(val * 10) / 10;
                    },
                    { label: "Change step length", coalesceKey: `slider-step-${shot.id}` },
                  )
                }
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
            {layout.travel !== "period" && (
              <Field label="Tilt" value={`${layout.tilt}°`}>
                <Slider
                  aria-label="Tilt"
                  min={-30}
                  max={30}
                  step={1}
                  value={layout.tilt}
                  onChange={(val) =>
                    update((target) => {
                      if (target.layout.kind === "columns") target.layout.tilt = val;
                    })
                  }
                />
              </Field>
            )}
            {layout.travel === "period" ? (
              <FramesSpeedNote layout={layout} aspect={aspect} />
            ) : (
              <Field label="Speed" value={percent(layout.speed)}>
                <Slider
                  aria-label="Speed"
                  min={0.05}
                  max={1.0}
                  step={0.05}
                  value={layout.speed}
                  onChange={(val) =>
                    update((target) => {
                      if (target.layout.kind === "columns") target.layout.speed = val;
                    })
                  }
                />
              </Field>
            )}
          </>
        )}

        {layout.kind === "wall" && (
          <>
            <Field label="Columns">
              <Select
                aria-label="Columns"
                value={String(layout.columns)}
                onChange={(val) =>
                  update((target) => {
                    if (target.layout.kind === "wall")
                      target.layout.columns = parseInt(val, 10) as 3 | 4 | 5;
                  })
                }
                options={[
                  { value: "3", label: "3 columns" },
                  { value: "4", label: "4 columns" },
                  { value: "5", label: "5 columns" },
                ]}
              />
            </Field>
            <Field label="Speed" value={percent(layout.speed)}>
              <Slider
                aria-label="Speed"
                min={0.05}
                max={1.0}
                step={0.05}
                value={layout.speed}
                onChange={(val) =>
                  update((target) => {
                    if (target.layout.kind === "wall") target.layout.speed = val;
                  })
                }
              />
            </Field>
          </>
        )}

        {layout.kind === "stack" && (
          <>
            <Field label="Device">
              <Select
                aria-label="Device"
                value={layout.device}
                onChange={(device) =>
                  update((target) => {
                    if (target.layout.kind === "stack") target.layout.device = device;
                  })
                }
                options={optionsFor(DEVICE_LABELS, STACK_DEVICES)}
              />
            </Field>
            <Field label="Spread" value={percent(layout.spread)}>
              <Slider
                aria-label="Spread"
                min={0.1}
                max={1.0}
                step={0.05}
                value={layout.spread}
                onChange={(val) =>
                  update((target) => {
                    if (target.layout.kind === "stack") target.layout.spread = val;
                  })
                }
              />
            </Field>
          </>
        )}
      </div>
    </Section>
  );
};
