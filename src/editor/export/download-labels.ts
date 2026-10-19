import type { ExportExtension } from "../../export/plan";

/** "Download MP4", "Download bundle": the file type a download link names. */
export const DOWNLOAD_LABELS: Record<ExportExtension, string> = {
  mp4: "MP4",
  webm: "WebM",
  zip: "bundle",
  png: "PNG",
};
