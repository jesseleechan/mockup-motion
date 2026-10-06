import React from "react";
import { useEditorStore } from "../../state/store";
import { useUIStore } from "../../state/ui-store";
import type { Anchor, TextAnimId, TextLayer } from "../../doc/types";
import {
  Button,
  ColorField,
  Field,
  Icon,
  Section,
  SegmentedControl,
  Select,
  Slider,
  Switch,
} from "../../ui";
import { ArrowLeft, Trash2 } from "lucide-react";
import { ANCHOR_LABELS, TEXT_ANIMATION_LABELS, TEXT_ROLE_LABELS, optionsFor } from "../labels";

interface TextInspectorProps {
  shotId: string;
  textId: string;
}

// Row-major 3×3 grid; the cell glyphs are compact, the full names are in the tooltip.
const ANCHORS: { id: Anchor; glyph: string }[] = [
  { id: "top-left", glyph: "TL" },
  { id: "top", glyph: "TC" },
  { id: "top-right", glyph: "TR" },
  { id: "left", glyph: "ML" },
  { id: "center", glyph: "MC" },
  { id: "right", glyph: "MR" },
  { id: "bottom-left", glyph: "BL" },
  { id: "bottom", glyph: "BC" },
  { id: "bottom-right", glyph: "BR" },
];

const TEXT_ANIMATIONS: TextAnimId[] = ["fadeUp", "maskReveal", "blurIn", "typewriter"];

