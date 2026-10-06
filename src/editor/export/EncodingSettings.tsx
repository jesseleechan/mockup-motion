import React from "react";
import { Field, Select, Switch } from "../../ui";
import type { ExportFormat, ExportQuality, ExportSettings } from "../../doc/types";
import { sectionHeading } from "./DestinationPicker";

const FORMAT_OPTIONS: { value: ExportFormat; label: string }[] = [
  { value: "mp4", label: "MP4 (H.264)" },
  { value: "webm", label: "WebM (VP9)" },
  { value: "bundle", label: "Web bundle (.zip)" },
  { value: "gif", label: "Animated GIF" },
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

const SUPERSAMPLE_OPTIONS = [
  { value: "1", label: "Standard (1×)" },
  { value: "1.5", label: "Crisp (1.5×)" },
  { value: "2", label: "Sharpest (2×)" },
];

interface EncodingSettingsProps {
  settings: ExportSettings;
  onChange: (patch: Partial<ExportSettings>) => void;
}

/**
 * Two columns of stacked fields. Controls that a format ignores are disabled: a still frame
 * has no frame rate, and GIFs and stills skip bitrate, supersampling and motion blur.
 */
export const EncodingSettings: React.FC<EncodingSettingsProps> = ({ settings, onChange }) => {
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
      <span className={sectionHeading}>Encoding</span>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
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
        <Field label="Frame rate" stacked>
          <Select
            aria-label="Frame rate"
            value={String(settings.fps)}
            onChange={(v) => onChange({ fps: Number(v) })}
            options={FPS_OPTIONS}
            disabled={isStill}
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
        <Field label="Anti-aliasing" stacked>
          <Select
            aria-label="Anti-aliasing"
            value={String(settings.supersample)}
            onChange={(v) => onChange({ supersample: Number(v) })}
            options={SUPERSAMPLE_OPTIONS}
            disabled={!isVideo}
          />
        </Field>
        <Field label="Motion blur" stacked>
          <div className="flex h-8 items-center gap-2.5">
            <Switch
              aria-label="Motion blur"
              checked={settings.motionBlur && isVideo}
              onCheckedChange={(checked) => onChange({ motionBlur: checked })}
              disabled={!isVideo}
            />
            <span className="min-w-0 truncate text-[12px] text-[var(--color-text-3)]">
              {settings.motionBlur && isVideo ? "On, slower to render" : "Off"}
            </span>
          </div>
        </Field>
      </div>
    </section>
  );
};
