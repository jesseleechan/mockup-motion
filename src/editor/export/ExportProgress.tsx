import React from "react";
import { Film, XCircle } from "lucide-react";
import { Button, ProgressBar } from "../../ui";
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

export const ExportProgress: React.FC<ExportProgressProps> = ({ progress, label, onCancel }) => (
  <div className="py-8 space-y-4 text-center">
    <div className="inline-flex p-3 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
      <Film size={28} />
    </div>
    <div>
      <h3 className="text-sm font-semibold text-[var(--color-text)]" aria-live="polite">
        {stageText(progress)}
      </h3>
      <p className="mt-1 text-xs text-[var(--color-text-3)] tabular-nums">
        {label} · {progress.percentage}%
      </p>
    </div>
    <div className="max-w-xs mx-auto">
      <ProgressBar value={progress.percentage} aria-label="Export progress" />
    </div>
    <div className="pt-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={onCancel}
        icon={<XCircle size={14} />}
        className="text-red-400 hover:text-red-300"
      >
        Cancel export
      </Button>
    </div>
  </div>
);
