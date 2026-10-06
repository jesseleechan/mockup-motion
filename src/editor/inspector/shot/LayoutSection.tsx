import React from "react";
import type { AssetRef, DeviceKind, Layout, Shot } from "../../../doc/types";
import { Field, Section, Select, Slider } from "../../../ui";
import { DEVICE_LABELS, LAYOUT_LABELS, optionsFor } from "../../labels";
import { useShotUpdate } from "./useShotUpdate";

const SINGLE_DEVICES: DeviceKind[] = ["browser", "phone", "laptop", "tablet", "card"];
const STACK_DEVICES: ("browser" | "card")[] = ["browser", "card"];

interface LayoutSectionProps {
  shot: Shot;
  assets: AssetRef[];
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

/** Layout kind plus the layout's own parameters (device, arrangement, tilt, speed). */
export const LayoutSection: React.FC<LayoutSectionProps> = ({ shot, assets }) => {
  const update = useShotUpdate(shot.id);
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
            options={optionsFor(LAYOUT_LABELS)}
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
