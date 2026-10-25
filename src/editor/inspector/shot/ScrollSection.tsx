import React from "react";
import type { AssetRef, EasingId, Shot } from "../../../doc/types";
import { Button, Chip, Field, Icon, Section, Select, SliderRow, Switch } from "../../../ui";
import { minDurationFor, scrollableFramesFor } from "../../../motion/scroll";
import { screenAspectFor } from "../../../motion/layouts/types";
import { AlertCircle, X } from "lucide-react";
import { EASING_LABELS, optionsFor } from "../../labels";
import { useShotUpdate } from "./useShotUpdate";

const SCROLL_EASINGS: EasingId[] = ["smooth", "gentle", "quintInOut"];

interface ScrollSectionProps {
  shot: Shot;
  assets: AssetRef[];
}

/** Opt-in page scroll for single-device shots (quality-bar §2.2 speed limits). */
export const ScrollSection: React.FC<ScrollSectionProps> = ({ shot, assets }) => {
  const update = useShotUpdate(shot.id);
  const { layout, scroll } = shot;
  if (layout.kind !== "single") return null;

  let minDur = 0;
  if (scroll?.enabled) {
    const asset = layout.assetId ? assets.find((a) => a.id === layout.assetId) : undefined;
    const scrollableFrames =
      asset?.width && asset?.height
        ? scrollableFramesFor(layout.device, screenAspectFor(layout.device, asset), asset)
        : 1;
    minDur = minDurationFor(scroll, scrollableFrames);
  }

  return (
    <Section title="Scroll">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-medium text-text">Scroll through page</div>
          <div className="text-[11px] leading-4 text-text-2">
            Scrolls a tall screenshot between stops
          </div>
        </div>
        <Switch
          aria-label="Scroll through page"
          checked={Boolean(scroll?.enabled)}
          onCheckedChange={(enabled) => {
            update(
              (target) => {
                if (enabled) {
                  target.scroll = {
                    enabled: true,
                    stops:
                      target.scroll?.stops && target.scroll.stops.length > 0
                        ? target.scroll.stops
                        : [0, 0.4, 0.75, 1.0],
                    hold: target.scroll?.hold ?? 0.8,
                    easing: target.scroll?.easing ?? "smooth",
                  };
                  // Scroll shots keep a near-static camera (quality-bar §2.5).
                  if (target.camera.intensity > 0.3) {
                    target.camera.intensity = 0.3;
                  }
                } else if (target.scroll) {
                  target.scroll.enabled = false;
                }
              },
              { label: enabled ? "Enable page scroll" : "Disable page scroll" },
            );
          }}
        />
      </div>

      {scroll?.enabled && (
        <>
          {shot.duration < minDur && (
            <div className="flex items-start gap-2 p-2.5 rounded-[12px] bg-accent-soft">
              <Icon icon={AlertCircle} size={14} className="text-accent shrink-0 mt-px" />
              <div className="flex-1 min-w-0 flex flex-col items-start gap-1.5">
                <p className="text-[11.5px] leading-4 text-text">
                  Needs {minDur.toFixed(1)} s to scroll at a comfortable speed.
                </p>
                <Button
                  size="xs"
                  onClick={() =>
                    update(
                      (target) => {
                        target.duration = Math.ceil(minDur);
                      },
                      { label: "Extend duration for scroll" },
                    )
                  }
                >
                  Extend to {Math.ceil(minDur)} s
                </Button>
              </div>
            </div>
          )}

          <Field label="Stops" value={String(scroll.stops?.length ?? 0)} stacked>
            <div className="flex flex-col gap-2">
              <StopChips
                stops={scroll.stops || [0]}
                onRemove={(index) =>
                  update((target) => {
                    if (target.scroll) {
                      target.scroll.stops = target.scroll.stops.filter((_, i) => i !== index);
                    }
                  })
                }
              />

              {/* Layout Stage's .btn-grid. */}
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  size="sm"
                  onClick={() =>
                    update((target) => {
                      if (target.scroll) {
                        const stops = [...(target.scroll.stops || [0, 1])];
                        stops.push(0.5);
                        target.scroll.stops = Array.from(new Set(stops)).sort((a, b) => a - b);
                      }
                    })
                  }
                >
                  Add stop
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    update((target) => {
                      if (target.scroll) target.scroll.stops = [0, 0.33, 0.66, 1.0];
                    })
                  }
                >
                  Reset stops
                </Button>
              </div>
            </div>
          </Field>

          <SliderRow
            label="Hold"
            aria-label="Hold at each stop"
            output={`${scroll.hold.toFixed(1)} s`}
            min={0.3}
            max={2.0}
            step={0.1}
            value={scroll.hold}
            onChange={(val) =>
              update(
                (target) => {
                  if (target.scroll) target.scroll.hold = val;
                },
                { coalesceKey: `scroll-hold-${shot.id}` },
              )
            }
          />

          <Field label="Easing">
            <Select
              aria-label="Scroll easing"
              value={scroll.easing}
              onChange={(easing) =>
                update((target) => {
                  if (target.scroll) target.scroll.easing = easing;
                })
              }
              options={optionsFor(EASING_LABELS, SCROLL_EASINGS)}
            />
          </Field>
        </>
      )}
    </Section>
  );
};

// The first and last stops stay, so they read as chips without the remove action.
const FIXED_STOP =
  "inline-flex items-center h-7 px-2.5 rounded-[9px] bg-field font-num text-[12px] tabular-nums text-text-2 select-none";

/**
 * Where the page holds, in page order, as Layout Stage's chips. A chip between the first and last
 * stops removes itself.
 */
const StopChips: React.FC<{ stops: number[]; onRemove: (index: number) => void }> = ({
  stops,
  onRemove,
}) => (
  <div className="flex flex-wrap gap-[5px]">
    {stops.map((stop, i) => {
      const pct = `${Math.round(stop * 100)}%`;
      const removable = stops.length > 2 && i > 0 && i < stops.length - 1;
      return removable ? (
        <Chip
          key={i}
          aria-label={`Remove stop at ${pct}`}
          title="Remove stop"
          className="font-num tabular-nums"
          onClick={() => onRemove(i)}
        >
          {pct}
          <Icon icon={X} size={11} />
        </Chip>
      ) : (
        <span key={i} className={FIXED_STOP}>
          {pct}
        </span>
      );
    })}
  </div>
);
