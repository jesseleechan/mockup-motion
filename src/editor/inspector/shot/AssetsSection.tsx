import React from "react";
import type { AssetRef, Shot } from "../../../doc/types";
import {
  framesAssetIds,
  isSteppedLayout,
  minShotScreenshots,
  ORBIT_MAX_SCREENSHOTS,
  pageColumnsAssetIds,
  SLIDER_MAX_SCREENSHOTS,
} from "../../../motion";
import { Field, Section, Select } from "../../../ui";
import { useEditorStore } from "../../../state/store";
import { ScreenshotList } from "./ScreenshotList";
import { assetDropProps, useShotUpdate } from "./useShotUpdate";

interface AssetsSectionProps {
  shot: Shot;
  assets: AssetRef[];
}

interface AssetFieldProps {
  label: string;
  value: string;
  images: AssetRef[];
  onChange: (assetId: string) => void;
  /** Accept a screenshot dragged from the Media tab. */
  droppable?: boolean;
}

const AssetField: React.FC<AssetFieldProps> = ({ label, value, images, onChange, droppable }) => {
  const select = (
    <Select
      aria-label={`${label} screenshot`}
      userContent
      // Radix shows the placeholder for an empty value.
      placeholder="None"
      value={value}
      onChange={onChange}
      options={[
        { value: "", label: "None" },
        ...images.map((a) => ({ value: a.id, label: a.name })),
      ]}
    />
  );
  return (
    <Field label={label}>
      {droppable ? <div {...assetDropProps(onChange)}>{select}</div> : select}
    </Field>
  );
};

/** The screenshots a single, responsive, slider, orbit, Frames or Page Columns layout shows. */
export const AssetsSection: React.FC<AssetsSectionProps> = ({ shot, assets }) => {
  const update = useShotUpdate(shot.id);
  const shotIndex = useEditorStore((s) => s.doc.shots.findIndex((c) => c.id === shot.id));
  const aspect = useEditorStore((s) => s.doc.aspect);
  const { layout } = shot;
  const images = assets.filter((a) => a.kind === "image");

  if (isSteppedLayout(layout)) {
    const slider = layout.kind === "slider";
    const max = slider ? SLIDER_MAX_SCREENSHOTS : ORBIT_MAX_SCREENSHOTS;
    return (
      <Section title="Screenshots">
        <ScreenshotList
          shotIndex={shotIndex}
          assetIds={layout.assetIds}
          images={images}
          label={slider ? "Slider screenshots" : "Orbit screenshots"}
          shown={max}
          minimum={minShotScreenshots(layout)}
          overflowNote={
            slider
              ? `Shows the first ${max} screenshots, so the loop fits in 30 s.`
              : `Shows the first ${max} screenshots, so the ring stays clear.`
          }
        />
      </Section>
    );
  }
  if (layout.kind === "rows" || layout.kind === "columns") {
    // The Layout section says how many fit; the list only dims the rest.
    return (
      <Section title="Screenshots">
        <ScreenshotList
          shotIndex={shotIndex}
          assetIds={layout.assetIds}
          images={images}
          label="Frames screenshots"
          shown={framesAssetIds(layout, aspect).length}
          minimum={minShotScreenshots(layout)}
        />
      </Section>
    );
  }
  if (layout.kind === "pageColumns") {
    // One page per column, from 3 down to 1 for desktop at 4:5 and 9:16 (quality bar §4).
    const shown = pageColumnsAssetIds(layout, aspect).length;
    return (
      <Section title="Screenshots">
        <ScreenshotList
          shotIndex={shotIndex}
          assetIds={layout.assetIds}
          images={images}
          label="Page columns screenshots"
          shown={shown}
          minimum={minShotScreenshots(layout)}
          overflowNote={
            shown === 1
              ? "Shows the first page only, in one column at this aspect."
              : `Shows the first ${shown} pages, one per column at this aspect.`
          }
        />
      </Section>
    );
  }
  if (layout.kind !== "single" && layout.kind !== "responsive") return null;

  return (
    <Section title="Screenshots">
      {layout.kind === "single" && (
        <AssetField
          label="Screenshot"
          value={layout.assetId || ""}
          images={images}
          droppable
          onChange={(assetId) =>
            update(
              (target) => {
                if (target.layout.kind === "single") target.layout.assetId = assetId;
              },
              { label: "Change shot asset" },
            )
          }
        />
      )}

      {layout.kind === "responsive" && (
        <>
          <AssetField
            label="Desktop"
            value={layout.desktopId || ""}
            images={images}
            droppable
            onChange={(id) =>
              update((target) => {
                if (target.layout.kind === "responsive") target.layout.desktopId = id;
              })
            }
          />
          <AssetField
            label="Mobile"
            value={layout.mobileId || ""}
            images={images}
            droppable
            onChange={(id) =>
              update((target) => {
                if (target.layout.kind === "responsive") target.layout.mobileId = id;
              })
            }
          />
        </>
      )}

      <p className="text-[11px] leading-4 text-text-2">
        Drag a file from Media onto a field to use it.
      </p>
    </Section>
  );
};
