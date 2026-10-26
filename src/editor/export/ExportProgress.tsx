import React from "react";
import { Film, XCircle } from "lucide-react";
import { Button, Icon, ProgressBar } from "../../ui";
import type { ExportProgress as Progress } from "../../export/engine-export";

interface ExportProgressProps {
  progress: Progress;
  label: string;
  onCancel: () => void;
}

function stageText(progress: Progress): string {
  if (progress.stage === "preparing") return "Preparing assets…";
  if (progress.stage === "finishing") return "Finishing…";
  // Frames are counted from 0; show the one being rendered, 1-based.
  const frame = `frame ${Math.min(progress.frame + 1, progress.total)} of ${progress.total}`;
  return progress.part ? `Rendering ${progress.part}, ${frame}` : `Rendering ${frame}`;
}

/** The render in progress: a paper tile with the film icon, what is rendering, and the bar. */
export const ExportProgress: React.FC<ExportProgressProps> = ({ progress, label, onCancel }) => (
  <div className="py-8 flex flex-col items-center gap-4 text-center">
    <div className="w-11 h-11 grid place-items-center rounded-[12px] bg-paper shadow-lift-sm text-[var(--color-text-2)]">
      <Icon icon={Film} size={20} />
    </div>
    <div>
      <h3 className="text-[14px] font-semibold text-[var(--color-text)]" aria-live="polite">
        {stageText(progress)}
      </h3>
      <p className="mt-1 text-[12px] text-[var(--color-text-2)] tabular-nums">
        {label} · {progress.percentage}%
      </p>
    </div>
    <div className="w-full max-w-xs">
      <ProgressBar value={progress.percentage} aria-label="Export progress" />
    </div>
    <Button
      variant="ghost"
      size="sm"
      onClick={onCancel}
      icon={<XCircle size={14} />}
      // Important, so it wins over the ghost variant's own text colours, hover included.
      className="text-[var(--color-danger)]!"
    >
      Cancel export
    </Button>
  </div>
);
