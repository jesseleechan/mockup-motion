import React from "react";
import { useEditorStore } from "../../state/store";
import { useUIStore } from "../../state/ui-store";
import type { CameraPresetId, DeviceKind, EasingId, Layout, Shot } from "../../doc/types";
import { Button, Field, Icon, Section, Select, Slider, Switch } from "../../ui";
import { minDurationFor } from "../../motion/scroll";
import { AlertCircle, Copy, Plus, Trash2, Type, X } from "lucide-react";

type LayoutKind = Layout["kind"];

interface ShotInspectorProps {
  shotId: string;
}

const CAMERA_PRESETS: { id: CameraPresetId; label: string }[] = [
  { id: "static", label: "Static" },
  { id: "pushIn", label: "Push In" },
  { id: "pullBack", label: "Pull Back" },
  { id: "dollyLeft", label: "Dolly Left" },
  { id: "dollyRight", label: "Dolly Right" },
  { id: "orbitLeft", label: "Orbit Left" },
  { id: "orbitRight", label: "Orbit Right" },
  { id: "heroTilt", label: "Hero Tilt" },
  { id: "isoDrift", label: "Iso Drift" },
];

export const ShotInspector: React.FC<ShotInspectorProps> = ({ shotId }) => {
  const doc = useEditorStore((s) => s.doc);
  const apply = useEditorStore((s) => s.apply);

  const setSelection = useUIStore((s) => s.setSelection);

  const shot = doc.shots.find((s) => s.id === shotId);
  if (!shot) {
    return (
      <div className="p-4 text-xs text-[var(--color-text-3)] text-center">
        Selected shot not found.
      </div>
    );
  }

  const isTitleLayout = shot.layout.kind === "title";

  const handleLayoutKindChange = (kind: LayoutKind) => {
    apply(
      (draft) => {
        const target = draft.shots.find((s) => s.id === shotId);
        if (!target) return;
        if (kind === "title") {
          target.layout = { kind: "title" };
          // If no texts yet, add title text
          if (target.texts.length === 0) {
            target.texts.push({
              id: crypto.randomUUID(),
              text: "Headline Title",
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
            assetId: doc.assets[0]?.id ?? "",
          };
        }
      },
      { label: `Change layout to ${kind}` },
    );
  };

  const handleDeviceChange = (device: DeviceKind) => {
    apply(
      (draft) => {
        const target = draft.shots.find((s) => s.id === shotId);
        if (target && target.layout.kind === "single") {
          target.layout.device = device;
        }
      },
      { label: `Change device to ${device}` },
    );
  };

  const handleAssetChange = (assetId: string) => {
    apply(
      (draft) => {
        const target = draft.shots.find((s) => s.id === shotId);
        if (target && target.layout.kind === "single") {
          target.layout.assetId = assetId;
        }
      },
      { label: "Change shot asset" },
    );
  };

  const handleAddText = () => {
    const textId = crypto.randomUUID();
    apply(
      (draft) => {
        const target = draft.shots.find((s) => s.id === shotId);
        if (!target) return;
        target.texts.push({
          id: textId,
          text: "New Caption Text",
          role: "caption",
          font: "body",
          size: 2.5,
          anchor: "bottom",
          align: "center",
          color: "",
          animation: "fadeUp",
          delay: 0.2,
        });
      },
      { label: "Add text layer" },
    );
    setSelection({ kind: "text", shotId, id: textId });
  };

  const handleDuplicateShot = () => {
    const copy = {
      ...structuredClone(shot),
      id: crypto.randomUUID(),
    };
    apply(
      (draft) => {
        const idx = draft.shots.findIndex((s) => s.id === shotId);
        draft.shots.splice(idx + 1, 0, copy);
      },
      { label: "Duplicate shot" },
    );
    setSelection({ kind: "shot", id: copy.id });
  };

  const handleDeleteShot = () => {
    if (doc.shots.length <= 1) {
      alert("A project must have at least one shot.");
      return;
    }
    apply(
      (draft) => {
        draft.shots = draft.shots.filter((s) => s.id !== shotId);
      },
      { label: "Delete shot" },
    );
    setSelection({ kind: "video" });
  };

  return (
    <div className="space-y-4">
      {/* Timing & Layout */}
      <Section title="Shot Timing & Layout">
        <div className="space-y-3">
          <Field label={`Duration (${shot.duration.toFixed(1)}s)`}>
            <Slider
              min={1}
              max={15}
              step={0.5}
              value={shot.duration}
              onChange={(val) =>
                apply(
                  (draft) => {
                    const target = draft.shots.find((s) => s.id === shotId);
                    if (target) target.duration = val;
                  },
                  { coalesceKey: `shot-duration-${shotId}` },
                )
              }
            />
          </Field>

          <Field label="Layout Type">
            <Select
              aria-label="Layout Type"
              value={shot.layout.kind}
              onChange={(val) => handleLayoutKindChange(val as Layout["kind"])}
              options={[
                { value: "single", label: "Single Device" },
                { value: "pair", label: "Responsive Pair" },
                { value: "trio", label: "Responsive Trio" },
                { value: "rows", label: "Marquee Rows" },
                { value: "columns", label: "Phone Columns" },
                { value: "wall", label: "Isometric Wall" },
                { value: "stack", label: "Cascading Stack" },
                { value: "title", label: "Title Card" },
              ]}
            />
          </Field>

          {/* Single Layout Controls */}
          {shot.layout.kind === "single" && (
            <>
              <Field label="Device Frame">
                <Select
                  value={shot.layout.device}
                  onChange={(val) => handleDeviceChange(val as DeviceKind)}
                  options={[
                    { value: "browser", label: "Desktop Browser" },
                    { value: "phone", label: "Mobile Phone" },
                    { value: "laptop", label: "Laptop" },
                    { value: "tablet", label: "Tablet" },
                    { value: "card", label: "Frameless Card" },
                  ]}
                />
              </Field>

              <Field label="Screenshot Asset (Drop media here)">
                <div
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes("application/x-mockup-asset-id")) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "copy";
                    }
                  }}
                  onDrop={(e) => {
                    const id = e.dataTransfer.getData("application/x-mockup-asset-id");
                    if (id) {
                      e.preventDefault();
                      handleAssetChange(id);
                    }
                  }}
                >
                  <Select
                    value={shot.layout.assetId || ""}
                    onChange={handleAssetChange}
                    options={[
                      { value: "", label: "No screenshot (empty frame)" },
                      ...doc.assets.map((a) => ({
                        value: a.id,
                        label: `${a.name} (${a.role})`,
                      })),
                    ]}
                  />
                </div>
              </Field>
            </>
          )}

          {/* Pair Layout Controls */}
          {shot.layout.kind === "pair" && (
            <>
              <Field label="Arrangement">
                <Select
                  value={shot.layout.arrangement}
                  onChange={(val) =>
                    apply(
                      (draft) => {
                        const target = draft.shots.find((s) => s.id === shotId);
                        if (target && target.layout.kind === "pair") {
                          target.layout.arrangement = val as "overlap" | "side";
                        }
                      },
                      { label: "Change pair arrangement" },
                    )
                  }
                  options={[
                    { value: "overlap", label: "Overlap (phone in front)" },
                    { value: "side", label: "Side by Side" },
                  ]}
                />
              </Field>

              <Field label="Desktop Asset (Drop media here)">
                <div
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes("application/x-mockup-asset-id")) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "copy";
                    }
                  }}
                  onDrop={(e) => {
                    const id = e.dataTransfer.getData("application/x-mockup-asset-id");
                    if (id) {
                      e.preventDefault();
                      apply((draft) => {
                        const target = draft.shots.find((s) => s.id === shotId);
                        if (target && target.layout.kind === "pair") target.layout.desktopId = id;
                      });
                    }
                  }}
                >
                  <Select
                    value={shot.layout.desktopId || ""}
                    onChange={(val) =>
                      apply((draft) => {
                        const target = draft.shots.find((s) => s.id === shotId);
                        if (target && target.layout.kind === "pair") target.layout.desktopId = val;
                      })
                    }
                    options={[
                      { value: "", label: "Select desktop screenshot" },
                      ...doc.assets.map((a) => ({ value: a.id, label: `${a.name} (${a.role})` })),
                    ]}
                  />
                </div>
              </Field>

              <Field label="Mobile Asset (Drop media here)">
                <div
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes("application/x-mockup-asset-id")) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "copy";
                    }
                  }}
                  onDrop={(e) => {
                    const id = e.dataTransfer.getData("application/x-mockup-asset-id");
                    if (id) {
                      e.preventDefault();
                      apply((draft) => {
                        const target = draft.shots.find((s) => s.id === shotId);
                        if (target && target.layout.kind === "pair") target.layout.mobileId = id;
                      });
                    }
                  }}
                >
                  <Select
                    value={shot.layout.mobileId || ""}
                    onChange={(val) =>
                      apply((draft) => {
                        const target = draft.shots.find((s) => s.id === shotId);
                        if (target && target.layout.kind === "pair") target.layout.mobileId = val;
                      })
                    }
                    options={[
                      { value: "", label: "Select mobile screenshot" },
                      ...doc.assets.map((a) => ({ value: a.id, label: `${a.name} (${a.role})` })),
                    ]}
                  />
                </div>
              </Field>
            </>
          )}

          {/* Trio Layout Controls */}
          {shot.layout.kind === "trio" && (
            <>
              <Field label="Desktop Asset">
                <Select
                  value={shot.layout.desktopId || ""}
                  onChange={(val) =>
                    apply((draft) => {
                      const target = draft.shots.find((s) => s.id === shotId);
                      if (target && target.layout.kind === "trio") target.layout.desktopId = val;
                    })
                  }
                  options={[
                    { value: "", label: "Select desktop screenshot" },
                    ...doc.assets.map((a) => ({ value: a.id, label: a.name })),
                  ]}
                />
              </Field>
              <Field label="Tablet Asset (optional)">
                <Select
                  value={shot.layout.tabletId || ""}
                  onChange={(val) =>
                    apply((draft) => {
                      const target = draft.shots.find((s) => s.id === shotId);
                      if (target && target.layout.kind === "trio") target.layout.tabletId = val || undefined;
                    })
                  }
                  options={[
                    { value: "", label: "None (falls back to pair)" },
                    ...doc.assets.map((a) => ({ value: a.id, label: a.name })),
                  ]}
                />
              </Field>
              <Field label="Mobile Asset">
                <Select
                  value={shot.layout.mobileId || ""}
                  onChange={(val) =>
                    apply((draft) => {
                      const target = draft.shots.find((s) => s.id === shotId);
                      if (target && target.layout.kind === "trio") target.layout.mobileId = val;
                    })
                  }
                  options={[
                    { value: "", label: "Select mobile screenshot" },
                    ...doc.assets.map((a) => ({ value: a.id, label: a.name })),
                  ]}
                />
              </Field>
            </>
          )}

          {/* Rows / Marquee Controls */}
          {shot.layout.kind === "rows" && (
            <>
              <Field label="Rows Count">
                <Select
                  value={String(shot.layout.rows)}
                  onChange={(val) =>
                    apply((draft) => {
                      const target = draft.shots.find((s) => s.id === shotId);
                      if (target && target.layout.kind === "rows") target.layout.rows = parseInt(val, 10) as 1 | 2 | 3;
                    })
                  }
                  options={[
                    { value: "1", label: "1 Row" },
                    { value: "2", label: "2 Rows" },
                    { value: "3", label: "3 Rows" },
                  ]}
                />
              </Field>
              <Field label={`3D Tilt (${shot.layout.tilt}°)`}>
                <Slider
                  min={-30}
                  max={30}
                  step={1}
                  value={shot.layout.tilt}
                  onChange={(val) =>
                    apply((draft) => {
                      const target = draft.shots.find((s) => s.id === shotId);
                      if (target && target.layout.kind === "rows") target.layout.tilt = val;
                    })
                  }
                />
              </Field>
              <Field label={`Speed (${(shot.layout.speed * 100).toFixed(0)}%)`}>
                <Slider
                  min={0.05}
                  max={1.0}
                  step={0.05}
                  value={shot.layout.speed}
                  onChange={(val) =>
                    apply((draft) => {
                      const target = draft.shots.find((s) => s.id === shotId);
                      if (target && target.layout.kind === "rows") target.layout.speed = val;
                    })
                  }
                />
              </Field>
            </>
          )}

          {/* Columns Phone Marquee */}
          {shot.layout.kind === "columns" && (
            <>
              <Field label="Columns Count">
                <Select
                  value={String(shot.layout.columns)}
                  onChange={(val) =>
                    apply((draft) => {
                      const target = draft.shots.find((s) => s.id === shotId);
                      if (target && target.layout.kind === "columns")
                        target.layout.columns = parseInt(val, 10) as 2 | 3 | 4 | 5;
                    })
                  }
                  options={[
                    { value: "2", label: "2 Columns" },
                    { value: "3", label: "3 Columns" },
                    { value: "4", label: "4 Columns" },
                    { value: "5", label: "5 Columns" },
                  ]}
                />
              </Field>
              <Field label={`3D Tilt (${shot.layout.tilt}°)`}>
                <Slider
                  min={-30}
                  max={30}
                  step={1}
                  value={shot.layout.tilt}
                  onChange={(val) =>
                    apply((draft) => {
                      const target = draft.shots.find((s) => s.id === shotId);
                      if (target && target.layout.kind === "columns") target.layout.tilt = val;
                    })
                  }
                />
              </Field>
              <Field label={`Speed (${(shot.layout.speed * 100).toFixed(0)}%)`}>
                <Slider
                  min={0.05}
                  max={1.0}
                  step={0.05}
                  value={shot.layout.speed}
                  onChange={(val) =>
                    apply((draft) => {
                      const target = draft.shots.find((s) => s.id === shotId);
                      if (target && target.layout.kind === "columns") target.layout.speed = val;
                    })
                  }
                />
              </Field>
            </>
          )}

          {/* Isometric Wall */}
          {shot.layout.kind === "wall" && (
            <>
              <Field label="Columns">
                <Select
                  value={String(shot.layout.columns)}
                  onChange={(val) =>
                    apply((draft) => {
                      const target = draft.shots.find((s) => s.id === shotId);
                      if (target && target.layout.kind === "wall")
                        target.layout.columns = parseInt(val, 10) as 3 | 4 | 5;
                    })
                  }
                  options={[
                    { value: "3", label: "3 Columns" },
                    { value: "4", label: "4 Columns" },
                    { value: "5", label: "5 Columns" },
                  ]}
                />
              </Field>
              <Field label={`Speed (${(shot.layout.speed * 100).toFixed(0)}%)`}>
                <Slider
                  min={0.05}
                  max={1.0}
                  step={0.05}
                  value={shot.layout.speed}
                  onChange={(val) =>
                    apply((draft) => {
                      const target = draft.shots.find((s) => s.id === shotId);
                      if (target && target.layout.kind === "wall") target.layout.speed = val;
                    })
                  }
                />
              </Field>
            </>
          )}

          {/* Cascading Stack */}
          {shot.layout.kind === "stack" && (
            <>
              <Field label="Device Frame">
                <Select
                  value={shot.layout.device}
                  onChange={(val) =>
                    apply((draft) => {
                      const target = draft.shots.find((s) => s.id === shotId);
                      if (target && target.layout.kind === "stack") target.layout.device = val as "browser" | "card";
                    })
                  }
                  options={[
                    { value: "browser", label: "Browser" },
                    { value: "card", label: "Card" },
                  ]}
                />
              </Field>
              <Field label={`Depth Spread (${(shot.layout.spread * 100).toFixed(0)}%)`}>
                <Slider
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  value={shot.layout.spread}
                  onChange={(val) =>
                    apply((draft) => {
                      const target = draft.shots.find((s) => s.id === shotId);
                      if (target && target.layout.kind === "stack") target.layout.spread = val;
                    })
                  }
                />
              </Field>
            </>
          )}
        </div>
      </Section>

      {/* Camera */}
      {!isTitleLayout && (
        <Section title="Camera Motion">
          <div className="space-y-3">
            <Field label="Camera Preset">
              <div className="grid grid-cols-3 gap-1.5">
                {CAMERA_PRESETS.map((p) => {
                  const isActive = shot.camera.preset === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        apply(
                          (draft) => {
                            const target = draft.shots.find((s) => s.id === shotId);
                            if (target) target.camera.preset = p.id;
                          },
                          { label: `Change camera to ${p.label}` },
                        )
                      }
                      className={`px-1.5 py-1.5 rounded-md text-[11px] font-medium border truncate transition-colors ${
                        isActive
                          ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                          : "border-[var(--color-line)] text-[var(--color-text-2)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label={`Intensity (${Math.round(shot.camera.intensity * 100)}%)`}>
              <Slider
                min={0}
                max={100}
                step={5}
                value={Math.round(shot.camera.intensity * 100)}
                onChange={(val) =>
                  apply(
                    (draft) => {
                      const target = draft.shots.find((s) => s.id === shotId);
                      if (target) target.camera.intensity = val / 100;
                    },
                    { coalesceKey: `camera-intensity-${shotId}` },
                  )
                }
              />
            </Field>

            <Field label="Easing Curve">
              <Select
                value={shot.camera.easing}
                onChange={(val) =>
                  apply(
                    (draft) => {
                      const target = draft.shots.find((s) => s.id === shotId);
                      if (target) target.camera.easing = val as EasingId;
                    },
                    { label: "Change camera easing" },
                  )
                }
                options={[
                  { value: "smooth", label: "Smooth (Cubic Ease-In-Out)" },
                  { value: "gentle", label: "Gentle (Soft Curve)" },
                  { value: "spring", label: "Spring (Dynamic Bounce)" },
                  { value: "linear", label: "Linear (Steady Travel)" },
                ]}
              />
            </Field>

            <Field label={`Ambient Float (${Math.round(shot.camera.float * 100)}%)`}>
              <Slider
                min={0}
                max={100}
                step={5}
                value={Math.round(shot.camera.float * 100)}
                onChange={(val) =>
                  apply(
                    (draft) => {
                      const target = draft.shots.find((s) => s.id === shotId);
                      if (target) target.camera.float = val / 100;
                    },
                    { coalesceKey: `camera-float-${shotId}` },
                  )
                }
              />
            </Field>
          </div>
        </Section>
      )}

      {/* Scroll Section */}
      {shot.layout.kind === "single" ? (
        <Section title="Page Scroll">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-[var(--color-text)]">
                  Scroll Through Page
                </div>
                <div className="text-[11px] text-[var(--color-text-3)]">
                  Smooth vertical scroll across content stops
                </div>
              </div>
              <Switch
                aria-label="Scroll Through Page"
                checked={Boolean(shot.scroll?.enabled)}
                onCheckedChange={(enabled) => {
                  apply(
                    (draft) => {
                      const target = draft.shots.find((s) => s.id === shotId);
                      if (!target) return;
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

            {shot.scroll?.enabled && (
              <>
                {/* Feasibility warning */}
                {(() => {
                  const isSingle = shot.layout.kind === "single";
                  const singleLayout = isSingle ? shot.layout : null;
                  const currentAsset =
                    singleLayout && singleLayout.assetId
                      ? doc.assets.find((a) => a.id === singleLayout.assetId)
                      : null;
                  let scrollableFrames = 1;
                  if (currentAsset?.width && currentAsset?.height && singleLayout) {
                    const screenAspect = singleLayout.device === "phone" ? 0.4615 : 1.6;
                    const imgAspect = currentAsset.width / currentAsset.height;
                    scrollableFrames = Math.max(0, screenAspect / imgAspect - 1);
                  }
                  const minDur = minDurationFor(shot.scroll, scrollableFrames);
                  if (shot.duration < minDur) {
                    return (
                      <div className="p-2.5 rounded-md bg-[var(--color-raised)] border border-[var(--color-accent)]/30 flex items-start gap-2">
                        <Icon
                          icon={AlertCircle}
                          size={14}
                          className="text-[var(--color-accent)] shrink-0 mt-0.5"
                        />
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="text-[11px] text-[var(--color-text)]">
                            Needs {minDur.toFixed(1)}s to scroll comfortably at the 0.9 vh/s speed
                            limit.
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-6 text-[10px] px-2"
                            onClick={() => {
                              apply(
                                (draft) => {
                                  const target = draft.shots.find((s) => s.id === shotId);
                                  if (target) target.duration = Math.ceil(minDur);
                                },
                                { label: "Extend duration for scroll" },
                              );
                            }}
                          >
                            Extend to {Math.ceil(minDur)}s
                          </Button>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Stops Editor */}
                <Field label={`Scroll Stops (${shot.scroll.stops?.length ?? 0})`}>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5 p-2 bg-[var(--color-raised)] rounded-md border border-[var(--color-line)]">
                      {(shot.scroll.stops || [0]).map((stop, sIdx) => (
                        <div
                          key={sIdx}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--color-panel)] border border-[var(--color-line-strong)] text-[11px] font-mono text-[var(--color-text)]"
                        >
                          <span>{Math.round(stop * 100)}%</span>
                          {shot.scroll!.stops.length > 2 &&
                            sIdx > 0 &&
                            sIdx < shot.scroll!.stops.length - 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  apply((draft) => {
                                    const target = draft.shots.find((s) => s.id === shotId);
                                    if (target?.scroll) {
                                      target.scroll.stops = target.scroll.stops.filter(
                                        (_, i) => i !== sIdx,
                                      );
                                    }
                                  });
                                }}
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
                        className="flex-1 justify-center text-[11px]"
                        onClick={() => {
                          apply((draft) => {
                            const target = draft.shots.find((s) => s.id === shotId);
                            if (target?.scroll) {
                              const stops = [...(target.scroll.stops || [0, 1])];
                              stops.push(0.5);
                              target.scroll.stops = Array.from(new Set(stops)).sort(
                                (a, b) => a - b,
                              );
                            }
                          });
                        }}
                      >
                        + Add Stop
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1 justify-center text-[11px]"
                        onClick={() => {
                          apply((draft) => {
                            const target = draft.shots.find((s) => s.id === shotId);
                            if (target?.scroll) {
                              target.scroll.stops = [0, 0.33, 0.66, 1.0];
                            }
                          });
                        }}
                      >
                        Reset Stops
                      </Button>
                    </div>
                  </div>
                </Field>

                <Field label={`Hold Time (${shot.scroll.hold.toFixed(1)}s)`}>
                  <Slider
                    min={0.3}
                    max={2.0}
                    step={0.1}
                    value={shot.scroll.hold}
                    onChange={(val) =>
                      apply(
                        (draft) => {
                          const target = draft.shots.find((s) => s.id === shotId);
                          if (target?.scroll) target.scroll.hold = val;
                        },
                        { coalesceKey: `scroll-hold-${shotId}` },
                      )
                    }
                  />
                </Field>

                <Field label="Scroll Easing">
                  <Select
                    value={shot.scroll.easing}
                    onChange={(val) =>
                      apply((draft) => {
                        const target = draft.shots.find((s) => s.id === shotId);
                        if (target?.scroll) target.scroll.easing = val as EasingId;
                      })
                    }
                    options={[
                      { value: "smooth", label: "Smooth (Cubic In-Out)" },
                      { value: "gentle", label: "Gentle (Sine In-Out)" },
                      { value: "quintInOut", label: "Quint (Decisive)" },
                    ]}
                  />
                </Field>
              </>
            )}
          </div>
        </Section>
      ) : null}

      {/* Cursor Overlay Section */}
      {shot.layout.kind === "single" ? (
        <Section title="Cursor Overlay">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-[var(--color-text)]">Enable Cursor</div>
                <div className="text-[11px] text-[var(--color-text-3)]">
                  Simulate interactive pointer and click ripples
                </div>
              </div>
              <Switch
                aria-label="Enable Cursor"
                checked={Boolean(shot.cursor?.enabled)}
                onCheckedChange={(enabled) => {
                  apply(
                    (draft) => {
                      const target = draft.shots.find((s) => s.id === shotId);
                      if (!target) return;
                      if (enabled) {
                        target.cursor = {
                          enabled: true,
                          style: target.cursor?.style ?? "arrow",
                          keys:
                            target.cursor?.keys && target.cursor.keys.length > 0
                              ? target.cursor.keys
                              : [
                                  { t: 0.5, x: 0.35, y: 0.4 },
                                  { t: 1.5, x: 0.65, y: 0.6, click: true },
                                ],
                        };
                      } else if (target.cursor) {
                        target.cursor.enabled = false;
                      }
                    },
                    { label: enabled ? "Enable cursor" : "Disable cursor" },
                  );
                }}
              />
            </div>

            {shot.cursor?.enabled && (
              <>
                <Field label="Cursor Style">
                  <Select
                    value={shot.cursor.style}
                    onChange={(val) =>
                      apply((draft) => {
                        const target = draft.shots.find((s) => s.id === shotId);
                        if (target?.cursor) target.cursor.style = val as "arrow" | "pointer" | "dot";
                      })
                    }
                    options={[
                      { value: "arrow", label: "Vector Arrow (Desktop)" },
                      { value: "pointer", label: "Hand Pointer" },
                      { value: "dot", label: "Touch Dot (Mobile)" },
                    ]}
                  />
                </Field>

                <div className="p-2 rounded bg-[var(--color-raised)] text-[11px] text-[var(--color-text-2)] leading-relaxed">
                  Click on the mockup screen in the stage to record cursor path.{" "}
                  <strong className="text-[var(--color-text)]">Alt-click</strong> adds a click ripple.
                </div>

                <Field label={`Keyframes (${shot.cursor.keys?.length ?? 0})`}>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {(shot.cursor.keys || []).map((key, kIdx) => (
                      <div
                        key={kIdx}
                        className="flex items-center justify-between p-1.5 rounded bg-[var(--color-raised)] border border-[var(--color-line)] text-[11px]"
                      >
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="text-[var(--color-accent)]">{key.t.toFixed(1)}s</span>
                          <span className="text-[var(--color-text-3)]">
                            ({Math.round(key.x * 100)}%, {Math.round(key.y * 100)}%)
                          </span>
                          {key.click && (
                            <span className="px-1 py-0.2 rounded bg-[var(--color-accent)]/20 text-[var(--color-accent)] text-[9px] font-sans font-semibold">
                              Click
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            apply((draft) => {
                              const target = draft.shots.find((s) => s.id === shotId);
                              if (target?.cursor) {
                                target.cursor.keys = target.cursor.keys.filter((_, i) => i !== kIdx);
                              }
                            });
                          }}
                          className="text-[var(--color-text-3)] hover:text-[var(--color-danger)] p-0.5"
                        >
                          <Icon icon={Trash2} size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </Field>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1 justify-center text-[11px]"
                    onClick={() => {
                      apply((draft) => {
                        const target = draft.shots.find((s) => s.id === shotId);
                        if (target?.cursor) {
                          target.cursor.keys.push({
                            t: Number((target.duration * 0.5).toFixed(2)),
                            x: 0.5,
                            y: 0.5,
                          });
                          target.cursor.keys.sort((a, b) => a.t - b.t);
                        }
                      });
                    }}
                  >
                    + Add Key
                  </Button>
                  {(shot.cursor.keys?.length ?? 0) > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[11px] text-[var(--color-text-3)] hover:text-[var(--color-danger)]"
                      onClick={() => {
                        apply((draft) => {
                          const target = draft.shots.find((s) => s.id === shotId);
                          if (target?.cursor) target.cursor.keys = [];
                        });
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </Section>
      ) : null}

      {/* Animation & Transitions */}
      <Section title="Entrance & Transitions">
        <div className="space-y-3">
          <Field label="Entrance Animation">
            <Select
              value={shot.entrance}
              onChange={(val) =>
                apply(
                  (draft) => {
                    const target = draft.shots.find((s) => s.id === shotId);
                    if (target) target.entrance = val as Shot["entrance"];
                  },
                  { label: "Change entrance animation" },
                )
              }
              options={[
                { value: "none", label: "None (Immediate)" },
                { value: "rise", label: "Rise From Below" },
                { value: "scale", label: "Scale Up" },
                { value: "stagger", label: "Staggered Entrance" },
              ]}
            />
          </Field>

          <Field label="Transition In">
            <Select
              value={shot.transitionIn?.kind || "cut"}
              onChange={(val) =>
                apply(
                  (draft) => {
                    const target = draft.shots.find((s) => s.id === shotId);
                    if (target) {
                      target.transitionIn = {
                        kind: val as "cut" | "fade" | "blur" | "push" | "zoom" | "wipe",
                        duration: 0.5,
                        easing: "smooth",
                      };
                    }
                  },
                  { label: "Change shot transition" },
                )
              }
              options={[
                { value: "cut", label: "Direct Cut" },
                { value: "fade", label: "Fade Blend" },
                { value: "blur", label: "Blur Blend" },
                { value: "push", label: "Push Slide" },
                { value: "zoom", label: "Zoom Blend" },
              ]}
            />
          </Field>
        </div>
      </Section>

      {/* Text Layers */}
      <Section title={`Text Layers (${shot.texts.length})`}>
        <div className="space-y-2">
          {shot.texts.map((text) => (
            <div
              key={text.id}
              onClick={() => setSelection({ kind: "text", shotId, id: text.id })}
              className="p-2 rounded-md border border-[var(--color-line)] bg-[var(--color-raised)] hover:border-[var(--color-accent)] cursor-pointer flex items-center justify-between group transition-all"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Icon icon={Type} size={13} className="text-[var(--color-text-3)] shrink-0" />
                <span className="text-xs text-[var(--color-text)] truncate">{text.text || "Empty text"}</span>
              </div>
              <span className="text-[10px] text-[var(--color-text-3)] font-mono uppercase shrink-0">
                {text.role}
              </span>
            </div>
          ))}

          <Button
            size="sm"
            variant="secondary"
            onClick={handleAddText}
            className="w-full justify-center"
            icon={<Icon icon={Plus} size={14} />}
          >
            Add Text Layer
          </Button>
        </div>
      </Section>

      {/* Actions */}
      <div className="pt-2 flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          className="flex-1 justify-center"
          onClick={handleDuplicateShot}
          icon={<Icon icon={Copy} size={14} />}
        >
          Duplicate
        </Button>
        {doc.shots.length > 1 && (
          <Button
            size="sm"
            variant="danger"
            className="justify-center"
            onClick={handleDeleteShot}
            icon={<Icon icon={Trash2} size={14} />}
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  );
};
