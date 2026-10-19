import React from "react";
import type { AssetRef, Shot } from "../../../doc/types";
import { isSteppedLayout } from "../../../motion";
import { Field, Section, Select } from "../../../ui";
import { useEditorStore } from "../../../state/store";
import { SliderScreenshots } from "./SliderScreenshots";
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

/**
 * The screenshots a single, responsive, slider or orbit layout shows. Frames fills from the
 * project.
 */
export const AssetsSection: React.FC<AssetsSectionProps> = ({ shot, assets }) => {
  const update = useShotUpdate(shot.id);
  const shotIndex = useEditorStore((s) => s.doc.shots.findIndex((c) => c.id === shot.id));
  const { layout } = shot;
  const images = assets.filter((a) => a.kind === "image");

  if (isSteppedLayout(layout)) {
    return (
      <Section title="Screenshots">
        <SliderScreenshots shotIndex={shotIndex} layout={layout} images={images} />
      </Section>
    );
  }
  if (layout.kind !== "single" && layout.kind !== "responsive") return null;

  return (
    <Section title="Screenshots">
      <div className="space-y-3">
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

        <p className="text-[11px] text-[var(--color-text-3)]">
          Drag a file from Media onto a field to use it.
        </p>
      </div>
    </Section>
  );
};
