import React from "react";
import { X } from "lucide-react";
import type { AssetRef } from "../../../doc/types";
import { ORBIT_MAX_SCREENSHOTS, SLIDER_MAX_SCREENSHOTS, type SteppedLayout } from "../../../motion";
import { useEditorStore } from "../../../state/store";
import { Icon, IconButton, Select } from "../../../ui";
import { assetDropProps } from "./useShotUpdate";

interface SliderScreenshotsProps {
  shotIndex: number;
  layout: SteppedLayout;
  images: AssetRef[];
}

/**
 * A slider's or orbit's screenshots in order, with add and remove. The shot length follows the
 * count.
 */
export const SliderScreenshots: React.FC<SliderScreenshotsProps> = ({
  shotIndex,
  layout,
  images,
}) => {
  const addAssetToShot = useEditorStore((s) => s.addAssetToShot);
  const removeAssetFromShot = useEditorStore((s) => s.removeAssetFromShot);
  const add = (assetId: string) => {
    if (assetId) addAssetToShot(shotIndex, assetId);
  };
  const nameOf = (id: string) => images.find((a) => a.id === id)?.name ?? "Missing screenshot";
  const available = images.filter((a) => !layout.assetIds.includes(a.id));
  const slider = layout.kind === "slider";
  const max = slider ? SLIDER_MAX_SCREENSHOTS : ORBIT_MAX_SCREENSHOTS;

  return (
    <div className="space-y-2" {...assetDropProps(add)}>
      <ol aria-label={slider ? "Slider screenshots" : "Orbit screenshots"} className="space-y-1">
        {layout.assetIds.map((id, i) => (
          <li
            key={id}
            className={`flex items-center gap-2 text-[12px] ${
              i >= max ? "text-[var(--color-text-3)]" : "text-[var(--color-text)]"
            }`}
          >
            <span className="w-4 shrink-0 text-right tabular-nums text-[var(--color-text-3)]">
              {i + 1}
            </span>
            <span className="flex-1 min-w-0 truncate">{nameOf(id)}</span>
            <IconButton
              size="sm"
              aria-label={`Remove ${nameOf(id)}`}
              icon={<Icon icon={X} size={12} />}
              onClick={() => removeAssetFromShot(shotIndex, id)}
            />
          </li>
        ))}
      </ol>
      {available.length > 0 && (
        <Select
          aria-label="Add screenshot"
          userContent
          placeholder="Add screenshot"
          value=""
          onChange={add}
          options={available.map((a) => ({ value: a.id, label: a.name }))}
        />
      )}
      {layout.assetIds.length > max && (
        <p className="text-[11px] text-[var(--color-text-2)]">
          {slider
            ? `Shows the first ${max} screenshots, so the loop fits in 30 s.`
            : `Shows the first ${max} screenshots, so the ring stays clear.`}
        </p>
      )}
      <p className="text-[11px] text-[var(--color-text-3)]">
        Drag a file from Media here to add it.
      </p>
    </div>
  );
};
