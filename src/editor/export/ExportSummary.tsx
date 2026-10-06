import React from "react";
import { AlertTriangle } from "lucide-react";
import { formatFileSize } from "../../export/destinations";
import type { ExportPlanResult } from "../../export/plan";

interface ExportSummaryProps {
  probing: boolean;
  plan: ExportPlanResult | null;
}

/**
 * What the export will write, after the encoder probe: container and codec, size, frame
 * rate, duration and the size estimate from the bitrate actually used.
 */
export const ExportSummary: React.FC<ExportSummaryProps> = ({ probing, plan }) => {
  const box =
    "p-3 rounded-lg bg-[var(--color-raised)] border border-[var(--color-line)] text-xs text-[var(--color-text-2)]";

  if (probing || !plan) {
    return (
      <div data-testid="export-summary" className={box} aria-live="polite">
        Checking encoder…
      </div>
    );
  }

  if (!plan.ok) {
    return (
      <div
        data-testid="export-summary"
        role="alert"
        className="p-3 rounded-lg bg-[var(--color-raised)] border border-red-500/40 text-xs text-red-300 flex items-start gap-2"
      >
        <AlertTriangle size={14} className="shrink-0 mt-px" />
        <span>{plan.error}</span>
      </div>
    );
  }

  const { label, width, height, fps, duration, bytes } = plan.plan;
  const details = [
    `${width} × ${height}`,
    fps !== null ? `${fps} fps` : null,
    duration !== null ? `${duration.toFixed(1)} s` : null,
  ].filter(Boolean);

  return (
    <div
      data-testid="export-summary"
      className={`${box} flex items-center justify-between gap-4`}
      aria-live="polite"
    >
      <div className="min-w-0">
        <div className="font-semibold text-[var(--color-text)]">{label}</div>
        <div className="mt-0.5 tabular-nums">{details.join(" · ")}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-semibold tabular-nums text-[var(--color-text)]">
          ≈ {formatFileSize(bytes)}
        </div>
        <div className="mt-0.5">Estimated size</div>
      </div>
    </div>
  );
};
