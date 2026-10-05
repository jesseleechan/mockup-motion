import React, { useRef, useState } from "react";
import { Button, Dialog, DialogContent, Icon, ProgressBar, Select } from "../../ui";
import { useEditorStore } from "../../state/store";
import { createEditorAssetProvider } from "../asset-provider";
import { exportWithEngine, type ExportProgress } from "../../export/engine-export";
import { Download, Film, XCircle } from "lucide-react";
import type { ExportSettings } from "../../doc/types";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ open, onOpenChange }) => {
  const doc = useEditorStore((s) => s.doc);
  const [format, setFormat] = useState<"mp4" | "webm">("mp4");
  const [fps, setFps] = useState<30 | 60>(30);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadFilename, setDownloadFilename] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStartExport = async () => {
    setIsExporting(true);
    setProgress({ stage: "preparing", frame: 0, total: 1, percentage: 0 });
    setError(null);
    setDownloadUrl(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const provider = createEditorAssetProvider();
    const settings: ExportSettings = {
      destination: "custom",
      resolution: 1080,
      fps,
      quality: "high",
      format,
      supersample: 1.5,
      motionBlur: false,
    };

    try {
      const result = await exportWithEngine(
        doc,
        provider,
        settings,
        controller.signal,
        (p) => setProgress(p),
      );

      const url = URL.createObjectURL(result.blob);
      const cleanName = (doc.name || "mockup").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const filename = `${cleanName}-${doc.aspect.replace(":", "x")}.${format}`;
      setDownloadUrl(url);
      setDownloadFilename(filename);
      setIsExporting(false);
      setProgress(null);
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") {
        setError("Export cancelled.");
      } else {
        setError(err instanceof Error ? err.message : "Export failed");
      }
      setIsExporting(false);
      setProgress(null);
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (isExporting) {
      if (!confirm("Export in progress. Do you want to cancel?")) {
        return;
      }
      handleCancel();
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        title="Export Video"
        description="Render high-fidelity motion video at 1080p resolution."
        className="max-w-md"
      >
        <div className="space-y-4 pt-2">
          {!isExporting && !downloadUrl && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-2)]">Resolution</span>
                <span className="font-mono text-[var(--color-text)]">1080p ({doc.aspect})</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[var(--color-text-2)]">Format</label>
                <Select
                  value={format}
                  onChange={(val) => setFormat(val as "mp4" | "webm")}
                  options={[
                    { value: "mp4", label: "MP4 (H.264 / AVC - Universal)" },
                    { value: "webm", label: "WebM (VP9 - High Efficiency)" },
                  ]}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[var(--color-text-2)]">Frame Rate</label>
                <Select
                  value={String(fps)}
                  onChange={(val) => setFps(Number(val) as 30 | 60)}
                  options={[
                    { value: "30", label: "30 fps (Standard Smooth)" },
                    { value: "60", label: "60 fps (Ultra Smooth)" },
                  ]}
                />
              </div>

              {error && (
                <div className="text-xs text-[var(--color-danger)] p-2 rounded bg-[var(--color-raised)]">
                  {error}
                </div>
              )}

              <div className="pt-2">
                <Button
                  variant="primary"
                  className="w-full justify-center"
                  onClick={handleStartExport}
                  icon={<Icon icon={Film} size={15} />}
                >
                  Start Export
                </Button>
              </div>
            </div>
          )}

          {isExporting && progress && (
            <div className="space-y-3 py-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--color-text)] font-medium capitalize">
                  {progress.stage === "preparing" && "Preparing assets..."}
                  {progress.stage === "rendering" && "Rendering frames..."}
                  {progress.stage === "finishing" && "Finalizing video..."}
                </span>
                <span className="font-mono text-[var(--color-text-2)]">
                  {Math.round(progress.percentage)}%
                </span>
              </div>

              <ProgressBar value={progress.percentage} />

              <div className="flex justify-between items-center text-[11px] text-[var(--color-text-3)] font-mono">
                <span>
                  Frame {progress.frame} / {progress.total}
                </span>
                <span>1080p · {fps}fps</span>
              </div>

              <div className="pt-2">
                <Button
                  variant="secondary"
                  className="w-full justify-center"
                  onClick={handleCancel}
                  icon={<Icon icon={XCircle} size={15} />}
                >
                  Cancel Export
                </Button>
              </div>
            </div>
          )}

          {downloadUrl && (
            <div className="space-y-4 py-2 text-center">
              <div className="text-sm font-medium text-[var(--color-text)]">
                Export Complete!
              </div>
              <p className="text-xs text-[var(--color-text-2)]">
                Your video has been rendered successfully at 1080p.
              </p>

              <div className="flex gap-2">
                <a
                  href={downloadUrl}
                  download={downloadFilename}
                  className="flex-1"
                >
                  <Button
                    variant="primary"
                    className="w-full justify-center"
                    icon={<Icon icon={Download} size={15} />}
                  >
                    Download {format.toUpperCase()}
                  </Button>
                </a>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDownloadUrl(null);
                    setError(null);
                  }}
                >
                  Export Another
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
