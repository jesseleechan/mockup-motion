import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  ProgressBar,
  Select,
  Switch,
  Field,
} from "../../ui";
import { useEditorStore } from "../../state/store";
import { createEditorAssetProvider } from "../asset-provider";
import {
  exportWithEngine,
  type ExportProgress,
} from "../../export/engine-export";
import {
  DESTINATION_PRESETS,
  estimateFileSize,
  formatFileSize,
  outputDimensions,
} from "../../export/destinations";
import { probeVideoEncoders, type CodecProbeResult } from "../../export/probe";
import { verifyExportBlob, type VerifyExportResult } from "../../export/verify";
import { schedule } from "../../motion";
import type {
  DestinationId,
  ExportFormat,
  ExportQuality,
  ExportSettings,
} from "../../doc/types";
import {
  AlertTriangle,
  Check,
  Code2,
  Copy,
  Download,
  Film,
  Globe,
  Monitor,
  Play,
  RotateCcw,
  Share2,
  Smartphone,
  Sparkles,
  XCircle,
} from "lucide-react";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ open, onOpenChange }) => {
  const doc = useEditorStore((s) => s.doc);
  const apply = useEditorStore((s) => s.apply);

  const { total: duration } = useMemo(() => schedule(doc), [doc]);

  // Destination and settings state
  const [destination, setDestination] = useState<DestinationId>("web-embed");
  const [resolution, setResolution] = useState<number>(1080);
  const [fps, setFps] = useState<number>(30);
  const [quality, setQuality] = useState<ExportQuality>("high");
  const [format, setFormat] = useState<ExportFormat>("mp4");
  const [supersample, setSupersample] = useState<number>(1.0);
  const [motionBlur, setMotionBlur] = useState<boolean>(false);

  // Runtime and probe state
  const [probeResult, setProbeResult] = useState<CodecProbeResult | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadFilename, setDownloadFilename] = useState<string>("");
  const [embedSnippet, setEmbedSnippet] = useState<string | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const activeObjectUrlRef = useRef<string | null>(null);

  // Computed dimensions
  const dims = useMemo(
    () => outputDimensions(doc.aspect, resolution),
    [doc.aspect, resolution],
  );

  // Estimated file size
  const estimatedBytes = useMemo(() => {
    return estimateFileSize(
      {
        destination,
        resolution,
        fps,
        quality,
        format,
        supersample,
        motionBlur,
      },
      doc.aspect,
      duration,
    );
  }, [destination, resolution, fps, quality, format, supersample, motionBlur, doc.aspect, duration]);

  // Sync settings when selecting a destination preset
  const handleSelectDestination = (destId: DestinationId) => {
    setDestination(destId);
    const preset = DESTINATION_PRESETS[destId];
    if (!preset) return;

    setResolution(preset.resolution);
    setFps(preset.fps);
    setQuality(preset.quality);
    setFormat(preset.format);
    setSupersample(preset.supersample);
    setMotionBlur(preset.motionBlur);
  };

  // Run encoder probe whenever resolution or quality changes
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    probeVideoEncoders({
      width: dims.width,
      height: dims.height,
      fps,
      quality,
    }).then((res) => {
      if (!cancelled) setProbeResult(res);
    });

    return () => {
      cancelled = true;
    };
  }, [open, dims.width, dims.height, fps, quality]);

  // Clean up object URLs on unmount or reset
  const cleanupObjectUrl = () => {
    if (activeObjectUrlRef.current) {
      URL.revokeObjectURL(activeObjectUrlRef.current);
      activeObjectUrlRef.current = null;
    }
  };

  const handleStartExport = async () => {
    cleanupObjectUrl();
    setIsExporting(true);
    setProgress({ stage: "preparing", frame: 0, total: 1, percentage: 0 });
    setError(null);
    setDownloadUrl(null);
    setEmbedSnippet(null);
    setVerifyResult(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const provider = createEditorAssetProvider();
    const settings: ExportSettings = {
      destination,
      resolution,
      fps,
      quality,
      format,
      supersample,
      motionBlur,
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
      activeObjectUrlRef.current = url;

      const cleanName = (doc.name || "mockup")
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-");

      const ext =
        format === "bundle"
          ? "zip"
          : format === "gif"
          ? "gif"
          : format === "png"
          ? "png"
          : format === "webm"
          ? "webm"
          : "mp4";

      const filename = `${cleanName}-${doc.aspect.replace(":", "x")}.${ext}`;

      setDownloadUrl(url);
      setDownloadFilename(filename);
      if (result.bundleSnippet) {
        setEmbedSnippet(result.bundleSnippet);
      }

      // Run post-export verification for video formats
      if (format === "mp4" || format === "webm") {
        const codec = format === "webm" ? "vp9" : "avc";
        verifyExportBlob(result.blob, {
          width: dims.width,
          height: dims.height,
          duration,
          fps,
          codec,
        }).then(setVerifyResult);
      }

      setIsExporting(false);
      setProgress(null);
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError" || (err as Error).message.includes("aborted")) {
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
      abortControllerRef.current = null;
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (isExporting) {
      if (!confirm("Export is currently rendering. Do you want to cancel?")) {
        return;
      }
      handleCancel();
    }
    if (!nextOpen) {
      cleanupObjectUrl();
      setDownloadUrl(null);
      setError(null);
      setProgress(null);
    }
    onOpenChange(nextOpen);
  };

  const handleCopySnippet = () => {
    if (!embedSnippet) return;
    navigator.clipboard.writeText(embedSnippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const destinationCards: { id: DestinationId; label: string; icon: React.ComponentType<{ size: number; className?: string }> }[] = [
    { id: "web-embed", label: "Web Embed", icon: Globe },
    { id: "dribbble", label: "Dribbble", icon: Film },
    { id: "instagram-feed", label: "Instagram Feed", icon: Smartphone },
    { id: "instagram-story", label: "Stories & Reels", icon: Play },
    { id: "linkedin", label: "LinkedIn / X", icon: Share2 },
    { id: "presentation-4k", label: "4K Keynote", icon: Monitor },
    { id: "custom", label: "Custom", icon: Sparkles },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-[var(--color-bg)] border border-[var(--color-line)] shadow-2xl rounded-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--color-line)] bg-[var(--color-panel)] flex items-center justify-between">
          <div>
            <DialogTitle className="text-base font-semibold text-[var(--color-text)] flex items-center gap-2">
              <Download size={18} className="text-[var(--color-accent)]" />
              Export Video
            </DialogTitle>
            <DialogDescription className="text-xs text-[var(--color-text-2)] mt-0.5">
              Production-ready renders tuned for web, social media, and presentations.
            </DialogDescription>
          </div>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Destination Cards */}
          {!isExporting && !downloadUrl && (
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-3)] mb-2 block">
                Destination Preset
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {destinationCards.map((card) => {
                  const IconComp = card.icon;
                  const isSelected = destination === card.id;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => handleSelectDestination(card.id)}
                      className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition-all ${
                        isSelected
                          ? "border-[var(--color-accent)] bg-[var(--color-raised)] ring-2 ring-[var(--color-accent)]/20 shadow-xs"
                          : "border-[var(--color-line)] bg-[var(--color-panel)] hover:border-[var(--color-line-strong)] hover:bg-[var(--color-raised)]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <IconComp
                          size={16}
                          className={isSelected ? "text-[var(--color-accent)]" : "text-[var(--color-text-2)]"}
                        />
                        {isSelected && <Check size={12} className="text-[var(--color-accent)]" />}
                      </div>
                      <span className="text-xs font-semibold text-[var(--color-text)] block">
                        {card.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Aspect Ratio Mismatch Alert & Quick Fix */}
              {DESTINATION_PRESETS[destination]?.aspect !== doc.aspect && destination !== "custom" && (
                <div className="mt-2.5 p-2.5 rounded-lg bg-[var(--color-raised)] border border-[var(--color-line)] flex items-center justify-between text-xs">
                  <div className="text-[var(--color-text-2)]">
                    Preset recommends <strong>{DESTINATION_PRESETS[destination].aspect}</strong> (current: {doc.aspect})
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      apply(
                        (draft) => {
                          draft.aspect = DESTINATION_PRESETS[destination].aspect;
                        },
                        { label: `Change aspect to ${DESTINATION_PRESETS[destination].aspect}` },
                      )
                    }
                    className="text-[11px] h-7"
                  >
                    Switch to {DESTINATION_PRESETS[destination].aspect}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Settings Row */}
          {!isExporting && !downloadUrl && (
            <div className="space-y-4 pt-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-3)] block">
                Encoding Settings
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* Format */}
                <Field label="Format">
                  <Select
                    value={format}
                    onChange={(v) => setFormat(v as ExportFormat)}
                    options={[
                      { value: "mp4", label: "MP4 (H.264)" },
                      { value: "webm", label: "WebM (VP9)" },
                      { value: "bundle", label: "Web Bundle (.zip)" },
                      { value: "gif", label: "Animated GIF" },
                      { value: "png", label: "Still Frame (.png)" },
                    ]}
                  />
                </Field>

                {/* Resolution */}
                <Field label="Resolution">
                  <Select
                    value={String(resolution)}
                    onChange={(v) => setResolution(Number(v))}
                    options={[
                      { value: "720", label: "720p (HD)" },
                      { value: "1080", label: "1080p (FHD)" },
                      { value: "1440", label: "1440p (2K)" },
                      { value: "2160", label: "2160p (4K UHD)" },
                    ]}
                  />
                </Field>

                {/* Frame Rate */}
                <Field label="Frame Rate">
                  <Select
                    value={String(fps)}
                    onChange={(v) => setFps(Number(v))}
                    options={[
                      { value: "15", label: "15 fps (GIF)" },
                      { value: "24", label: "24 fps (Film)" },
                      { value: "30", label: "30 fps (Web)" },
                      { value: "60", label: "60 fps (Smooth)" },
                    ]}
                  />
                </Field>

                {/* Quality */}
                <Field label="Quality Bitrate">
                  <Select
                    value={quality}
                    onChange={(v) => setQuality(v as ExportQuality)}
                    options={[
                      { value: "web", label: "Web (6 Mbps)" },
                      { value: "high", label: "High (16 Mbps)" },
                      { value: "master", label: "Master (28 Mbps)" },
                    ]}
                  />
                </Field>

                {/* Supersample */}
                <Field label="Anti-Aliasing">
                  <Select
                    value={String(supersample)}
                    onChange={(v) => setSupersample(Number(v))}
                    options={[
                      { value: "1", label: "1.0× (Standard)" },
                      { value: "1.5", label: "1.5× (Crisp)" },
                      { value: "2", label: "2.0× (Retina)" },
                    ]}
                  />
                </Field>

                {/* Motion Blur */}
                <div className="flex items-center justify-between pt-5 px-1">
                  <span className="text-xs font-medium text-[var(--color-text-2)]">
                    Motion Blur
                  </span>
                  <Switch aria-label="Motion Blur" checked={motionBlur} onCheckedChange={setMotionBlur} />
                </div>
              </div>

              {/* Encoder Fallback Warning */}
              {probeResult?.fallbackMessage && (
                <div className="p-3 rounded-lg bg-[var(--color-raised)] border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>{probeResult.fallbackMessage}</span>
                </div>
              )}

              {/* Summary Line */}
              <div className="p-3 rounded-lg bg-[var(--color-raised)] border border-[var(--color-line)] flex items-center justify-between text-xs text-[var(--color-text-2)] font-mono">
                <span>
                  {dims.width} × {dims.height} · {fps} fps · {duration.toFixed(1)}s · {format.toUpperCase()}
                </span>
                <span className="text-[var(--color-text)] font-semibold">
                  ≈ {formatFileSize(estimatedBytes)}
                </span>
              </div>
            </div>
          )}

          {/* Exporting Progress */}
          {isExporting && progress && (
            <div className="py-8 space-y-4 text-center">
              <div className="inline-flex p-3 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] animate-pulse">
                <Film size={28} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text)] capitalize">
                  {progress.stage === "preparing"
                    ? "Decoding and rasterizing assets..."
                    : progress.stage === "rendering"
                    ? `Rendering frame ${progress.frame} of ${progress.total}`
                    : "Finalizing and multiplexing output..."}
                </h4>
                <p className="text-xs text-[var(--color-text-3)] font-mono mt-1">
                  {progress.percentage}% complete
                </p>
              </div>

              <div className="max-w-xs mx-auto">
                <ProgressBar value={progress.percentage} />
              </div>

              <div className="pt-2">
                <Button variant="ghost" size="sm" onClick={handleCancel} className="text-red-400 hover:text-red-300">
                  <XCircle size={14} className="mr-1" />
                  Cancel Export
                </Button>
              </div>
            </div>
          )}

          {/* Result View */}
          {downloadUrl && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--color-text)]">
                  Export Complete!
                </span>
                <span className="text-xs text-[var(--color-text-3)] font-mono">
                  {downloadFilename}
                </span>
              </div>
              <div className="aspect-video w-full rounded-lg overflow-hidden bg-black/60 border border-[var(--color-line)] flex items-center justify-center">
                {format === "mp4" || format === "webm" ? (
                  <video
                    src={downloadUrl}
                    controls
                    autoPlay
                    loop
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img
                    src={downloadUrl}
                    alt="Export preview"
                    className="max-h-full object-contain"
                  />
                )}
              </div>

              {/* Verification Info */}
              {verifyResult && (
                <div className="p-3 rounded-lg bg-[var(--color-raised)] border border-[var(--color-line)] text-xs font-mono space-y-1">
                  <div className="flex items-center justify-between text-[var(--color-text)] font-semibold">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <Check size={14} />
                      Verified Output
                    </span>
                    <span>
                      {verifyResult.actual?.width} × {verifyResult.actual?.height}
                    </span>
                  </div>
                  <div className="text-[var(--color-text-3)] flex justify-between">
                    <span>Duration: {verifyResult.actual?.duration.toFixed(2)}s</span>
                    <span>Codec: {verifyResult.actual?.codec || "Verified"}</span>
                  </div>
                </div>
              )}

              {/* Embed Snippet Box for Bundle */}
              {embedSnippet && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--color-text)] flex items-center gap-1.5">
                      <Code2 size={14} className="text-[var(--color-accent)]" />
                      HTML Video Embed Code
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCopySnippet}
                      className="text-xs h-7 gap-1"
                    >
                      {copiedSnippet ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      {copiedSnippet ? "Copied" : "Copy Code"}
                    </Button>
                  </div>
                  <pre className="p-3 rounded-lg bg-[var(--color-raised)] border border-[var(--color-line)] text-[11px] font-mono text-[var(--color-text-2)] overflow-x-auto select-all">
                    {embedSnippet}
                  </pre>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setDownloadUrl(null)}>
                  <RotateCcw size={14} className="mr-1" />
                  Export Another
                </Button>
                <a
                  href={downloadUrl}
                  download={downloadFilename}
                  role="button"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity gap-1.5"
                >
                  <Download size={14} />
                  Download {format === "bundle" ? ".ZIP Bundle" : downloadFilename}
                </a>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isExporting && !downloadUrl && (
          <div className="px-6 py-3.5 border-t border-[var(--color-line)] bg-[var(--color-panel)] flex items-center justify-between">
            <Button variant="ghost" onClick={() => handleClose(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              aria-label="Start Export"
              onClick={handleStartExport}
              className="gap-1.5"
            >
              <Download size={14} />
              Render & Export
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
