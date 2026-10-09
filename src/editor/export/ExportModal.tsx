import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download } from "lucide-react";
import { Button, Dialog, DialogContent } from "../../ui";
import { useEditorStore } from "../../state/store";
import { createEditorAssetProvider } from "../asset-provider";
import { exportWithEngine, type ExportProgress as Progress } from "../../export/engine-export";
import { DESTINATION_PRESETS } from "../../export/destinations";
import { exportFilename } from "../../export/plan";
import { changeAspect } from "../aspect";
import { schedule } from "../../motion";
import type { DestinationId, ExportSettings } from "../../doc/types";
import { DestinationPicker } from "./DestinationPicker";
import { EncodingSettings } from "./EncodingSettings";
import { ExportSummary } from "./ExportSummary";
import { ExportProgress } from "./ExportProgress";
import { ExportResult, type ExportOutcome } from "./ExportResult";
import { useExportPlan } from "./useExportPlan";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function presetSettings(id: DestinationId): ExportSettings {
  const { resolution, fps, quality, format, supersample, motionBlur } = DESTINATION_PRESETS[id];
  return { destination: id, resolution, fps, quality, format, supersample, motionBlur };
}

const notice = "p-3 rounded-lg bg-[var(--color-raised)] border text-xs flex items-start gap-2";

export const ExportModal: React.FC<ExportModalProps> = ({ open, onOpenChange }) => {
  const doc = useEditorStore((s) => s.doc);
  const apply = useEditorStore((s) => s.apply);
  const { total: duration } = useMemo(() => schedule(doc), [doc]);

  const [settings, setSettings] = useState<ExportSettings>(() => presetSettings("web-embed"));
  const { probing, plan } = useExportPlan(settings, doc.aspect, duration, open);

  const [progress, setProgress] = useState<Progress | null>(null);
  const [outcome, setOutcome] = useState<ExportOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const urlRef = useRef<string | null>(null);

  const revokeUrl = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  };

  // Closing the editor mid-export must not leave a worker or an object URL behind.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      revokeUrl();
    },
    [],
  );

  // Changing any setting leaves the preset, so the destination becomes Custom.
  const updateSettings = (patch: Partial<ExportSettings>) =>
    setSettings((s) => ({ ...s, ...patch, destination: "custom" }));

  const handleStart = async () => {
    if (!plan?.ok) return;
    const planned = plan.plan;
    revokeUrl();
    setOutcome(null);
    setError(null);
    setProgress({ stage: "preparing", frame: 0, total: 1, percentage: 0 });

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await exportWithEngine(
        doc,
        createEditorAssetProvider(),
        planned.settings,
        controller.signal,
        (p) => {
          if (!controller.signal.aborted) setProgress(p);
        },
      );
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(result.blob);
      urlRef.current = url;
      setOutcome({
        url,
        filename: exportFilename(doc.name, doc.aspect, planned.extension),
        extension: planned.extension,
        label: planned.label,
        result,
      });
    } catch (err: unknown) {
      // A cancel already returned to the settings view (handleCancel).
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (!controller.signal.aborted) setProgress(null);
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    revokeUrl();
    setProgress(null);
    setError("Export cancelled.");
  };

  const handleClose = (nextOpen: boolean) => {
    if (progress) {
      if (!confirm("The export is still rendering. Cancel it?")) return;
      handleCancel();
    }
    if (!nextOpen) {
      revokeUrl();
      setOutcome(null);
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  const handleExportAnother = () => {
    revokeUrl();
    setOutcome(null);
  };

  const planned = plan?.ok ? plan.plan : null;
  const exportsAudio = planned?.extension === "mp4" || planned?.extension === "webm";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        title="Export video"
        description="Render for the web, social posts or a presentation."
        className="max-w-[600px]! max-h-[calc(100vh-32px)] overflow-y-auto"
      >
        <div className="space-y-5">
          {progress ? (
            <ExportProgress
              progress={progress}
              label={planned?.label ?? ""}
              onCancel={handleCancel}
            />
          ) : outcome ? (
            <ExportResult outcome={outcome} onExportAnother={handleExportAnother} />
          ) : (
            <>
              <DestinationPicker
                destination={settings.destination}
                aspect={doc.aspect}
                onSelect={(id) => setSettings(presetSettings(id))}
                onSwitchAspect={(aspect) =>
                  apply((draft) => changeAspect(draft, aspect), {
                    label: `Change aspect to ${aspect}`,
                  })
                }
              />
              <EncodingSettings settings={settings} onChange={updateSettings} />

              {planned?.notice && (
                <div className={`${notice} border-amber-500/30 text-amber-300`} role="status">
                  <AlertTriangle size={14} className="shrink-0 mt-px" />
                  <span>{planned.notice}</span>
                </div>
              )}

              {doc.audio && (
                <div
                  data-testid="music-note"
                  className={`${notice} border-[var(--color-line)] text-[var(--color-text-2)]`}
                >
                  {exportsAudio
                    ? `Music is mixed into the ${planned?.extension === "mp4" ? "MP4 (AAC)" : "WebM (Opus)"}.`
                    : settings.format === "bundle"
                      ? "Web bundles are silent, so music is left out."
                      : settings.format === "gif"
                        ? "GIFs have no sound, so music is left out."
                        : settings.format === "png"
                          ? "Still frames have no sound."
                          : "Checking which audio codec this browser has…"}
                </div>
              )}

              <ExportSummary probing={probing} plan={plan} />
            </>
          )}

          {error && !progress && (
            <div className={`${notice} bg-red-950/40 border-red-500/40 text-red-200`} role="alert">
              <AlertTriangle size={14} className="shrink-0 mt-px text-red-400" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {!progress && !outcome && (
          <div className="mt-5 pt-4 border-t border-[var(--color-line)] flex items-center justify-between">
            <Button variant="ghost" onClick={() => handleClose(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={handleStart}
              disabled={!plan?.ok}
              icon={<Download size={14} />}
            >
              Start export
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
