import { useEffect, useRef, useState } from "react";
import {
  Download,
  Check,
  Film,
  Image,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";
import type {
  Project,
  ExportSettings,
  ExportResult,
  ExportProgress,
} from "../types";
import type { VideoCapability } from "../export/video";
import { outputDimensions } from "../rendering/geometry";
import { Modal } from "./Modal";
import { Select, Segments } from "./Controls";
export function ExportDialog({
  project,
  time,
  onSettings,
  onClose,
  onBusy,
}: {
  project: Project;
  time: number;
  onSettings: (s: ExportSettings) => void;
  onClose: () => void;
  onBusy: (b: boolean) => void;
}) {
  const [kind, setKind] = useState<"video" | "png">("video"),
    [capability, setCapability] = useState<VideoCapability | null>(null),
    [checking, setChecking] = useState(true),
    [error, setError] = useState(""),
    [result, setResult] = useState<ExportResult | null>(null),
    [progress, setProgress] = useState<ExportProgress | null>(null),
    [cancelled, setCancelled] = useState(false);
  const controller = useRef<AbortController | null>(null),
    resultUrl = useRef("");
  const settings = project.exportSettings,
    { width, height } = outputDimensions(
      project.aspectRatio,
      settings.resolution,
    );
  useEffect(() => {
    let live = true;
    setChecking(true);
    setCapability(null);
    setError("");
    import("../export/video")
      .then((m) => m.probeExport(project))
      .then((c) => {
        if (live) setCapability(c);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setChecking(false);
      });
    return () => {
      live = false;
    };
  }, [project.aspectRatio, settings]);
  useEffect(
    () => () => {
      controller.current?.abort();
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    },
    [],
  );
  const change = (s: Partial<ExportSettings>) =>
    onSettings({ ...settings, ...s });
  const close = () => {
    controller.current?.abort();
    onBusy(false);
    onClose();
  };
  const start = async () => {
    setError("");
    setCancelled(false);
    onBusy(true);
    const abort = new AbortController();
    controller.current = abort;
    setProgress({
      stage: "preparing",
      percentage: 0,
      currentFrame: 0,
      totalFrames: 0,
    });
    try {
      const m = await import("../export/video");
      const output =
        kind === "png"
          ? await m.exportPng(project, time)
          : await m.exportVideo(
              project,
              capability!,
              abort.signal,
              setProgress,
            );
      if (abort.signal.aborted) {
        URL.revokeObjectURL(output.url);
        return;
      }
      resultUrl.current = output.url;
      setResult(output);
    } catch (e) {
      if (abort.signal.aborted) setCancelled(true);
      else setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setProgress(null);
      onBusy(false);
      controller.current = null;
    }
  };
  return (
    <Modal
      title={result ? "Ready for its close-up." : "Export your presentation"}
      onClose={close}
    >
      {result ? (
        <div className="export-complete">
          <div className="success-mark">
            <Check size={22} />
          </div>
          {result.extension === "png" ? (
            <img src={result.url} alt="Exported presentation" />
          ) : (
            <video src={result.url} controls autoPlay loop muted playsInline />
          )}
          <p>
            {result.width} × {result.height}
            {result.fps
              ? ` · ${result.fps} FPS · ${result.duration}s`
              : ""} · {result.extension.toUpperCase()} ·{" "}
            {(result.size / 1024 / 1024).toFixed(1)} MB
          </p>
          <a
            className="primary-button"
            href={result.url}
            download={result.filename}
          >
            <Download size={16} />
            Download {result.extension.toUpperCase()}
          </a>
          <button className="subtle-button" onClick={close}>
            Back to editor
          </button>
        </div>
      ) : progress ? (
        <div className="export-progress">
          <LoaderCircle className="spin" size={32} />
          <h3>
            {progress.stage === "preparing"
              ? "Preparing your presentation…"
              : progress.stage === "finishing"
                ? "Finishing your video…"
                : "Bringing your work to life…"}
          </h3>
          <progress max={100} value={progress.percentage} />
          <div className="progress-label">
            <span>{progress.percentage}%</span>
            <span>
              {progress.currentFrame} / {progress.totalFrames} frames
            </span>
          </div>
          <button
            className="subtle-button"
            onClick={() => controller.current?.abort()}
          >
            Cancel export
          </button>
        </div>
      ) : (
        <>
          <p className="modal-description">
            Beautiful, shareable, and completely yours.
          </p>
          <Segments
            label="Export type"
            value={kind}
            options={[
              { value: "video", label: "Video" },
              { value: "png", label: "Current frame · PNG" },
            ]}
            onChange={(v) => setKind(v as "video" | "png")}
          />
          <div className="export-settings">
            <Select
              label="Resolution"
              value={settings.resolution}
              options={[
                { value: 720, label: "720p · Smaller file" },
                { value: 1080, label: "1080p · Full quality" },
              ]}
              onChange={(v) => change({ resolution: Number(v) as 720 | 1080 })}
            />
            {kind === "video" && (
              <>
                <Select
                  label="Frame rate"
                  value={settings.fps}
                  options={[
                    { value: 30, label: "30 FPS" },
                    { value: 60, label: "60 FPS" },
                  ]}
                  onChange={(v) => change({ fps: Number(v) as 30 | 60 })}
                />
                <Select
                  label="Quality"
                  value={settings.quality}
                  options={[
                    { value: "standard", label: "Standard" },
                    { value: "high", label: "High" },
                  ]}
                  onChange={(v) =>
                    change({ quality: v as "standard" | "high" })
                  }
                />
                <Select
                  label="Format"
                  value={settings.format}
                  options={[
                    { value: "mp4", label: "MP4" },
                    { value: "webm", label: "WebM" },
                  ]}
                  onChange={(v) => change({ format: v as "mp4" | "webm" })}
                />
              </>
            )}
          </div>
          <div className="export-summary">
            {kind === "video" ? <Film size={18} /> : <Image size={18} />}
            <span>
              {width} × {height}
              {kind === "video"
                ? ` · ${settings.fps} FPS · ${project.composition.motion.duration}s · ${capability?.format.toUpperCase() ?? "Checking…"}`
                : " · PNG"}
            </span>
          </div>
          {kind === "video" &&
            capability?.format !== settings.format &&
            capability && (
              <p className="notice">
                MP4 isn’t available with these settings in this browser. Your
                video will export as WebM.
              </p>
            )}
          {kind === "video" && capability?.method === "recorder" && (
            <p className="notice">
              This browser records in real time. Keep this tab visible during
              export.
            </p>
          )}
          {error && (
            <p role="alert" className="error-message">
              <AlertCircle size={16} />
              {error}
            </p>
          )}
          {cancelled && (
            <p role="status" className="notice">
              Export cancelled. Your project is ready to edit.
            </p>
          )}
          <button
            className="primary-button export-start"
            disabled={kind === "video" && (checking || !capability)}
            onClick={start}
          >
            {checking && kind === "video" ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Download size={16} />
            )}
            Export{" "}
            {kind === "png"
              ? "PNG"
              : (capability?.format.toUpperCase() ?? "video")}
          </button>
          <p className="privacy-note">
            Rendered on your device. No uploads, no watermark.
          </p>
        </>
      )}
    </Modal>
  );
}
