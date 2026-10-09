import React from "react";
import { useEditorStore } from "../../state/store";
import { BUILTIN_PALETTES } from "../../doc/palettes";
import { CURATED_FONT_PAIRS } from "../../assets/fonts";
import { schedule } from "../../motion";
import { ColorField, Field, Section, SegmentedControl, Select, Slider, Switch } from "../../ui";
import type { BrowserChrome, DeviceFinish, ShadowPreset } from "../../doc/types";
import { BROWSER_CHROME_LABELS, DEVICE_FINISH_LABELS, SHADOW_LABELS, optionsFor } from "../labels";
import { presetToneOf, setPresetTone, type PresetTone } from "../../templates/looks";
import { currentTemplate } from "../template-actions";

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const tenths = Math.floor((sec % 1) * 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${tenths}`;
}

const SHADOW_ORDER: ShadowPreset[] = ["none", "soft", "medium", "dramatic"];
const CHROME_ORDER: BrowserChrome[] = ["standard", "minimal", "none"];
const FINISH_ORDER: DeviceFinish[] = ["silver", "graphite", "black", "sand"];

// The aspect ratio lives in the top bar only (F08).
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

  // The slider and Frames presets switch between their flat light and dark fills in one click
  // (Ash or Onyx). Other documents keep the palette grid only.
  const hasToneSwitch = currentTemplate(doc)?.toneSwitch === true;
  const tone = presetToneOf(doc.style);

  const handleTone = (next: PresetTone) => {
    apply(
      (draft) => {
        setPresetTone(draft.style, next);
      },
      { label: next === "dark" ? "Use dark background" : "Use light background" },
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
      <Section title="Composition">
        <div className="space-y-3">
          <Field label="Duration">
            <span className="block text-right text-xs font-mono text-[var(--color-text)]">
              {formatTime(total)}
            </span>
          </Field>

          <Field label="Loop">
            <div className="flex justify-end">
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
          </Field>
        </div>
      </Section>

      <Section title="Background">
        <div className="space-y-3">
          {hasToneSwitch && (
            <Field label="Tone">
              <div className="flex justify-end">
                <SegmentedControl<PresetTone | "">
                  aria-label="Background tone"
                  size="sm"
                  // Any other background selects neither, until one is picked.
                  value={tone ?? ""}
                  onChange={(next) => {
                    if (next) handleTone(next);
                  }}
                  options={[
                    { value: "light", label: "Light" },
                    { value: "dark", label: "Dark" },
                  ]}
                />
              </div>
            </Field>
          )}

          <Field label="Palette" stacked>
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
          </Field>

          <Field label="Color">
            <ColorField
              aria-label="Background color"
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

      <Section title="Frame and effects">
        <div className="space-y-3">
          <Field label="Shadow">
            <Select
              aria-label="Shadow"
              value={doc.style.shadow}
              onChange={(val) =>
                apply(
                  (draft) => {
                    draft.style.shadow = val;
                  },
                  { label: "Change shadow preset" },
                )
              }
              options={optionsFor(SHADOW_LABELS, SHADOW_ORDER)}
            />
          </Field>

          {hasDeviceShot && (
            <Field label="Device finish">
              <Select
                aria-label="Device finish"
                value={doc.style.deviceFinish}
                onChange={(val) =>
                  apply(
                    (draft) => {
                      draft.style.deviceFinish = val;
                    },
                    { label: "Change device finish" },
                  )
                }
                options={optionsFor(DEVICE_FINISH_LABELS, FINISH_ORDER)}
              />
            </Field>
          )}

          {hasBrowserShot && (
            <>
              <Field label="Browser chrome">
                <Select
                  aria-label="Browser chrome"
                  value={doc.style.browserChrome}
                  onChange={(val) =>
                    apply(
                      (draft) => {
                        draft.style.browserChrome = val;
                      },
                      { label: "Change browser chrome" },
                    )
                  }
                  options={optionsFor(BROWSER_CHROME_LABELS, CHROME_ORDER)}
                />
              </Field>

              {doc.style.browserChrome !== "none" && (
                <Field label="URL">
                  <input
                    type="text"
                    aria-label="Browser URL"
                    placeholder="example.com"
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

          <Field label="Grain" value={`${Math.round(doc.style.grain * 100)}%`}>
            <Slider
              aria-label="Grain"
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

          <Field label="Vignette" value={`${Math.round(doc.style.vignette * 100)}%`}>
            <Slider
              aria-label="Vignette"
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

      <Section title="Typography">
        <div className="space-y-3">
          <Field label="Font pair">
            <Select
              aria-label="Font pair"
              value={
                CURATED_FONT_PAIRS.find((p) => p.display.family === doc.style.fonts.display.family)
                  ?.id || "inter"
              }
              onChange={handleFontPairChange}
              options={CURATED_FONT_PAIRS.map((p) => ({
                value: p.id,
                label: p.name,
              }))}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded bg-[var(--color-raised)] border border-[var(--color-line)] min-w-0">
              <span className="text-[10px] text-[var(--color-text-3)] block mb-1">Display</span>
              <span data-truncate className="font-semibold truncate block">
                {doc.style.fonts.display.family}
              </span>
            </div>
            <div className="p-2 rounded bg-[var(--color-raised)] border border-[var(--color-line)] min-w-0">
              <span className="text-[10px] text-[var(--color-text-3)] block mb-1">Body</span>
              <span data-truncate className="font-normal truncate block">
                {doc.style.fonts.body.family}
              </span>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
};
