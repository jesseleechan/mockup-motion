import React from "react";
import type { AssetRef, Shot } from "../../../doc/types";
import {
  framesAssetIds,
  isSteppedLayout,
  minShotScreenshots,
  ORBIT_MAX_SCREENSHOTS,
  SLIDER_MAX_SCREENSHOTS,
} from "../../../motion";
import { ArrowUpDown } from "lucide-react";
import { Button, Field, Icon, Section, Select } from "../../../ui";
import { useEditorStore } from "../../../state/store";
import { PageList } from "./PageList";
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

const STEPPED_LIST_LABELS = {
  slider: "Slider screenshots",
  orbit: "Orbit screenshots",
  tour: "Tour pages",
} as const;

/**
 * The screenshots a single, responsive, slider, orbit, Site Tour, Before & After, Responsive Tour
 * or Frames layout shows.
 */
export const AssetsSection: React.FC<AssetsSectionProps> = ({ shot, assets }) => {
  const update = useShotUpdate(shot.id);
  const shotIndex = useEditorStore((s) => s.doc.shots.findIndex((c) => c.id === shot.id));
  const aspect = useEditorStore((s) => s.doc.aspect);
  const swapBeforeAfter = useEditorStore((s) => s.swapBeforeAfter);
  const { layout } = shot;
  const images = assets.filter((a) => a.kind === "image");

  if (layout.kind === "responsive-tour") {
    return (
      <Section title="Pages">
        <PageList
          shotId={shot.id}
          shotIndex={shotIndex}
          layout={layout}
          images={images}
          shown={SLIDER_MAX_SCREENSHOTS}
          minimum={minShotScreenshots(layout)}
        />
      </Section>
    );
  }
  if (isSteppedLayout(layout)) {
    const orbit = layout.kind === "orbit";
    const max = orbit ? ORBIT_MAX_SCREENSHOTS : SLIDER_MAX_SCREENSHOTS;
    return (
      <Section title="Screenshots">
        <ScreenshotList
          shotIndex={shotIndex}
          assetIds={layout.assetIds}
          images={images}
          label={STEPPED_LIST_LABELS[layout.kind]}
          shown={max}
          minimum={minShotScreenshots(layout)}
          overflowNote={
            orbit
              ? `Shows the first ${max} screenshots, so the ring stays clear.`
              : `Shows the first ${max} screenshots, so the loop fits in 30 s.`
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
  if (layout.kind === "compare") {
    return (
      <Section title="Screenshots">
        <AssetField
          label="Before"
          value={layout.beforeId || ""}
          images={images}
          droppable
          onChange={(id) =>
            update(
              (target) => {
                if (target.layout.kind === "compare") target.layout.beforeId = id;
              },
              { label: "Change the old design" },
            )
          }
        />
        <AssetField
          label="After"
          value={layout.afterId || ""}
          images={images}
          droppable
          onChange={(id) =>
            update(
              (target) => {
                if (target.layout.kind === "compare") target.layout.afterId = id;
              },
              { label: "Change the new design" },
            )
          }
        />
        <Button
          size="sm"
          variant="secondary"
          className="w-full"
          icon={<Icon icon={ArrowUpDown} size={14} />}
          onClick={() => swapBeforeAfter(shotIndex)}
        >
          Swap before and after
        </Button>
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
