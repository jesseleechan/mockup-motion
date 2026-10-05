import React from "react";
import { useEditorStore } from "../../state/store";
import { BUILTIN_PALETTES } from "../../doc/palettes";
import { CURATED_FONT_PAIRS } from "../../assets/fonts";
import { schedule } from "../../motion";
import {
  ColorField,
  Field,
  Section,
  SegmentedControl,
  Select,
  Slider,
  Switch,
} from "../../ui";
import type { Aspect, DeviceFinish, ShadowPreset } from "../../doc/types";

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const tenths = Math.floor((sec % 1) * 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${tenths}`;
}

export const VideoInspector: React.FC = () => {
  const doc = useEditorStore((s) => s.doc);
  const apply = useEditorStore((s) => s.apply);

  const { total } = schedule(doc);

  // Check if any shots use browser or 3D devices
  const hasBrowserShot = doc.shots.some(
    (s) => s.layout.kind === "single" && s.layout.device === "browser",
  );
  const hasDeviceShot = doc.shots.some(
    (s) => s.layout.kind === "single" && s.layout.device !== "card",
  );

  const handleApplyPalette = (paletteId: string) => {
    const p = BUILTIN_PALETTES.find((pal) => pal.id === paletteId);
    if (!p) return;
    apply(
      (draft) => {
        draft.style.background = p.background;
        draft.style.frameAppearance = p.frameAppearance;
        draft.style.textColor = p.textColor;
      },
      { label: `Apply ${p.name} palette` },
    );
  };

  const handleCustomBgColor = (color: string) => {
    apply(
      (draft) => {
        draft.style.background = { kind: "solid", color };
      },
      { label: "Change background color" },
    );
  };

  const handleFontPairChange = (pairId: string) => {
    const pair = CURATED_FONT_PAIRS.find((p) => p.id === pairId);
    if (!pair) return;
    apply(
      (draft) => {
        draft.style.fonts.display = pair.display;
        draft.style.fonts.body = pair.body;
      },
      { label: `Apply font pair ${pair.name}` },
    );
  };

  // Determine current active palette ID if matching
  const currentPalette = BUILTIN_PALETTES.find((p) => {
    if (p.background.kind === "gradient" && doc.style.background.kind === "gradient") {
      return (
        p.background.stops[0] === doc.style.background.stops[0] &&
        p.background.stops[1] === doc.style.background.stops[1]
      );
    }
    return false;
  });

  return (
    <div className="space-y-4">
      {/* Composition */}
      <Section title="Composition">
        <div className="space-y-3">
          <Field label="Aspect Ratio">
            <SegmentedControl
              value={doc.aspect}
              onChange={(val) =>
                apply(
                  (draft) => {
                    draft.aspect = val as Aspect;
                  },
                  { label: `Change aspect to ${val}` },
                )
              }
              options={[
                { value: "16:9", label: "16:9" },
                { value: "9:16", label: "9:16" },
                { value: "1:1", label: "1:1" },
                { value: "4:5", label: "4:5" },
                { value: "4:3", label: "4:3" },
              ]}
            />
          </Field>

          <div className="flex items-center justify-between text-xs py-1">
            <span className="text-[var(--color-text-2)]">Total Duration</span>
            <span className="font-mono text-[var(--color-text)]">{formatTime(total)}</span>
          </div>

          <div className="flex items-center justify-between text-xs py-1">
            <span className="text-[var(--color-text-2)]">Loop Playback</span>
            <Switch
              aria-label="Loop playback"
              checked={doc.loop}
              onCheckedChange={(val) =>
                apply(
                  (draft) => {
                    draft.loop = val;
                  },
                  { label: "Toggle loop" },
                )
              }
            />
          </div>
        </div>
      </Section>

      {/* Palettes & Style */}
      <Section title="Background & Palette">
        <div className="space-y-3">
          <label className="text-[11px] font-medium text-[var(--color-text-2)] block">
            Curated Palettes
          </label>
          <div className="grid grid-cols-4 gap-2">
            {BUILTIN_PALETTES.map((p) => {
              const isActive = currentPalette?.id === p.id;
              let bgStyle = "";
              if (p.background.kind === "solid") {
                bgStyle = p.background.color;
              } else if (p.background.kind === "gradient") {
                bgStyle = `linear-gradient(${p.background.angle}deg, ${p.background.stops.join(", ")})`;
              } else if (p.background.kind === "mesh") {
                bgStyle = `radial-gradient(circle at 50% 50%, ${p.background.colors[0]}, ${p.background.colors[1]})`;
              }

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleApplyPalette(p.id)}
                  title={p.name}
                  className={`group relative h-9 rounded-md overflow-hidden border transition-all ${
                    isActive
                      ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30 scale-102 shadow-xs"
                      : "border-[var(--color-line)] hover:border-[var(--color-line-strong)]"
                  }`}
                  style={{ background: bgStyle }}
                >
                  <span className="sr-only">{p.name}</span>
                </button>
              );
            })}
          </div>

          <Field label="Custom Background Color">
            <ColorField
              value={
                doc.style.background.kind === "solid"
                  ? doc.style.background.color
                  : doc.style.background.kind === "gradient"
                    ? doc.style.background.stops[0]
                    : "#F1EDE6"
              }
              onChange={handleCustomBgColor}
            />
          </Field>
        </div>
      </Section>

      {/* Appearance & Post */}
      <Section title="Frame & Post-Processing">
        <div className="space-y-3">
          <Field label="Shadow Preset">
            <Select
              value={doc.style.shadow}
              onChange={(val) =>
                apply(
                  (draft) => {
                    draft.style.shadow = val as ShadowPreset;
                  },
                  { label: "Change shadow preset" },
                )
              }
              options={[
                { value: "none", label: "None" },
                { value: "soft", label: "Soft Gaussian" },
                { value: "medium", label: "Medium Depth" },
                { value: "dramatic", label: "Dramatic Contact" },
              ]}
            />
          </Field>

          {hasDeviceShot && (
            <Field label="Device Finish">
              <Select
                value={doc.style.deviceFinish}
                onChange={(val) =>
                  apply(
                    (draft) => {
                      draft.style.deviceFinish = val as DeviceFinish;
                    },
                    { label: "Change device finish" },
                  )
                }
                options={[
                  { value: "silver", label: "Silver" },
                  { value: "graphite", label: "Graphite" },
                  { value: "black", label: "Space Black" },
                  { value: "sand", label: "Starlight Sand" },
                ]}
              />
            </Field>
          )}

          {hasBrowserShot && (
            <>
              <Field label="Browser Chrome">
                <Select
                  value={doc.style.browserChrome}
                  onChange={(val) =>
                    apply(
                      (draft) => {
                        draft.style.browserChrome = val as "none" | "standard" | "minimal";
                      },
                      { label: "Change browser chrome" },
                    )
                  }
                  options={[
                    { value: "none", label: "None" },
                    { value: "standard", label: "Standard Desktop Chrome" },
                    { value: "minimal", label: "Minimal URL Pill" },
                  ]}
                />
              </Field>

              {doc.style.browserChrome !== "none" && (
                <Field label="Browser URL">
                  <input
                    type="text"
                    placeholder="https://example.com"
                    value={doc.style.browserUrl || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      apply(
                        (draft) => {
                          draft.style.browserUrl = val;
                        },
                        { coalesceKey: "browser-url" },
                      );
                    }}
                    className="w-full bg-[var(--color-raised)] border border-[var(--color-line)] px-2.5 py-1.5 text-xs text-[var(--color-text)] rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] font-mono"
                  />
                </Field>
              )}
            </>
          )}

          <Field label={`Film Grain (${Math.round(doc.style.grain * 100)}%)`}>
            <Slider
              min={0}
              max={100}
              step={1}
              value={Math.round(doc.style.grain * 100)}
              onChange={(val) =>
                apply(
                  (draft) => {
                    draft.style.grain = val / 100;
                  },
                  { coalesceKey: "grain" },
                )
              }
            />
          </Field>

          <Field label={`Vignette (${Math.round(doc.style.vignette * 100)}%)`}>
            <Slider
              min={0}
              max={100}
              step={1}
              value={Math.round(doc.style.vignette * 100)}
              onChange={(val) =>
                apply(
                  (draft) => {
                    draft.style.vignette = val / 100;
                  },
                  { coalesceKey: "vignette" },
                )
              }
            />
          </Field>
        </div>
      </Section>

      {/* Typography */}
      <Section title="Typography">
        <div className="space-y-3">
          <Field label="Curated Font Pair">
            <Select
              value={
                CURATED_FONT_PAIRS.find(
                  (p) => p.display.family === doc.style.fonts.display.family,
                )?.id || "inter"
              }
              onChange={handleFontPairChange}
              options={CURATED_FONT_PAIRS.map((p) => ({
                value: p.id,
                label: p.name,
              }))}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded bg-[var(--color-raised)] border border-[var(--color-line)]">
              <span className="text-[10px] text-[var(--color-text-3)] block mb-1">Display</span>
              <span className="font-semibold truncate block">{doc.style.fonts.display.family}</span>
            </div>
            <div className="p-2 rounded bg-[var(--color-raised)] border border-[var(--color-line)]">
              <span className="text-[10px] text-[var(--color-text-3)] block mb-1">Body</span>
              <span className="font-normal truncate block">{doc.style.fonts.body.family}</span>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
};
