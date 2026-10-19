import type { AssetRef } from "../../doc/types";
import { attachCaptures, parseCaptureJson, type CaptureFile } from "../../assets/capture-json";
import { useEditorStore } from "../../state/store";

/** The file input `accept` list: screenshots, plus the JSON files `npm run capture` writes. */
export const SCREENSHOT_ACCEPT =
  "image/png,image/jpeg,image/webp,image/avif,application/json,.json";

function isJsonFile(file: File): boolean {
  return file.type === "application/json" || file.name.toLowerCase().endsWith(".json");
}

/**
 * Splits an import into screenshots and capture JSON files. A JSON file that isn't a capture
 * becomes an error message; nothing is dropped silently.
 */
export async function splitCaptureFiles(
  files: File[],
): Promise<{ images: File[]; captures: CaptureFile[]; errors: string[] }> {
  const images: File[] = [];
  const captures: CaptureFile[] = [];
  const errors: string[] = [];
  for (const file of files) {
    if (!isJsonFile(file)) {
      images.push(file);
      continue;
    }
    try {
      captures.push({ name: file.name, capture: parseCaptureJson(file.name, await file.text()) });
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `${file.name}: this file couldn't be read.`);
    }
  }
  return { images, captures, errors };
}

/**
 * Attaches capture sections to the new screenshots, and to library screenshots for captures that
 * belong to one already imported. Returns the new screenshots and a message per unmatched capture.
 */
export function applyCaptures(
  refs: AssetRef[],
  captures: CaptureFile[],
): { refs: AssetRef[]; errors: string[] } {
  if (captures.length === 0) return { refs, errors: [] };
  const { doc, setAssetCaptures } = useEditorStore.getState();
  const attached = attachCaptures(refs, captures, doc.assets);
  setAssetCaptures(attached.libraryUpdates);
  return {
    refs: attached.images,
    errors: attached.unmatched.map((name) => `${name}: no screenshot matches this capture file.`),
  };
}
