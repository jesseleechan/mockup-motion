import { useCallback } from "react";
import type { AssetRef } from "../../doc/types";
import { analyzeImage } from "../../assets/roles";
import { validateAndDecodeAsset } from "../../assets/decode";
import { useToast } from "../../ui";
import { useTemplateActions } from "../template-actions";
import { applyCaptures, splitCaptureFiles } from "../library/capture-import";
import { importFile, type ImportFile } from "./read-files";
import { importRole, sortImportFiles, unsupportedMessage } from "./sort-files";

/** The status bar and bottom colour of a phone screenshot, from a downscaled copy. */
async function analyze(
  file: File,
): Promise<Pick<NonNullable<AssetRef["meta"]>, "hasStatusBar" | "bottomColor">> {
  const bmp = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(Math.min(bmp.width, 390), Math.min(bmp.height, 844));
  const ctx = canvas.getContext("2d");
  try {
    if (!ctx) return { hasStatusBar: false, bottomColor: "#000000" };
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const analysis = analyzeImage({
      width: canvas.width,
      height: canvas.height,
      rgba: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
    });
    return { hasStatusBar: analysis.hasStatusBar, bottomColor: analysis.bottomColor };
  } finally {
    bmp.close();
  }
}

function addedMessage(count: number, withSections: number): string {
  const noun = count === 1 ? "screenshot" : "screenshots";
  return withSections > 0 ? `Added ${count} ${noun} with section data.` : `Added ${count} ${noun}.`;
}

/**
 * Imports screenshots and capture files from the file pickers, a drop or a paste: decodes and
 * analyses the images, attaches capture sections, sets roles, and adds them like an upload
 * (filling a template that waits for screenshots). Every file that isn't imported is named in a
 * message.
 */
export function useImportFiles() {
  const { addScreenshots } = useTemplateActions();
  const { toast } = useToast();

  return useCallback(
    async (input: (File | ImportFile)[], options: { announce?: boolean } = {}) => {
      const entries = input.map((f) => (f instanceof File ? importFile(f) : f));
      const sorted = sortImportFiles(entries);
      const { captures, errors } = await splitCaptureFiles(sorted.captures.map((c) => c.file));
      const unsupported = unsupportedMessage(sorted.unsupported);
      if (unsupported) errors.unshift(unsupported);

      const refs: AssetRef[] = [];
      const blobs: Record<string, Blob> = {};
      for (const { file } of sorted.images) {
        try {
          const { ref, blob } = await validateAndDecodeAsset(file, file.name);
          refs.push({ ...ref, meta: { ...ref.meta, ...(await analyze(file)) } });
          blobs[ref.id] = blob;
        } catch (err) {
          errors.push(
            err instanceof Error ? err.message : `${file.name}: this image couldn't be read.`,
          );
        }
      }

      const attached = applyCaptures(refs, captures);
      const added = attached.refs.map((ref) => ({ ...ref, role: importRole(ref, captures) }));
      for (const message of [...errors, ...attached.errors]) toast(message);
      if (added.length === 0) return;
      // Fills the template when it is waiting for screenshots (F06).
      await addScreenshots(added, blobs);
      if (options.announce) {
        toast(addedMessage(added.length, added.filter((r) => r.meta?.sections).length));
      }
    },
    [addScreenshots, toast],
  );
}
