import React from "react";
import type { CursorSpec, Shot } from "../../../doc/types";
import { Button, Field, Icon, Section, Select, Switch } from "../../../ui";
import { Trash2 } from "lucide-react";
import { useShotUpdate } from "./useShotUpdate";

const CURSOR_STYLES: { value: CursorSpec["style"]; label: string }[] = [
  { value: "arrow", label: "Arrow" },
  { value: "pointer", label: "Pointer" },
  { value: "dot", label: "Touch dot" },
];

/** A simulated pointer with click ripples, for single-device shots. */
export const CursorSection: React.FC<{ shot: Shot }> = ({ shot }) => {
  const update = useShotUpdate(shot.id);
  const { cursor } = shot;
  if (shot.layout.kind !== "single") return null;

  return (
    <Section title="Cursor">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium text-[var(--color-text)]">Show cursor</div>
            <div className="text-[11px] text-[var(--color-text-3)]">
              A pointer that moves and clicks
            </div>
          </div>
          <Switch
            aria-label="Show cursor"
            checked={Boolean(cursor?.enabled)}
            onCheckedChange={(enabled) => {
              update(
                (target) => {
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

        {cursor?.enabled && (
          <>
            <Field label="Style">
              <Select
                aria-label="Cursor style"
                value={cursor.style}
                onChange={(style) =>
                  update((target) => {
                    if (target.cursor) target.cursor.style = style;
                  })
                }
                options={CURSOR_STYLES}
              />
            </Field>

            <div className="p-2 rounded bg-[var(--color-raised)] text-[11px] text-[var(--color-text-2)] leading-relaxed">
              Click the screen on the stage to add a point.{" "}
              <strong className="text-[var(--color-text)]">Alt-click</strong> adds a click.
            </div>

            <Field label="Keyframes" value={String(cursor.keys?.length ?? 0)} stacked>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {(cursor.keys || []).map((key, kIdx) => (
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
                      aria-label="Remove keyframe"
                      onClick={() =>
                        update((target) => {
                          if (target.cursor) {
                            target.cursor.keys = target.cursor.keys.filter((_, i) => i !== kIdx);
                          }
                        })
                      }
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
                className="flex-1 text-[11px]"
                onClick={() =>
                  update((target) => {
                    if (target.cursor) {
                      target.cursor.keys.push({
                        t: Number((target.duration * 0.5).toFixed(2)),
                        x: 0.5,
                        y: 0.5,
                      });
                      target.cursor.keys.sort((a, b) => a.t - b.t);
                    }
                  })
                }
              >
                Add keyframe
              </Button>
              {(cursor.keys?.length ?? 0) > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-[11px] text-[var(--color-text-3)] hover:text-[var(--color-danger)]"
                  onClick={() =>
                    update((target) => {
                      if (target.cursor) target.cursor.keys = [];
                    })
                  }
                >
                  Clear
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Section>
  );
};
