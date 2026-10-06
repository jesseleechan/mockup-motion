import React, { useEffect, useState } from "react";
import { AlertTriangle, Check, Code2, Copy, Download, RotateCcw } from "lucide-react";
import { Button } from "../../ui";
import type { ExportResult as Result, ExportVerification } from "../../export/engine-export";
import type { ExportExtension } from "../../export/plan";

export interface ExportOutcome {
  url: string;
  filename: string;
  extension: ExportExtension;
  /** Container and codec, e.g. "WebM · VP9". */
  label: string;
  result: Result;
}

interface ExportResultProps {
  outcome: ExportOutcome;
  onExportAnother: () => void;
}

const panel = "p-3 rounded-lg bg-[var(--color-raised)] border text-xs";

const DOWNLOAD_LABELS: Record<ExportExtension, string> = {
  mp4: "MP4",
  webm: "WebM",
  zip: "bundle",
  gif: "GIF",
  png: "PNG",
};

/** One exported file as verify.ts re-read it: size, duration, codec, audio, or what is wrong. */
const VerificationRow: React.FC<{ item: ExportVerification }> = ({ item }) => {
  const { label, result } = item;
  const actual = result.actual;
  const facts = actual
    ? [
        `${actual.width} × ${actual.height}`,
        actual.duration > 0 ? `${actual.duration.toFixed(2)} s` : null,
        actual.codec ?? null,
      ].filter(Boolean)
    : [];
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <span
          className={`flex items-center gap-1.5 font-semibold ${result.valid ? "text-emerald-400" : "text-amber-300"}`}
        >
          {result.valid ? <Check size={14} /> : <AlertTriangle size={14} />}
          {result.valid ? `Verified ${label}` : `${label} did not verify`}
        </span>
        <span className="min-w-0 truncate tabular-nums text-[var(--color-text-2)]">
          {facts.join(" · ")}
        </span>
      </div>
      {actual?.audioDuration !== undefined && (
        <div className="flex justify-between gap-3 text-[var(--color-text-3)]">
          <span data-testid="verify-audio">Audio: {actual.audioDuration.toFixed(2)} s</span>
          <span>{actual.audioCodec}</span>
        </div>
      )}
      {result.warnings.map((w) => (
        <div key={w} className="text-amber-300">
          {w}
        </div>
      ))}
    </div>
  );
};

export const ExportResult: React.FC<ExportResultProps> = ({ outcome, onExportAnother }) => {
  const { url, filename, extension, result } = outcome;
  const [copied, setCopied] = useState(false);
  const isVideo = extension === "mp4" || extension === "webm";
  const isImage = extension === "gif" || extension === "png";

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copySnippet = async () => {
    if (!result.bundleSnippet) return;
    await navigator.clipboard.writeText(result.bundleSnippet);
    setCopied(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <span className="shrink-0 text-sm font-semibold text-[var(--color-text)]">
          Export complete
        </span>
        <span
          className="min-w-0 truncate text-xs text-[var(--color-text-3)]"
          title={filename}
          data-truncate=""
        >
          {filename}
        </span>
      </div>

      {(isVideo || isImage) && (
        <div className="aspect-video w-full rounded-lg overflow-hidden bg-black/60 border border-[var(--color-line)] flex items-center justify-center">
          {isVideo ? (
            <video
              src={url}
              controls
              autoPlay
              loop
              muted
              className="w-full h-full object-contain"
            />
          ) : (
            <img src={url} alt="Exported frame" className="max-h-full object-contain" />
          )}
        </div>
      )}

      <div
        data-testid="export-verification"
        className={`${panel} space-y-2 ${result.verification.every((v) => v.result.valid) ? "border-[var(--color-line)]" : "border-amber-500/30"}`}
      >
        {result.verification.map((item) => (
          <VerificationRow key={item.label} item={item} />
        ))}
      </div>

      {result.warnings.length > 0 && (
        <div
          role="status"
          data-testid="export-warnings"
          className={`${panel} border-amber-500/30 text-amber-300 space-y-1`}
        >
          {result.warnings.map((w) => (
            <div key={w} className="flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-px" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {result.bundleSnippet && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-text)] flex items-center gap-1.5">
              <Code2 size={14} className="text-[var(--color-accent)]" />
              Embed code
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={copySnippet}
              icon={copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            >
              {copied ? "Copied" : "Copy code"}
            </Button>
          </div>
          <pre
            data-scroll-x=""
            className="max-h-32 p-3 rounded-lg bg-[var(--color-raised)] border border-[var(--color-line)] text-[11px] font-mono text-[var(--color-text-2)] overflow-auto select-all"
          >
            {result.bundleSnippet}
          </pre>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onExportAnother} icon={<RotateCcw size={14} />}>
          Export another
        </Button>
        <a
          href={url}
          download={filename}
          role="button"
          className="inline-flex items-center justify-center h-8 px-3.5 rounded-md text-[13px] font-semibold bg-[var(--color-text)] text-[var(--color-bg)] hover:opacity-90 transition-opacity gap-2"
        >
          <Download size={14} />
          Download {DOWNLOAD_LABELS[extension]}
        </a>
      </div>
    </div>
  );
};
