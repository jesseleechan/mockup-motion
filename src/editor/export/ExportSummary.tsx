import React from "react";
import { AlertTriangle } from "lucide-react";
import { formatFileSize } from "../../export/destinations";
import type { ExportPlan } from "../../export/plan";
import type { PlannedFile } from "./useExportPlan";

interface ExportSummaryProps {
  probing: boolean;
  plans: PlannedFile[] | null;
}

function detailsOf({ width, height, fps, duration }: ExportPlan): string {
  return [
    `${width} × ${height}`,
    fps !== null ? `${fps} fps` : null,
    duration !== null ? `${duration.toFixed(1)} s` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * What the export will write, after the encoder probe: container and codec, size, frame
 * rate, duration and the size estimate from the bitrate actually used.
 */
export const ExportSummary: React.FC<ExportSummaryProps> = ({ probing, plans }) => {
  const box =
    "p-3 rounded-lg bg-[var(--color-raised)] border border-[var(--color-line)] text-xs text-[var(--color-text-2)]";

  if (probing || !plans) {
    return (
      <div data-testid="export-summary" className={box} aria-live="polite">
        Checking encoder…
      </div>
    );
  }

  const failed = plans.find((f) => !f.plan.ok)?.plan;
  if (failed && !failed.ok) {
    return (
      <div
        data-testid="export-summary"
        role="alert"
        className="p-3 rounded-lg bg-[var(--color-raised)] border border-red-500/40 text-xs text-red-300 flex items-start gap-2"
      >
        <AlertTriangle size={14} className="shrink-0 mt-px" />
        <span>{failed.error}</span>
      </div>
    );
  }

  const files = plans.flatMap((f) => (f.plan.ok ? [{ aspect: f.aspect, plan: f.plan.plan }] : []));

  if (files.length > 1) {
    const total = files.reduce((sum, f) => sum + f.plan.bytes, 0);
    return (
      <div data-testid="export-summary" className={`${box} space-y-1.5`} aria-live="polite">
        {files.map(({ aspect, plan }) => (
          <div key={aspect} className="flex items-center justify-between gap-4">
            <div className="min-w-0 truncate tabular-nums">
              <span className="font-semibold text-[var(--color-text)]">{aspect}</span> ·{" "}
              {plan.label} · {detailsOf(plan)}
            </div>
            <div className="shrink-0 tabular-nums">≈ {formatFileSize(plan.bytes)}</div>
          </div>
        ))}
        <div className="pt-1.5 border-t border-[var(--color-line)] flex justify-between gap-4">
          <span>{files.length} files, one after another</span>
          <span className="font-semibold tabular-nums text-[var(--color-text)]">
            ≈ {formatFileSize(total)}
          </span>
        </div>
      </div>
    );
  }

  const { label, bytes } = files[0].plan;

  return (
    <div
      data-testid="export-summary"
      className={`${box} flex items-center justify-between gap-4`}
      aria-live="polite"
    >
      <div className="min-w-0">
        <div className="font-semibold text-[var(--color-text)]">{label}</div>
        <div className="mt-0.5 tabular-nums">{detailsOf(files[0].plan)}</div>
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
