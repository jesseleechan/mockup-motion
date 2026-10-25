import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download } from "lucide-react";
import { Button, Dialog, DialogContent } from "../../ui";
import { useEditorStore } from "../../state/store";
import { createEditorAssetProvider } from "../asset-provider";
import { exportWithEngine, type ExportProgress as Progress } from "../../export/engine-export";
import { DESTINATION_PRESETS } from "../../export/destinations";
import { exportFilename, type ExportPlan } from "../../export/plan";
import { changeAspect } from "../aspect";
import { schedule } from "../../motion";
import type { Aspect, DestinationId, ExportSettings } from "../../doc/types";
import { DestinationPicker } from "./DestinationPicker";
import { EncodingSettings } from "./EncodingSettings";
import { ExportSummary } from "./ExportSummary";
import { ExportProgress } from "./ExportProgress";
import { ExportResult, type ExportOutcome } from "./ExportResult";
import { ExportFiles, FileList } from "./ExportFiles";
import { SizePicker } from "./SizePicker";
import { docAtAspect, fileNotices, orderSizes, runExportQueue } from "./queue";
import { useExportPlan, type ExportTarget } from "./useExportPlan";
import { notice } from "./surfaces";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function presetSettings(id: DestinationId): ExportSettings {
  const { resolution, fps, quality, format, supersample } = DESTINATION_PRESETS[id];
  return { destination: id, resolution, fps, quality, format, supersample };
}

const NO_TARGETS: ExportTarget[] = [];

/** The file being rendered, for the progress view of an export with several sizes. */
interface CurrentFile {
  index: number;
  aspect: Aspect;
  plan: ExportPlan;
}

