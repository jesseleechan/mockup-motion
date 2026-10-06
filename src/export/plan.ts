import type { Aspect, ExportFormat, ExportSettings } from "../doc/types";
import { estimateFileSize, gifOutput, outputDimensions, type BundleParts } from "./destinations";

/** Video encoders available in this browser at the export size (see probe.ts). */
export interface EncoderSupport {
  avc: boolean;
  vp9: boolean;
}

export type ExportExtension = "mp4" | "webm" | "zip" | "gif" | "png";

/** What an export will actually write, after the encoder probe. */
export interface ExportPlan {
  /** Settings to export with: `format` is the container that will be written. */
  settings: ExportSettings;
  /** Container and codec, e.g. "WebM · VP9" or "Web bundle · MP4 + WebM". */
  label: string;
  extension: ExportExtension;
  width: number;
  height: number;
  /** Null for a still frame. */
  fps: number | null;
  duration: number | null;
  bytes: number;
  bundleParts?: BundleParts;
  /** Why the output differs from what was asked for. */
  notice?: string;
}

export type ExportPlanResult = { ok: true; plan: ExportPlan } | { ok: false; error: string };

const NO_VIDEO_ENCODER =
  "This browser can't encode video. Export an animated GIF or a still frame instead.";

/** True when the format needs the encoder probe before it can be planned. */
export function needsEncoderProbe(format: ExportFormat): boolean {
  return format === "mp4" || format === "webm" || format === "bundle";
}

/**
 * Resolves the requested settings against the encoders this browser has: MP4 falls back to
 * WebM (and the reverse) when only the other encoder exists, and a web bundle holds whichever
 * videos can be encoded. The label, extension and size estimate describe the real output.
 */
export function planExport(
  requested: ExportSettings,
  aspect: Aspect,
  duration: number,
  support: EncoderSupport,
): ExportPlanResult {
  const { width, height } = outputDimensions(aspect, requested.resolution);
  const base = { width, height, fps: requested.fps, duration };

  switch (requested.format) {
    case "gif": {
      const gif = gifOutput(aspect, requested.resolution, requested.fps);
      return {
        ok: true,
        plan: {
          ...base,
          ...gif,
          settings: requested,
          label: "Animated GIF",
          extension: "gif",
          bytes: estimateFileSize(requested, aspect, duration),
        },
      };
    }
    case "png":
      return {
        ok: true,
        plan: {
          ...base,
          fps: null,
          duration: null,
          settings: requested,
          label: "PNG still",
          extension: "png",
          bytes: estimateFileSize(requested, aspect, duration),
        },
      };
    case "bundle": {
      const parts: BundleParts = { mp4: support.avc, webm: support.vp9 };
      if (!parts.mp4 && !parts.webm) return { ok: false, error: NO_VIDEO_ENCODER };
      const videos = [parts.mp4 && "MP4", parts.webm && "WebM"].filter(Boolean).join(" + ");
      const missing = !parts.mp4 ? "MP4" : !parts.webm ? "WebM" : null;
      return {
        ok: true,
        plan: {
          ...base,
          settings: requested,
          label: `Web bundle · ${videos}`,
          extension: "zip",
          bytes: estimateFileSize(requested, aspect, duration, parts),
          bundleParts: parts,
          notice: missing
            ? `${missing} isn't available in this browser, so the bundle holds ${videos} only.`
            : undefined,
        },
      };
    }
    case "mp4":
    case "webm": {
      const wantsMp4 = requested.format === "mp4";
      const mp4 = support.avc && (wantsMp4 || !support.vp9);
      if (!support.avc && !support.vp9) return { ok: false, error: NO_VIDEO_ENCODER };
      const format: ExportFormat = mp4 ? "mp4" : "webm";
      const settings = { ...requested, format };
      const fellBack = format !== requested.format;
      return {
        ok: true,
        plan: {
          ...base,
          settings,
          label: mp4 ? "MP4 · H.264" : "WebM · VP9",
          extension: format,
          bytes: estimateFileSize(settings, aspect, duration),
          notice: fellBack
            ? wantsMp4
              ? "MP4 (H.264) isn't available in this browser, so this exports WebM (VP9)."
              : "WebM (VP9) isn't available in this browser, so this exports MP4 (H.264)."
            : undefined,
        },
      };
    }
  }
}

/** Download name: project name and aspect, with the extension of the real container. */
export function exportFilename(projectName: string, aspect: Aspect, ext: ExportExtension): string {
  const cleanName =
    projectName
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "mockup";
  return `${cleanName}-${aspect.replace(":", "x")}.${ext}`;
}
