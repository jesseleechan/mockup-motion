import React, { useState } from "react";
import { useEditorStore } from "../../state/store";
import { ColorField, Field, Section, SegmentedControl } from "../../ui";
import {
  backgroundColor,
  customBackgroundStyle,
  paletteBackground,
  presetToneOf,
  presetToneStyle,
  templateTones,
  type PresetTone,
} from "../../templates/looks";
import { currentTemplate } from "../template-actions";

type BackgroundChoice = PresetTone | "custom";

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <span
    aria-hidden
    className="block w-2.5 h-2.5 rounded-full border border-[var(--color-line-strong)]"
    style={{ background: color }}
  />
);

/**
 * One background control: the preset's own light fill, its dark fill, or a custom flat colour.
 * Light and Dark come from the template (`Template.tones`), Ash and Onyx without one.
 */
export const BackgroundSection: React.FC = () => {
  const doc = useEditorStore((s) => s.doc);
  const apply = useEditorStore((s) => s.apply);
  // Custom stays selected while the colour row is open, even before the colour changes.
  const [customOpen, setCustomOpen] = useState(false);

  const tones = templateTones(currentTemplate(doc));
  const tone = presetToneOf(doc.style, tones);
  const choice: BackgroundChoice = customOpen || !tone ? "custom" : tone;
  const current = backgroundColor(doc.style.background);

  const handleChoice = (next: BackgroundChoice) => {
    if (next === "custom") {
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    apply(
      (draft) => {
        Object.assign(draft.style, presetToneStyle(next, tones));
      },
      { label: next === "dark" ? "Use dark background" : "Use light background" },
    );
  };

  const handleCustomColor = (color: string) => {
    apply(
      (draft) => {
        Object.assign(draft.style, customBackgroundStyle(color));
      },
      { label: "Change background color", coalesceKey: "background-color" },
    );
  };

  return (
    <Section title="Background">
      <div className="space-y-3">
        <SegmentedControl<BackgroundChoice>
          aria-label="Background tone"
          className="flex w-full [&>button]:flex-1"
          value={choice}
          onChange={handleChoice}
          options={[
            {
              value: "light",
              label: "Light",
              icon: <Dot color={backgroundColor(paletteBackground(tones.light))} />,
            },
            {
              value: "dark",
              label: "Dark",
              icon: <Dot color={backgroundColor(paletteBackground(tones.dark))} />,
            },
            {
              value: "custom",
              label: "Custom",
              icon: <Dot color={choice === "custom" ? current : "#8E8E98"} />,
            },
          ]}
        />

        {choice === "custom" && (
          <Field label="Color">
            <div className="flex justify-end">
              <ColorField
                aria-label="Background color"
                value={current}
                onChange={handleCustomColor}
              />
            </div>
          </Field>
        )}
      </div>
    </Section>
  );
};
