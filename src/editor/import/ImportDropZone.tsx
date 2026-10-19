import React, { useEffect, useState } from "react";
import { FolderDown } from "lucide-react";
import { Icon, useToast } from "../../ui";
import { useEditorStore } from "../../state/store";
import { isTypingTarget } from "../focus";
import { unfilledSlots } from "../template-actions";
import {
  dragHasFiles,
  filesFromDrop,
  imagesFromClipboard,
  isDialogOpen,
  type ImportFile,
} from "./read-files";
import { useImportFiles } from "./use-import-files";

/**
 * Imports files dropped anywhere on the editor window, folders included, and images pasted with
 * ⌘V / Ctrl+V while no field has focus. Shows what a drop will do while files are dragged over.
 */
export const ImportDropZone: React.FC = () => {
  const importFiles = useImportFiles();
  const { toast } = useToast();
  const fillsTemplate = useEditorStore((s) => unfilledSlots(s.doc).length > 0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (!dragHasFiles(e.dataTransfer)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      setDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
      // relatedTarget is null only when the drag leaves the window.
      if (!e.relatedTarget) setDragging(false);
    };
    const onDrop = async (e: DragEvent) => {
      if (!e.dataTransfer || !dragHasFiles(e.dataTransfer)) return;
      e.preventDefault();
      setDragging(false);
      let files: ImportFile[];
      try {
        files = await filesFromDrop(e.dataTransfer);
      } catch (err) {
        console.error("Reading dropped files failed:", err);
        toast(
          `The dropped files couldn't be read${err instanceof Error ? `: ${err.message}` : "."}`,
        );
        return;
      }
      await importFiles(files, { announce: true });
    };
    const onPaste = async (e: ClipboardEvent) => {
      // A dialog or a field keeps its own paste.
      if (isTypingTarget(e.target) || isDialogOpen() || !e.clipboardData) return;
      const files = imagesFromClipboard(e.clipboardData);
      if (files.length === 0) return;
      e.preventDefault();
      await importFiles(files, { announce: true });
    };

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  }, [importFiles, toast]);

  if (!dragging) return null;
  return (
    <div
      data-testid="import-drop-overlay"
      className="fixed inset-0 z-50 pointer-events-none bg-[var(--color-bg)]/80 backdrop-blur-xs flex items-center justify-center p-6 animate-in fade-in duration-100"
    >
      <div className="max-w-sm w-full rounded-xl border-2 border-dashed border-[var(--color-accent)] bg-[var(--color-panel)] px-6 py-7 text-center space-y-3 shadow-2xl">
        <div className="w-12 h-12 mx-auto rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)] flex items-center justify-center">
          <Icon icon={FolderDown} size={26} />
        </div>
        <div className="text-base font-semibold text-[var(--color-text)]">
          {fillsTemplate ? "Drop to fill the template" : "Drop to add to the library"}
        </div>
        <p className="text-xs text-[var(--color-text-2)] leading-relaxed">
          PNG, JPG, WebP, or AVIF screenshots. A captures folder also brings each page’s roles and
          section data.
        </p>
      </div>
    </div>
  );
};
