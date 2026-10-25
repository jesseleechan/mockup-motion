import React, { useEffect, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, Check, Code2, Copy, Download, RotateCcw } from "lucide-react";
import { Button } from "../../ui";
import type { Aspect } from "../../doc/types";
import type { ExportResult as Result, ExportVerification } from "../../export/engine-export";
import type { ExportExtension } from "../../export/plan";
import { DOWNLOAD_LABELS } from "./download-labels";
import { downloadLink, notice, verificationWell } from "./surfaces";

export interface ExportOutcome {
  aspect: Aspect;
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

/** One exported file as verify.ts re-read it: size, duration, codec, or what is wrong. */
export const VerificationRow: React.FC<{ item: ExportVerification }> = ({ item }) => {
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
          className={`flex items-center gap-1.5 font-semibold ${result.valid ? "text-[var(--color-success)]" : "text-[var(--color-warning)]"}`}
        >
          {result.valid ? <Check size={14} /> : <AlertTriangle size={14} />}
          {result.valid ? `Verified ${label}` : `${label} did not verify`}
        </span>
        <span className="min-w-0 truncate font-num text-[11.5px] tabular-nums text-[var(--color-text-2)]">
          {facts.join(" · ")}
        </span>
      </div>
      {result.warnings.map((w) => (
        <div key={w} className="text-[var(--color-warning)]">
          {w}
        </div>
      ))}
    </div>
  );
};

/** One finished file: Layout Stage's "Export ready" sheet, with the preview on a field well. */
export const ExportResult: React.FC<ExportResultProps> = ({ outcome, onExportAnother }) => {
  const { url, filename, extension, result } = outcome;
  const [copied, setCopied] = useState(false);
  const isVideo = extension === "mp4" || extension === "webm";
  const isImage = extension === "png";

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
        <span className="shrink-0 text-[14px] font-semibold text-[var(--color-text)]">
          Export complete
        </span>
        <span
          className="min-w-0 truncate font-num text-[12px] text-[var(--color-text-2)]"
          title={filename}
          data-truncate=""
        >
          {filename}
        </span>
      </div>

      {(isVideo || isImage) && (
        <div className="aspect-video w-full rounded-[12px] overflow-hidden bg-field p-3 flex items-center justify-center">
          {isVideo ? (
            <video
              src={url}
              controls
              autoPlay
              loop
              muted
              className="max-w-full max-h-full rounded-[3px] shadow-[0_4px_18px_rgb(0_0_0/0.18)]"
            />
          ) : (
            <img
              src={url}
              alt="Exported frame"
              className="max-w-full max-h-full rounded-[3px] shadow-[0_4px_18px_rgb(0_0_0/0.18)]"
            />
          )}
        </div>
      )}

      <div
        data-testid="export-verification"
        className={clsx(
          verificationWell(result.verification.every((v) => v.result.valid)),
          "space-y-2",
        )}
      >
        {result.verification.map((item) => (
          <VerificationRow key={item.label} item={item} />
        ))}
      </div>

      {result.warnings.length > 0 && (
        <div role="status" data-testid="export-warnings" className="space-y-1.5">
          {result.warnings.map((w) => (
            <div key={w} className={notice("warning")}>
              <AlertTriangle size={14} className="shrink-0 mt-px" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {result.bundleSnippet && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[var(--color-text)] flex items-center gap-1.5">
              <Code2 size={14} className="text-[var(--color-text-2)]" />
              Embed code
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={copySnippet}
              icon={
                copied ? (
                  <Check size={12} className="text-[var(--color-success)]" />
                ) : (
                  <Copy size={12} />
                )
              }
            >
              {copied ? "Copied" : "Copy code"}
            </Button>
          </div>
          <pre
            data-scroll-x=""
            className="max-h-32 p-3 rounded-[10px] bg-field text-[11px] font-num text-[var(--color-text-2)] overflow-auto select-all"
          >
            {result.bundleSnippet}
          </pre>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onExportAnother} icon={<RotateCcw size={14} />}>
          Export another
        </Button>
        <a href={url} download={filename} className={downloadLink("md")}>
          <Download size={14} />
          Download {DOWNLOAD_LABELS[extension]}
        </a>
      </div>
    </div>
  );
};
