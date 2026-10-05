import React from "react";
import { useEditorStore } from "../../state/store";
import { useUIStore } from "../../state/ui-store";
import type { Anchor, TextAnimId, TextLayer } from "../../doc/types";
import { Button, ColorField, Field, Icon, Section, SegmentedControl, Select, Slider, Switch } from "../../ui";
import { ArrowLeft, Trash2 } from "lucide-react";

interface TextInspectorProps {
  shotId: string;
  textId: string;
}

const ANCHORS: { id: Anchor; label: string; row: number; col: number }[] = [
  { id: "top-left", label: "TL", row: 0, col: 0 },
  { id: "top", label: "TC", row: 0, col: 1 },
  { id: "top-right", label: "TR", row: 0, col: 2 },
  { id: "left", label: "ML", row: 1, col: 0 },
  { id: "center", label: "MC", row: 1, col: 1 },
  { id: "right", label: "MR", row: 1, col: 2 },
  { id: "bottom-left", label: "BL", row: 2, col: 0 },
  { id: "bottom", label: "BC", row: 2, col: 1 },
  { id: "bottom-right", label: "BR", row: 2, col: 2 },
];

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

  return (
    <div className="space-y-4">
      {/* Back to shot header */}
      <div className="flex items-center gap-2 pb-1 border-b border-[var(--color-line)]">
        <button
          type="button"
          onClick={() => setSelection({ kind: "shot", id: shotId })}
          className="p-1 -ml-1 text-[var(--color-text-3)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] rounded transition-colors"
        >
          <Icon icon={ArrowLeft} size={15} />
        </button>
        <span className="text-xs font-semibold text-[var(--color-text)]">Edit Text Layer</span>
      </div>

      {/* Content */}
      <Section title="Text Content">
        <div className="space-y-3">
          <Field label="Text">
            <textarea
              rows={3}
              value={text.text}
              onChange={(e) => {
                const val = e.target.value;
                apply(
                  (draft) => {
                    const targetShot = draft.shots.find((s) => s.id === shotId);
                    const targetText = targetShot?.texts.find((t) => t.id === textId);
                    if (targetText) targetText.text = val;
                  },
                  { coalesceKey: `text-content-${textId}` },
                );
              }}
              className="w-full bg-[var(--color-raised)] border border-[var(--color-line)] px-2.5 py-1.5 text-xs text-[var(--color-text)] rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] resize-y leading-relaxed"
            />
          </Field>

          <Field label="Role">
            <Select
              value={text.role}
              onChange={(val) =>
                apply(
                  (draft) => {
                    const targetShot = draft.shots.find((s) => s.id === shotId);
                    const targetText = targetShot?.texts.find((t) => t.id === textId);
                    if (targetText) targetText.role = val as TextLayer["role"];
                  },
                  { label: "Change text role" },
                )
              }
              options={[
                { value: "title", label: "Title (Display)" },
                { value: "subtitle", label: "Subtitle" },
                { value: "caption", label: "Caption / Footnote" },
              ]}
            />
          </Field>

          <Field label="Font Style">
            <Select
              value={text.font}
              onChange={(val) =>
                apply(
                  (draft) => {
                    const targetShot = draft.shots.find((s) => s.id === shotId);
                    const targetText = targetShot?.texts.find((t) => t.id === textId);
                    if (targetText) targetText.font = val as "display" | "body";
                  },
                  { label: "Change text font" },
                )
              }
              options={[
                { value: "display", label: `Display (${doc.style.fonts.display.family})` },
                { value: "body", label: `Body (${doc.style.fonts.body.family})` },
              ]}
            />
          </Field>

          <Field label={`Font Size (${text.size.toFixed(1)})`}>
            <Slider
              min={1.0}
              max={10.0}
              step={0.5}
              value={text.size}
              onChange={(val) =>
                apply(
                  (draft) => {
                    const targetShot = draft.shots.find((s) => s.id === shotId);
                    const targetText = targetShot?.texts.find((t) => t.id === textId);
                    if (targetText) targetText.size = val;
                  },
                  { coalesceKey: `text-size-${textId}` },
                )
              }
            />
          </Field>
        </div>
      </Section>

      {/* Placement & Alignment */}
      <Section title="Layout & Anchor">
        <div className="space-y-3">
          <Field label="Screen Anchor">
            <div className="grid grid-cols-3 gap-1.5 w-36 mx-auto bg-[var(--color-raised)] p-2 rounded-lg border border-[var(--color-line)]">
              {ANCHORS.map((a) => {
                const isActive = text.anchor === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    title={a.id}
                    onClick={() =>
                      apply(
                        (draft) => {
                          const targetShot = draft.shots.find((s) => s.id === shotId);
                          const targetText = targetShot?.texts.find((t) => t.id === textId);
                          if (targetText) targetText.anchor = a.id;
                        },
                        { label: `Change text anchor to ${a.id}` },
                      )
                    }
                    className={`w-9 h-7 rounded text-[10px] font-mono font-medium flex items-center justify-center transition-colors ${
                      isActive
                        ? "bg-[var(--color-accent)] text-white shadow-xs"
                        : "bg-[var(--color-panel)] text-[var(--color-text-3)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Text Alignment">
            <SegmentedControl
              value={text.align}
              onChange={(val) =>
                apply(
                  (draft) => {
                    const targetShot = draft.shots.find((s) => s.id === shotId);
                    const targetText = targetShot?.texts.find((t) => t.id === textId);
                    if (targetText) targetText.align = val as "left" | "center" | "right";
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

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--color-text-2)]">Auto Contrast Color</span>
              <Switch
                checked={!text.color}
                onCheckedChange={(auto) =>
                  apply(
                    (draft) => {
                      const targetShot = draft.shots.find((s) => s.id === shotId);
                      const targetText = targetShot?.texts.find((t) => t.id === textId);
                      if (targetText) targetText.color = auto ? "" : "#FFFFFF";
                    },
                    { label: "Toggle auto-contrast text color" },
                  )
                }
              />
            </div>

            {text.color && (
              <Field label="Custom Color">
                <ColorField
                  value={text.color}
                  onChange={(col) =>
                    apply(
                      (draft) => {
                        const targetShot = draft.shots.find((s) => s.id === shotId);
                        const targetText = targetShot?.texts.find((t) => t.id === textId);
                        if (targetText) targetText.color = col;
                      },
                      { coalesceKey: `text-color-${textId}` },
                    )
                  }
                />
              </Field>
            )}
          </div>
        </div>
      </Section>

      {/* Animation */}
      <Section title="Text Animation">
        <div className="space-y-3">
          <Field label="Reveal Style">
            <Select
              value={text.animation}
              onChange={(val) =>
                apply(
                  (draft) => {
                    const targetShot = draft.shots.find((s) => s.id === shotId);
                    const targetText = targetShot?.texts.find((t) => t.id === textId);
                    if (targetText) targetText.animation = val as TextAnimId;
                  },
                  { label: "Change text animation" },
                )
              }
              options={[
                { value: "fadeUp", label: "Fade Up" },
                { value: "maskReveal", label: "Kinetic Mask Reveal" },
                { value: "blurIn", label: "Gaussian Blur In" },
                { value: "typewriter", label: "Typewriter Step" },
              ]}
            />
          </Field>

          <Field label={`Entrance Delay (${text.delay.toFixed(1)}s)`}>
            <Slider
              min={0}
              max={3}
              step={0.1}
              value={text.delay}
              onChange={(val) =>
                apply(
                  (draft) => {
                    const targetShot = draft.shots.find((s) => s.id === shotId);
                    const targetText = targetShot?.texts.find((t) => t.id === textId);
                    if (targetText) targetText.delay = val;
                  },
                  { coalesceKey: `text-delay-${textId}` },
                )
              }
            />
          </Field>
        </div>
      </Section>

      {/* Actions */}
      <div className="pt-2">
        <Button
          size="sm"
          variant="danger"
          className="w-full justify-center"
          onClick={handleDeleteText}
          icon={<Icon icon={Trash2} size={14} />}
        >
          Delete Text Layer
        </Button>
      </div>
    </div>
  );
};
