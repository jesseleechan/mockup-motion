import React from "react";
import clsx from "clsx";
import { Check, Film, Globe, Monitor, Play, Smartphone, Video } from "lucide-react";
import { Button } from "../../ui";
import type { Aspect, DestinationId } from "../../doc/types";
import { DESTINATION_PRESETS } from "../../export/destinations";
import { DESTINATION_LABELS } from "../labels";

/** Videos first, the web bundle last (export polish §3). Custom is a state, not a card. */
const CARDS: {
  id: DestinationId;
  icon: React.ComponentType<{ size: number; className?: string }>;
  detail: string;
}[] = [
  { id: "video", icon: Video, detail: "MP4 · your aspect" },
  { id: "dribbble", icon: Film, detail: "4:3 · 1600 × 1200" },
  { id: "instagram-feed", icon: Smartphone, detail: "4:5 · 1080 × 1350" },
  { id: "instagram-story", icon: Play, detail: "9:16 · 1080 × 1920" },
  { id: "presentation-4k", icon: Monitor, detail: "16:9 · 3840 × 2160" },
  { id: "web-embed", icon: Globe, detail: "MP4, WebM, poster, embed" },
];

export const sectionHeading =
  "block mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-3)]";

interface DestinationPickerProps {
  destination: DestinationId;
  aspect: Aspect;
  onSelect: (id: DestinationId) => void;
  onSwitchAspect: (aspect: Aspect) => void;
}

/** Destination preset cards, and a quick fix when the project aspect differs from the preset's. */
export const DestinationPicker: React.FC<DestinationPickerProps> = ({
  destination,
  aspect,
  onSelect,
  onSwitchAspect,
}) => {
  const recommended = DESTINATION_PRESETS[destination].aspect;
  return (
    <section>
      <span className={sectionHeading}>Destination</span>
      <div className="grid grid-cols-3 gap-2">
        {CARDS.map(({ id, icon: IconComp, detail }) => {
          const isSelected = destination === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={isSelected}
              aria-label={DESTINATION_LABELS[id]}
              onClick={() => onSelect(id)}
              className={clsx(
                "min-w-0 p-2.5 rounded-lg border text-left flex flex-col gap-2 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
                isSelected
                  ? "border-[var(--color-accent)] bg-[var(--color-raised)]"
                  : "border-[var(--color-line)] bg-[var(--color-panel)] hover:border-[var(--color-line-strong)] hover:bg-[var(--color-raised)]",
              )}
            >
              <span className="flex items-center justify-between">
                <IconComp
                  size={16}
                  className={
                    isSelected ? "text-[var(--color-accent)]" : "text-[var(--color-text-2)]"
                  }
                />
                {isSelected && <Check size={12} className="text-[var(--color-accent)]" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-[var(--color-text)]">
                  {DESTINATION_LABELS[id]}
                </span>
                <span className="block truncate text-[11px] tabular-nums text-[var(--color-text-3)]">
                  {detail}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {recommended && recommended !== aspect && (
        <div className="mt-2.5 p-2.5 rounded-lg bg-[var(--color-raised)] border border-[var(--color-line)] flex items-center justify-between gap-3 text-xs">
          <span className="min-w-0 text-[var(--color-text-2)]">
            Preset recommends <strong>{recommended}</strong> (current: {aspect})
          </span>
          <Button size="sm" variant="secondary" onClick={() => onSwitchAspect(recommended)}>
            Switch to {recommended}
          </Button>
        </div>
      )}
    </section>
  );
};