export const TextInspector: React.FC<TextInspectorProps> = ({ shotId, textId }) => {
  const doc = useEditorStore((s) => s.doc);
  const apply = useEditorStore((s) => s.apply);
  const setSelection = useUIStore((s) => s.setSelection);

  const shot = doc.shots.find((s) => s.id === shotId);
  const text = shot?.texts.find((t) => t.id === textId);

  if (!shot || !text) {
    return (
      <div className="p-4 text-xs text-[var(--color-text-3)] text-center">
        Selected text layer not found.
      </div>
    );
  }

  const updateText = (
    mutate: (target: TextLayer) => void,
    options?: { label?: string; coalesceKey?: string },
  ) =>
    apply((draft) => {
      const targetShot = draft.shots.find((s) => s.id === shotId);
      const targetText = targetShot?.texts.find((t) => t.id === textId);
      if (targetText) mutate(targetText);
    }, options);

  const handleDeleteText = () => {
    apply(
      (draft) => {
        const targetShot = draft.shots.find((s) => s.id === shotId);
        if (targetShot) {
          targetShot.texts = targetShot.texts.filter((t) => t.id !== textId);
        }
      },
      { label: "Delete text layer" },
    );
    setSelection({ kind: "shot", id: shotId });
  };

  const animations = TEXT_ANIMATIONS.includes(text.animation)
    ? TEXT_ANIMATIONS
    : [...TEXT_ANIMATIONS, text.animation];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-1 border-b border-[var(--color-line)]">
        <button
          type="button"
          aria-label="Back to shot"
          onClick={() => setSelection({ kind: "shot", id: shotId })}
          className="p-1 -ml-1 text-[var(--color-text-3)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] rounded transition-colors"
        >
          <Icon icon={ArrowLeft} size={15} />
        </button>
        <span className="text-xs font-semibold text-[var(--color-text)]">Text layer</span>
      </div>

      <Section title="Content">
        <div className="space-y-3">
          <Field label="Text" stacked>
            <textarea
              aria-label="Text"
              rows={3}
              value={text.text}
              onChange={(e) => {
                const val = e.target.value;
                updateText(
                  (target) => {
                    target.text = val;
                  },
                  { coalesceKey: `text-content-${textId}` },
                );
              }}
              className="w-full bg-[var(--color-raised)] border border-[var(--color-line)] px-2.5 py-1.5 text-xs text-[var(--color-text)] rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] resize-y leading-relaxed"
            />
          </Field>

          <Field label="Role">
            <Select
              aria-label="Role"
              value={text.role}
              onChange={(role) =>
                updateText(
                  (target) => {
                    target.role = role;
                  },
                  { label: "Change text role" },
                )
              }
              options={optionsFor(TEXT_ROLE_LABELS)}
            />
          </Field>

          <Field label="Font">
            <Select
              aria-label="Font"
              value={text.font}
              onChange={(font) =>
                updateText(
                  (target) => {
                    target.font = font;
                  },
                  { label: "Change text font" },
                )
              }
              options={[
                { value: "display", label: "Display" },
                { value: "body", label: "Body" },
              ]}
            />
          </Field>

          <Field label="Size" value={text.size.toFixed(1)}>
            <Slider
              aria-label="Size"
              min={1.0}
              max={10.0}
              step={0.5}
              value={text.size}
              onChange={(val) =>
                updateText(
                  (target) => {
                    target.size = val;
                  },
                  { coalesceKey: `text-size-${textId}` },
                )
              }
            />
          </Field>
        </div>
      </Section>

      <Section title="Position">
        <div className="space-y-3">
          <Field label="Anchor">
            <div className="grid grid-cols-3 gap-1.5 w-fit bg-[var(--color-raised)] p-2 rounded-lg border border-[var(--color-line)]">
              {ANCHORS.map((a) => {
                const isActive = text.anchor === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    title={ANCHOR_LABELS[a.id]}
                    aria-label={ANCHOR_LABELS[a.id]}
                    aria-pressed={isActive}
                    onClick={() =>
                      updateText(
                        (target) => {
                          target.anchor = a.id;
                        },
                        { label: `Move text to ${ANCHOR_LABELS[a.id].toLowerCase()}` },
                      )
                    }
                    className={`w-9 h-7 rounded text-[10px] font-mono font-medium flex items-center justify-center transition-colors ${
                      isActive
                        ? "bg-[var(--color-accent)] text-white shadow-xs"
                        : "bg-[var(--color-panel)] text-[var(--color-text-3)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    {a.glyph}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Alignment" stacked>
            <SegmentedControl
              aria-label="Alignment"
              value={text.align}
              onChange={(align) =>
                updateText(
                  (target) => {
                    target.align = align;
                  },
                  { label: "Change text alignment" },
                )
              }
              options={[
                { value: "left", label: "Left" },
                { value: "center", label: "Center" },
                { value: "right", label: "Right" },
              ]}
            />
          </Field>

          <Field label="Auto color">
            <div className="flex justify-end">
              <Switch
                aria-label="Auto color"
                checked={!text.color}
                onCheckedChange={(auto) =>
                  updateText(
                    (target) => {
                      target.color = auto ? "" : "#FFFFFF";
                    },
                    { label: "Toggle auto-contrast text color" },
                  )
                }
              />
            </div>
          </Field>

          {text.color && (
            <Field label="Color">
              <ColorField
                aria-label="Text color"
                value={text.color}
                onChange={(col) =>
                  updateText(
                    (target) => {
                      target.color = col;
                    },
                    { coalesceKey: `text-color-${textId}` },
                  )
                }
              />
            </Field>
          )}
        </div>
      </Section>

      <Section title="Animation">
        <div className="space-y-3">
          <Field label="Reveal">
            <Select
              aria-label="Reveal"
              value={text.animation}
              onChange={(animation) =>
                updateText(
                  (target) => {
                    target.animation = animation;
                  },
                  { label: "Change text animation" },
                )
              }
              options={optionsFor(TEXT_ANIMATION_LABELS, animations)}
            />
          </Field>

          <Field label="Delay" value={`${text.delay.toFixed(1)} s`}>
            <Slider
              aria-label="Delay"
              min={0}
              max={3}
              step={0.1}
              value={text.delay}
              onChange={(val) =>
                updateText(
                  (target) => {
                    target.delay = val;
                  },
                  { coalesceKey: `text-delay-${textId}` },
                )
              }
            />
          </Field>
        </div>
      </Section>

      <div className="pt-2">
        <Button
          size="sm"
          variant="danger"
          className="w-full"
          onClick={handleDeleteText}
          icon={<Icon icon={Trash2} size={14} />}
        >
          Delete text
        </Button>
      </div>
    </div>
  );
};
