import React from "react";
import type { AssetRef, EasingId, Shot } from "../../../doc/types";
import { Button, Field, Icon, Section, Select, Slider, Switch } from "../../../ui";
import { minDurationFor } from "../../../motion/scroll";
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
    let scrollableFrames = 1;
    if (asset?.width && asset?.height) {
      const screenAspect = layout.device === "phone" ? 0.4615 : 1.6;
      const imgAspect = asset.width / asset.height;
      scrollableFrames = Math.max(0, screenAspect / imgAspect - 1);
    }
    minDur = minDurationFor(scroll, scrollableFrames);
  }

  return (
    <Section title="Scroll">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium text-[var(--color-text)]">Scroll through page</div>
            <div className="text-[11px] text-[var(--color-text-3)]">
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
              <div className="p-2.5 rounded-md bg-[var(--color-raised)] border border-[var(--color-accent)]/30 flex items-start gap-2">
                <Icon
                  icon={AlertCircle}
                  size={14}
                  className="text-[var(--color-accent)] shrink-0 mt-0.5"
                />
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="text-[11px] text-[var(--color-text)]">
                    Needs {minDur.toFixed(1)} s to scroll at a comfortable speed.
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-6 text-[10px] px-2"
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
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5 p-2 bg-[var(--color-raised)] rounded-md border border-[var(--color-line)]">
                  {(scroll.stops || [0]).map((stop, sIdx) => (
                    <div
                      key={sIdx}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--color-panel)] border border-[var(--color-line-strong)] text-[11px] font-mono text-[var(--color-text)]"
                    >
                      <span>{Math.round(stop * 100)}%</span>
                      {scroll.stops.length > 2 && sIdx > 0 && sIdx < scroll.stops.length - 1 && (
                        <button
                          type="button"
                          aria-label={`Remove stop at ${Math.round(stop * 100)}%`}
                          onClick={() =>
                            update((target) => {
                              if (target.scroll) {
                                target.scroll.stops = target.scroll.stops.filter(
                                  (_, i) => i !== sIdx,
                                );
                              }
                            })
                          }
                          className="text-[var(--color-text-3)] hover:text-[var(--color-danger)] ml-0.5"
                        >
                          <Icon icon={X} size={11} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1 text-[11px]"
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
                    variant="secondary"
                    className="flex-1 text-[11px]"
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

            <Field label="Hold" value={`${scroll.hold.toFixed(1)} s`}>
              <Slider
                aria-label="Hold at each stop"
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
            </Field>

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
      </div>
    </Section>
  );
};
