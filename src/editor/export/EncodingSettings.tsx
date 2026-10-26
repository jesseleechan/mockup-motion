import React, { useState } from "react";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import { Field, Icon, SegmentedControl, Select } from "../../ui";
import type { ExportFormat, ExportQuality, ExportSettings } from "../../doc/types";
import { sectionHead, sectionHeading, sectionNote } from "./surfaces";

const FORMAT_OPTIONS: { value: ExportFormat; label: string }[] = [
  { value: "mp4", label: "MP4 (H.264)" },
  { value: "webm", label: "WebM (VP9)" },
  { value: "bundle", label: "Web bundle (.zip)" },
  { value: "png", label: "Still frame (.png)" },
];

const RESOLUTION_OPTIONS = [
  { value: "720", label: "720p (HD)" },
  { value: "1080", label: "1080p (Full HD)" },
  { value: "1200", label: "1200p (Dribbble)" },
  { value: "1440", label: "1440p (2K)" },
  { value: "2160", label: "2160p (4K)" },
];

const FPS_OPTIONS = [
  { value: "15", label: "15 fps" },
  { value: "24", label: "24 fps" },
  { value: "30", label: "30 fps" },
  { value: "60", label: "60 fps" },
];

const QUALITY_OPTIONS: { value: ExportQuality; label: string }[] = [
  { value: "web", label: "Web (6 Mbps)" },
  { value: "high", label: "High (16 Mbps)" },
  { value: "master", label: "Master (28 Mbps)" },
];

const SUPERSAMPLE_NAMES: { value: string; name: string }[] = [
  { value: "1", name: "Standard" },
  { value: "1.5", name: "Crisp" },
  { value: "2", name: "Sharpest" },
];

const SUPERSAMPLE_OPTIONS = SUPERSAMPLE_NAMES.map(({ value, name }) => ({ value, label: name }));

/** The segments share the field's width evenly, so both rows of Advanced line up. */
const fullWidthSegments = "w-full [&>*]:flex-1";

interface EncodingSettingsProps {
  settings: ExportSettings;
  onChange: (patch: Partial<ExportSettings>) => void;
}

/** The closed Advanced row names its values, so a changed setting is never out of sight. */
function advancedSummary(settings: ExportSettings, isStill: boolean): string {
  if (isStill) return "Not used for still frames";
  const name = SUPERSAMPLE_NAMES.find((o) => o.value === String(settings.supersample))?.name;
  const supersample = `${name ? `${name} ` : ""}${settings.supersample}×`;
  return [`${settings.fps} fps`, supersample].join(" · ");
}

/**
 * Format, resolution and quality, with frame rate and anti-aliasing under a collapsed
 * Advanced row, as segmented controls. Controls that a format ignores are disabled: a still
 * frame has no frame rate, bitrate or supersampling.
 */
export const EncodingSettings: React.FC<EncodingSettingsProps> = ({ settings, onChange }) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const { format } = settings;
  const isStill = format === "png";
  const isVideo = format === "mp4" || format === "webm" || format === "bundle";
  // Presets may use a resolution the list doesn't name (e.g. Dribbble's 1200).
  const resolutionOptions = RESOLUTION_OPTIONS.some((o) => o.value === String(settings.resolution))
    ? RESOLUTION_OPTIONS
    : [
        ...RESOLUTION_OPTIONS,
        { value: String(settings.resolution), label: `${settings.resolution}p` },
      ];

  return (
    <section>
      <div className={sectionHead}>
        <span className={sectionHeading}>Encoding</span>
        {settings.destination === "custom" && <span className={sectionNote}>Custom</span>}
      </div>
      <div className="grid grid-cols-3 gap-x-4 gap-y-3">
        <Field label="Format" stacked>
          <Select
            aria-label="Format"
            value={format}
            onChange={(v) => onChange({ format: v })}
            options={FORMAT_OPTIONS}
          />
        </Field>
        <Field label="Resolution" stacked>
          <Select
            aria-label="Resolution"
            value={String(settings.resolution)}
            onChange={(v) => onChange({ resolution: Number(v) })}
            options={resolutionOptions}
          />
        </Field>
        <Field label="Quality" stacked>
          <Select
            aria-label="Quality"
            value={settings.quality}
            onChange={(v) => onChange({ quality: v })}
            options={QUALITY_OPTIONS}
            disabled={!isVideo}
          />
        </Field>
      </div>

      {/* Layout Stage's disclosure row (.cap-auth summary): field on hover, the chevron turns. */}
      <button
        type="button"
        aria-expanded={advancedOpen}
        aria-controls="export-advanced"
        onClick={() => setAdvancedOpen((open) => !open)}
        className={clsx(
          "mt-3 -mx-2 w-[calc(100%+16px)] h-8 px-2 flex items-center gap-1.5 rounded-[9px] text-left text-[12px] cursor-pointer",
          "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent",
          "text-[var(--color-text-2)] hover:bg-field hover:text-[var(--color-text)] transition-colors",
        )}
      >
        <Icon
          icon={ChevronRight}
          size={13}
          strokeWidth={2}
          className={clsx("transition-transform duration-180", advancedOpen && "rotate-90")}
        />
        <span className="font-medium">Advanced</span>
        <span className="ml-auto min-w-0 truncate tabular-nums">
          {advancedSummary(settings, isStill)}
        </span>
      </button>

      {advancedOpen && (
        <div id="export-advanced" className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Frame rate" stacked>
            <SegmentedControl
              aria-label="Frame rate"
              size="sm"
              value={String(settings.fps)}
              onChange={(v) => onChange({ fps: Number(v) })}
              options={FPS_OPTIONS}
              disabled={isStill}
              className={fullWidthSegments}
            />
          </Field>
          <Field label="Anti-aliasing" stacked>
            <SegmentedControl
              aria-label="Anti-aliasing"
              size="sm"
              value={String(settings.supersample)}
              onChange={(v) => onChange({ supersample: Number(v) })}
              options={SUPERSAMPLE_OPTIONS}
              disabled={!isVideo}
              className={fullWidthSegments}
            />
          </Field>
        </div>
      )}
    </section>
  );
};
