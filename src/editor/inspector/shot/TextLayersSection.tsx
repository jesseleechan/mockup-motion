import React from "react";
import type { Shot } from "../../../doc/types";
import { useUIStore } from "../../../state/ui-store";
import { Button, Icon, Section } from "../../../ui";
import { Plus, Type } from "lucide-react";
import { TEXT_ROLE_LABELS } from "../../labels";
import { useShotUpdate } from "./useShotUpdate";

export const TextLayersSection: React.FC<{ shot: Shot }> = ({ shot }) => {
  const update = useShotUpdate(shot.id);
  const setSelection = useUIStore((s) => s.setSelection);

  const handleAddText = () => {
    const textId = crypto.randomUUID();
    update(
      (target) => {
        target.texts.push({
          id: textId,
          text: "New caption",
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
    setSelection({ kind: "text", shotId: shot.id, id: textId });
  };

  return (
    <Section title="Text layers">
      <div className="space-y-2">
        {shot.texts.map((text) => (
          <div
            key={text.id}
            onClick={() => setSelection({ kind: "text", shotId: shot.id, id: text.id })}
            className="p-2 rounded-md border border-[var(--color-line)] bg-[var(--color-raised)] hover:border-[var(--color-accent)] cursor-pointer flex items-center justify-between gap-2 group transition-all"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Icon icon={Type} size={13} className="text-[var(--color-text-3)] shrink-0" />
              <span data-truncate className="text-xs text-[var(--color-text)] truncate">
                {text.text || "Empty text"}
              </span>
            </div>
            <span className="text-[10px] text-[var(--color-text-3)] shrink-0">
              {TEXT_ROLE_LABELS[text.role]}
            </span>
          </div>
        ))}

        <Button
          size="sm"
          variant="secondary"
          onClick={handleAddText}
          className="w-full"
          icon={<Icon icon={Plus} size={14} />}
        >
          Add text
        </Button>
      </div>
    </Section>
  );
};
