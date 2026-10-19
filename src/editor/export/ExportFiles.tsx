import React from "react";
import { Download, RotateCcw } from "lucide-react";
import { Button } from "../../ui";
import { DOWNLOAD_LABELS } from "./download-labels";
import { panel, VerificationRow, type ExportOutcome } from "./ExportResult";

const downloadLink =
  "inline-flex shrink-0 items-center justify-center h-7 px-3 rounded-md text-[12px] font-semibold bg-[var(--color-text)] text-[var(--color-bg)] hover:opacity-90 transition-opacity gap-1.5";

interface FileListProps {
  outcomes: readonly ExportOutcome[];
}

/** Finished files of an export with several sizes, each verified and ready to download. */
export const FileList: React.FC<FileListProps> = ({ outcomes }) => (
  <ul data-testid="export-files" className="space-y-2">
    {outcomes.map((outcome) => (
      <li
        key={outcome.aspect}
        className={`${panel} space-y-2 ${outcome.result.verification.every((v) => v.result.valid) ? "border-[var(--color-line)]" : "border-amber-500/30"}`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate" title={outcome.filename} data-truncate="">
            <span className="font-semibold text-[var(--color-text)]">{outcome.aspect}</span>
            <span className="text-[var(--color-text-3)]"> · {outcome.filename}</span>
          </span>
          <a href={outcome.url} download={outcome.filename} className={downloadLink}>
            <Download size={12} />
            Download {outcome.aspect} {DOWNLOAD_LABELS[outcome.extension]}
          </a>
        </div>
        {outcome.result.verification.map((item) => (
          <VerificationRow key={item.label} item={item} />
        ))}
        {outcome.result.warnings.map((w) => (
          <div key={w} className="text-amber-300">
            {w}
          </div>
        ))}
      </li>
    ))}
  </ul>
);

interface ExportFilesProps {
  outcomes: readonly ExportOutcome[];
  total: number;
  onExportAnother: () => void;
}

/** The result of an export with several sizes. */
export const ExportFiles: React.FC<ExportFilesProps> = ({ outcomes, total, onExportAnother }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-semibold text-[var(--color-text)]">
        {outcomes.length === total ? "Export complete" : `${outcomes.length} of ${total} files`}
      </span>
      {outcomes.some((o) => o.extension === "zip") && (
        <span className="min-w-0 truncate text-xs text-[var(--color-text-3)]">
          Each bundle has its embed code in embed.html
        </span>
      )}
    </div>
    <FileList outcomes={outcomes} />
    <div className="flex justify-end pt-2">
      <Button variant="secondary" onClick={onExportAnother} icon={<RotateCcw size={14} />}>
        Export another
      </Button>
    </div>
  </div>
);
