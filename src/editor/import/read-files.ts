/** Reads the files of a drop (folders included) or a paste. */
import type { ImportEntry } from "./sort-files";

export interface ImportFile extends ImportEntry {
  file: File;
}

export function importFile(file: File, path = file.name): ImportFile {
  return { file, name: file.name, path, type: file.type };
}

function readEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

function entryFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function collect(entry: FileSystemEntry, out: ImportFile[]): Promise<void> {
  if (entry.isFile) {
    const file = await entryFile(entry as FileSystemFileEntry);
    out.push(importFile(file, entry.fullPath.replace(/^\//, "")));
    return;
  }
  if (!entry.isDirectory) return;
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  // readEntries returns a folder in batches; an empty batch ends it.
  for (;;) {
    const batch = await readEntries(reader);
    if (batch.length === 0) break;
    for (const child of batch) await collect(child, out);
  }
}

/**
 * The files of a drop, with the contents of dropped folders. The entries must be taken before
 * the first await: the browser empties the DataTransfer when the drop handler returns.
 */
export async function filesFromDrop(data: DataTransfer): Promise<ImportFile[]> {
  const entries = Array.from(data.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.webkitGetAsEntry());
  if (entries.length === 0 || entries.some((entry) => !entry)) {
    return Array.from(data.files).map((file) => importFile(file));
  }
  const out: ImportFile[] = [];
  for (const entry of entries) if (entry) await collect(entry, out);
  return out;
}

const PASTE_NAME = "Pasted screenshot";

/**
 * The images of a paste; empty when the clipboard holds none (text, say). A copied image arrives
 * as `image.png`, so it gets a name that says where it came from.
 */
export function imagesFromClipboard(data: DataTransfer): ImportFile[] {
  return Array.from(data.items)
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null)
    .map((file) => {
      if (!/^image\.\w+$/.test(file.name)) return importFile(file);
      const ext = file.name.slice(file.name.indexOf("."));
      return importFile(new File([file], `${PASTE_NAME}${ext}`, { type: file.type }));
    });
}

/** Whether a dialog (export, gallery, projects…) is open over the editor. */
export function isDialogOpen(): boolean {
  return document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;
}

/** Whether a drag carries files from outside the page (not a library card or a shot). */
export function dragHasFiles(data: DataTransfer | null): boolean {
  return data !== null && Array.from(data.types).includes("Files");
}
