import React from "react";
import { useEditorStore } from "../../state/store";
import { schedule } from "../../motion";
import { Field, Section, Select, Slider, Switch } from "../../ui";
import type { BrowserChrome, ShadowPreset } from "../../doc/types";
import { BROWSER_CHROME_LABELS, SHADOW_LABELS, optionsFor } from "../labels";
import { BackgroundSection } from "./BackgroundSection";

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const tenths = Math.floor((sec % 1) * 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${tenths}`;
}

const SHADOW_ORDER: ShadowPreset[] = ["none", "soft", "medium", "dramatic"];
const CHROME_ORDER: BrowserChrome[] = ["standard", "none"];

// The aspect ratio lives in the top bar only (F08).
export const VideoInspector: React.FC = () => {
  const doc = useEditorStore((s) => s.doc);
  const apply = useEditorStore((s) => s.apply);

  const { total } = schedule(doc);

  // Check if any shots use browser or 3D devices
  const hasBrowserShot = doc.shots.some(
    (s) => s.layout.kind === "single" && s.layout.device === "browser",
  );

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

      <BackgroundSection />

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
    </div>
  );
};
