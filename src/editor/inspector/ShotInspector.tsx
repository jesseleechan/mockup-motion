import React from "react";
import { useEditorStore } from "../../state/store";
import { useUIStore } from "../../state/ui-store";
import type { CameraPresetId, DeviceKind, EasingId, Shot } from "../../doc/types";
import { Button, Field, Icon, Section, Select, Slider } from "../../ui";
import { Copy, Plus, Trash2, Type } from "lucide-react";

type LayoutKind = "single" | "title";

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
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleLayoutKindChange("single")}
                className={`py-1.5 px-3 rounded-md text-xs font-medium border transition-colors ${
                  !isTitleLayout
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                    : "border-[var(--color-line)] text-[var(--color-text-2)] hover:text-[var(--color-text)]"
                }`}
              >
                Device Mockup
              </button>
              <button
                type="button"
                onClick={() => handleLayoutKindChange("title")}
                className={`py-1.5 px-3 rounded-md text-xs font-medium border transition-colors ${
                  isTitleLayout
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                    : "border-[var(--color-line)] text-[var(--color-text-2)] hover:text-[var(--color-text)]"
                }`}
              >
                Title Card
              </button>
            </div>
          </Field>

          {!isTitleLayout && shot.layout.kind === "single" && (
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

              <Field label="Screenshot Asset">
                <Select
                  value={shot.layout.assetId || ""}
                  onChange={handleAssetChange}
                  options={[
                    { value: "", label: "No screenshot (empty frame)" },
                    ...doc.assets.map((a) => ({
                      value: a.id,
                      label: a.name,
                    })),
                  ]}
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
