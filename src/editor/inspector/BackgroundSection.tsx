import React, { useState } from "react";
import { useEditorStore } from "../../state/store";
import { ColorField, Field, Section, SegmentedControl } from "../../ui";
import {
  backgroundChoice,
  backgroundColor,
  backgroundKey,
  customBackgroundStyle,
  paletteBackground,
  templateTones,
  toneFillStyle,
  type BackgroundChoice,
} from "../../templates/looks";
import { currentTemplate } from "../template-actions";

// Custom's dot before a colour is chosen: a muted hue wheel, the usual sign for "any colour".
const ANY_COLOR = "conic-gradient(#E99AB0, #9BB5E9, #9FDDB6, #E9D79A, #E99AB0)";

// The ring uses the secondary text colour, so a near-black fill such as Onyx still reads as a
// dot on the dark panel, and a near-white one on the light panel.
const Dot: React.FC<{ fill: string }> = ({ fill }) => (
  <span
    aria-hidden
    className="block w-2.5 h-2.5 rounded-full border border-[var(--color-text-3)]"
    style={{ background: fill }}
  />
);

/**
 * One background control: the preset's own light fill, its dark fill, or a custom flat colour.
 * Light and Dark come from the template (`Template.tones`), Ash and Onyx without one.
 */
export const BackgroundSection: React.FC = () => {
  const doc = useEditorStore((s) => s.doc);
  const apply = useEditorStore((s) => s.apply);
  // The background Custom was opened on, so Custom stays selected before the colour changes
  // (backgroundChoice). Any other change to the background selects from the document again.
  const [customFor, setCustomFor] = useState<string | null>(null);

  const tones = templateTones(currentTemplate(doc));
  const choice = backgroundChoice(doc.style, tones, customFor);
  const current = backgroundColor(doc.style.background);

  const handleChoice = (next: BackgroundChoice) => {
    if (next === "custom") {
      setCustomFor(backgroundKey(doc.style.background));
      return;
    }
    setCustomFor(null);
    apply(
      (draft) => {
        Object.assign(draft.style, toneFillStyle(next, tones));
      },
      { label: next === "dark" ? "Use dark background" : "Use light background" },
    );
  };

  const handleCustomColor = (color: string) => {
    const fill = customBackgroundStyle(color);
    setCustomFor(backgroundKey(fill.background));
    apply(
      (draft) => {
        Object.assign(draft.style, fill);
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
              icon: <Dot fill={backgroundColor(paletteBackground(tones.light))} />,
            },
            {
              value: "dark",
              label: "Dark",
              icon: <Dot fill={backgroundColor(paletteBackground(tones.dark))} />,
            },
            {
              value: "custom",
              label: "Custom",
              icon: <Dot fill={choice === "custom" ? current : ANY_COLOR} />,
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
