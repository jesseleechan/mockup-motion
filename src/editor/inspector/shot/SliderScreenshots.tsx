import React from "react";
import { X } from "lucide-react";
import type { AssetRef, Layout } from "../../../doc/types";
import { SLIDER_MAX_SCREENSHOTS } from "../../../motion";
import { useEditorStore } from "../../../state/store";
import { Icon, IconButton, Select } from "../../../ui";
import { assetDropProps } from "./useShotUpdate";

interface SliderScreenshotsProps {
  shotIndex: number;
  layout: Extract<Layout, { kind: "slider" }>;
  images: AssetRef[];
}

/** A slider's screenshots in order, with add and remove. The shot length follows the count. */
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

  return (
    <div className="space-y-2" {...assetDropProps(add)}>
      <ol aria-label="Slider screenshots" className="space-y-1">
        {layout.assetIds.map((id, i) => (
          <li
            key={id}
            className={`flex items-center gap-2 text-[12px] ${
              i >= SLIDER_MAX_SCREENSHOTS
                ? "text-[var(--color-text-3)]"
                : "text-[var(--color-text)]"
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
      {layout.assetIds.length > SLIDER_MAX_SCREENSHOTS && (
        <p className="text-[11px] text-[var(--color-text-2)]">
          Shows the first {SLIDER_MAX_SCREENSHOTS} screenshots, so the loop fits in 30 s.
        </p>
      )}
      <p className="text-[11px] text-[var(--color-text-3)]">
        Drag a file from Media here to add it.
      </p>
    </div>
  );
};
