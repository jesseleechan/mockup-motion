import React from "react";
import clsx from "clsx";
import { Download, RotateCcw } from "lucide-react";
import { Button } from "../../ui";
import { DOWNLOAD_LABELS } from "./download-labels";
import { VerificationRow, type ExportOutcome } from "./ExportResult";
import { downloadLink, verificationWell } from "./surfaces";

interface FileListProps {
  outcomes: readonly ExportOutcome[];
}

/** Finished files of an export with several sizes, each verified and ready to download. */
export const FileList: React.FC<FileListProps> = ({ outcomes }) => (
  <ul data-testid="export-files" className="space-y-2">
    {outcomes.map((outcome) => (
      <li
        key={outcome.aspect}
        className={clsx(
          verificationWell(outcome.result.verification.every((v) => v.result.valid)),
          "space-y-2",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate" title={outcome.filename} data-truncate="">
            <span className="font-semibold text-[var(--color-text)]">{outcome.aspect}</span>
            <span className="font-num text-[11.5px]"> · {outcome.filename}</span>
          </span>
          <a href={outcome.url} download={outcome.filename} className={downloadLink("sm")}>
            <Download size={12} />
            Download {outcome.aspect} {DOWNLOAD_LABELS[outcome.extension]}
          </a>
        </div>
        {outcome.result.verification.map((item) => (
          <VerificationRow key={item.label} item={item} />
        ))}
        {outcome.result.warnings.map((w) => (
          <div key={w} className="text-[var(--color-warning)]">
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
      <span className="text-[14px] font-semibold text-[var(--color-text)]">
        {outcomes.length === total ? "Export complete" : `${outcomes.length} of ${total} files`}
      </span>
      {outcomes.some((o) => o.extension === "zip") && (
        <span className="min-w-0 truncate text-[12px] text-[var(--color-text-2)]">
          Each bundle has its embed code in embed.html
        </span>
      )}
    </div>
    <FileList outcomes={outcomes} />
    <div className="flex justify-end pt-1">
      <Button variant="secondary" onClick={onExportAnother} icon={<RotateCcw size={14} />}>
        Export another
      </Button>
    </div>
  </div>
);