export const ExportModal: React.FC<ExportModalProps> = ({ open, onOpenChange }) => {
  const doc = useEditorStore((s) => s.doc);
  const apply = useEditorStore((s) => s.apply);
  const rememberExport = useEditorStore((s) => s.rememberExport);

  // Opens on the project's last export settings: a new project's are this browser's last
  // ones, or MP4 at 1080p. The sizes start at the project's aspect, and follow it when
  // "Switch to" changes it.
  const [settings, setSettings] = useState<ExportSettings>(doc.export);
  const [sizes, setSizes] = useState<Aspect[]>([doc.aspect]);
  const [wasOpen, setWasOpen] = useState(open);
  const [lastAspect, setLastAspect] = useState(doc.aspect);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSettings(doc.export);
      setSizes([doc.aspect]);
    }
  }
  if (doc.aspect !== lastAspect) {
    setLastAspect(doc.aspect);
    setSizes((s) => [...new Set(s.map((a) => (a === lastAspect ? doc.aspect : a)))]);
  }

  // Each size renders a copy of the project re-fitted to it, which may change its length.
  // Only while the dialog is open: re-fitting on every edit of a closed dialog is wasted work.
  const targets = useMemo(
    () =>
      open
        ? orderSizes(sizes, doc.aspect).map((aspect) => ({
            aspect,
            duration: schedule(docAtAspect(doc, aspect)).total,
          }))
        : NO_TARGETS,
    [open, sizes, doc],
  );
  const { probing, plans } = useExportPlan(settings, targets, open);
  const files = plans?.flatMap((f) => (f.plan.ok ? [{ aspect: f.aspect, plan: f.plan.plan }] : []));
  const ready = !!plans && plans.length > 0 && files?.length === plans.length;

  const [progress, setProgress] = useState<Progress | null>(null);
  const [current, setCurrent] = useState<CurrentFile | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [outcomes, setOutcomes] = useState<ExportOutcome[]>([]);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const urlsRef = useRef<string[]>([]);

  const revokeUrls = () => {
    for (const url of urlsRef.current) URL.revokeObjectURL(url);
    urlsRef.current = [];
  };

  // Closing the editor mid-export must not leave a worker or an object URL behind.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      revokeUrls();
    },
    [],
  );

  // Changing any setting leaves the preset, so the destination becomes Custom.
  const updateSettings = (patch: Partial<ExportSettings>) =>
    setSettings((s) => ({ ...s, ...patch, destination: "custom" }));

  const handleStart = async () => {
    if (!ready || !files) return;
    const source = doc;
    const provider = createEditorAssetProvider();
    rememberExport(settings);
    revokeUrls();
    setOutcomes([]);
    setError(null);
    setFileCount(files.length);
    setProgress({ stage: "preparing", frame: 0, total: 1, percentage: 0 });

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await runExportQueue(
        files.map((f) => f.aspect),
        (aspect, index) => {
          setCurrent({ index, aspect, plan: files[index].plan });
          return exportWithEngine(
            docAtAspect(source, aspect),
            provider,
            files[index].plan.settings,
            controller.signal,
            (p) => {
              if (!controller.signal.aborted) setProgress(p);
            },
          );
        },
        (aspect, result, index) => {
          const planned = files[index].plan;
          const url = URL.createObjectURL(result.blob);
          urlsRef.current.push(url);
          setOutcomes((o) => [
            ...o,
            {
              aspect,
              url,
              filename: exportFilename(source.name, aspect, planned.extension),
              extension: planned.extension,
              label: planned.label,
              result,
            },
          ]);
        },
        controller.signal,
      );
    } catch (err: unknown) {
      // A cancel already set its message (handleCancel).
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (!controller.signal.aborted) {
        setProgress(null);
        setCurrent(null);
      }
    }
  };

  // Files that already finished stay available; an export of one file returns to the settings.
  const handleCancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setProgress(null);
    setCurrent(null);
    setError("Export cancelled.");
  };

  const reset = () => {
    revokeUrls();
    setOutcomes([]);
    setFileCount(0);
  };

  const handleClose = (nextOpen: boolean) => {
    if (progress) {
      if (!confirm("The export is still rendering. Cancel it?")) return;
      handleCancel();
    }
    if (!nextOpen) {
      reset();
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  const handleExportAnother = () => {
    reset();
    setError(null);
  };

  const showResult = !progress && outcomes.length > 0;
  const notices = files ? fileNotices(files) : [];
  const progressLabel = current
    ? fileCount > 1
      ? `File ${current.index + 1} of ${fileCount} · ${current.aspect} · ${current.plan.label}`
      : current.plan.label
    : "";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        title="Export video"
        description="Render for the web, social posts or a presentation."
        className="max-w-[600px]! max-h-[calc(100vh-32px)] overflow-y-auto"
      >
        <div className="space-y-5">
          {progress ? (
            <>
              <ExportProgress progress={progress} label={progressLabel} onCancel={handleCancel} />
              {outcomes.length > 0 && <FileList outcomes={outcomes} />}
            </>
          ) : showResult && fileCount === 1 ? (
            <ExportResult outcome={outcomes[0]} onExportAnother={handleExportAnother} />
          ) : showResult ? (
            <ExportFiles
              outcomes={outcomes}
              total={fileCount}
              onExportAnother={handleExportAnother}
            />
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
              <SizePicker projectAspect={doc.aspect} selected={sizes} onChange={setSizes} />
              <EncodingSettings settings={settings} onChange={updateSettings} />

              {notices.map((text) => (
                <div key={text} className={notice("warning")} role="status">
                  <AlertTriangle size={14} className="shrink-0 mt-px" />
                  <span>{text}</span>
                </div>
              ))}

              <ExportSummary probing={probing} plans={plans} />
            </>
          )}

          {error && !progress && (
            <div className={notice("danger")} role="alert">
              <AlertTriangle size={14} className="shrink-0 mt-px" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {!progress && !showResult && (
          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" onClick={() => handleClose(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={handleStart}
              disabled={!ready}
              icon={<Download size={14} />}
            >
              {files && files.length > 1 ? `Export ${files.length} files` : "Start export"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
