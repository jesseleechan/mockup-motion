import React from "react";
import clsx from "clsx";
import { Film, Globe, Monitor, Play, Smartphone, Video } from "lucide-react";
import { Button, Icon } from "../../ui";
import type { Aspect, DestinationId } from "../../doc/types";
import { DESTINATION_PRESETS } from "../../export/destinations";
import { DESTINATION_LABELS } from "../labels";
import { sectionHead, sectionHeading, well } from "./surfaces";

/** Videos first, the web bundle last (export polish §3). Custom is a state, not a card. */
const CARDS: {
  id: DestinationId;
  icon: typeof Video;
  detail: string;
}[] = [
  { id: "video", icon: Video, detail: "MP4 · LinkedIn, X, your site" },
  { id: "dribbble", icon: Film, detail: "4:3 · 1600 × 1200" },
  { id: "instagram-feed", icon: Smartphone, detail: "4:5 · 1080 × 1350" },
  { id: "instagram-story", icon: Play, detail: "9:16 · 1080 × 1920" },
  { id: "presentation-4k", icon: Monitor, detail: "16:9 · 3840 × 2160" },
  { id: "web-embed", icon: Globe, detail: "MP4, WebM, poster, embed" },
];

interface DestinationPickerProps {
  destination: DestinationId;
  aspect: Aspect;
  onSelect: (id: DestinationId) => void;
  onSwitchAspect: (aspect: Aspect) => void;
}

/**
 * The destinations as Layout Stage's tiles: an icon on a paper face, ringed in ink when picked,
 * with the name and size under it. A quick fix follows when the project's aspect differs from
 * the preset's.
 */
export const DestinationPicker: React.FC<DestinationPickerProps> = ({
  destination,
  aspect,
  onSelect,
  onSwitchAspect,
}) => {
  const recommended = DESTINATION_PRESETS[destination].aspect;
  return (
    <section>
      <div className={sectionHead}>
        <span className={sectionHeading}>Destination</span>
      </div>
      <div className="grid grid-cols-3 gap-x-2 gap-y-3">
        {CARDS.map(({ id, icon, detail }) => {
          const isSelected = destination === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={isSelected}
              aria-label={DESTINATION_LABELS[id]}
              title={DESTINATION_PRESETS[id].description}
              onClick={() => onSelect(id)}
              className="group min-w-0 flex flex-col gap-1.5 text-center cursor-pointer outline-none"
            >
              <span
                className={clsx(
                  "h-12 grid place-items-center rounded-[12px] bg-paper transition-shadow duration-120",
                  "group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-accent",
                  isSelected
                    ? "shadow-[0_0_0_2px_var(--color-text)] text-[var(--color-text)]"
                    : "shadow-lift-sm text-[var(--color-text-2)] group-hover:shadow-[0_0_0_1px_var(--color-line-strong)]",
                )}
              >
                <Icon icon={icon} size={18} />
              </span>
              <span className="min-w-0 px-0.5">
                <span className="block truncate text-[12px] font-semibold text-[var(--color-text)]">
                  {DESTINATION_LABELS[id]}
                </span>
                <span className="block truncate text-[11px] tabular-nums text-[var(--color-text-2)]">
                  {detail}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {recommended && recommended !== aspect && (
        <div
          className={clsx(well, "mt-3 pl-3 pr-1.5 py-1.5 flex items-center justify-between gap-3")}
        >
          <span className="min-w-0">
            Preset recommends{" "}
            <strong className="font-semibold text-[var(--color-text)]">{recommended}</strong>{" "}
            (current: {aspect})
          </span>
          <Button size="sm" variant="secondary" onClick={() => onSwitchAspect(recommended)}>
            Switch to {recommended}
          </Button>
        </div>
      )}
    </section>
  );
};
