import { useEffect, useState } from "react";
import { preloadable, whenIdle } from "../defer";
import type { ExportModal } from "./ExportModal";

type ExportModalComponent = typeof ExportModal;

// The dialog's chunk (the dialog, the export pipeline, mediabunny and fflate: 138 kB gzipped)
// stays out of the editor's first load.
const loadExportModal = preloadable(() => import("./ExportModal").then((m) => m.ExportModal));

// The chunk starts loading at the editor's first idle moment, and at most this long after it
// mounts.
const PRELOAD_TIMEOUT_MS = 2000;

/**
 * The Export dialog, or null until its chunk has loaded. The chunk loads when the editor is
 * first idle (or at once if the dialog opens before that), so the Export click renders the
 * dialog in the same task. Loading it on the click, behind React.lazy, kept the dialog closed
 * for 2–3 s locally and over 5 s on CI while the preview was still starting: the chunk's
 * modules could only load between the preview's long tasks.
 */
export function useExportModal(open: boolean): ExportModalComponent | null {
  const [component, setComponent] = useState<ExportModalComponent | null>(null);

  useEffect(() => {
    if (component) return;
    const load = () => {
      void loadExportModal().then((loaded) => setComponent(() => loaded));
    };
    if (open) {
      load();
      return;
    }
    return whenIdle(load, PRELOAD_TIMEOUT_MS);
  }, [open, component]);

  return component;
}
