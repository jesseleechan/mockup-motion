import React, { useState } from "react";
import { useEditorStore } from "../../state/store";
import { schedule } from "../../motion";
import { Field, Input, Section, Select, SliderRow, Switch } from "../../ui";
import type { BrowserChrome, ShadowPreset } from "../../doc/types";
import { BROWSER_CHROME_LABELS, SHADOW_LABELS, optionsFor } from "../labels";
import { BackgroundSection } from "./BackgroundSection";
import { frameEffectsFor, type KeptEffects } from "./frame-effects";
import { backgroundKey } from "../../templates/looks";

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

  // A grain or vignette slider shown for this fill stays while it is turned down to 0, until the
  // background changes (keyed like BackgroundSection's Custom).
  const fill = backgroundKey(doc.style.background);
  const [kept, setKept] = useState<KeptEffects & { fill: string }>({ fill });
  const effects = frameEffectsFor(doc, kept.fill === fill ? kept : {});
  // Updated during render (React's "adjust state when a prop changes"); it settles in one pass.
  if (kept.fill !== fill || kept.grain !== effects.grain || kept.vignette !== effects.vignette) {
    setKept({ fill, grain: effects.grain, vignette: effects.vignette });
  }

  return (
    <>
      <Section title="Composition">
        <Field label="Duration">
          <span className="block text-right font-num text-[12px] tabular-nums text-text">
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
      </Section>

      <BackgroundSection />

      <Section title="Frame and effects">
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

        {effects.browserChrome && (
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
        )}

        {effects.browserUrl && (
          <Field label="URL">
            <Input
              numeric
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
            />
          </Field>
        )}

        {effects.grain && (
          <SliderRow
            label="Grain"
            output={`${Math.round(doc.style.grain * 100)}%`}
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
        )}

        {effects.vignette && (
          <SliderRow
            label="Vignette"
            output={`${Math.round(doc.style.vignette * 100)}%`}
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
        )}
      </Section>
    </>
  );
};
