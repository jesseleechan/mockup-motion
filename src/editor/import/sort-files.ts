/**
 * Sorting of pasted and dropped files: which are screenshots, which are capture JSON files, and
 * which can't be imported. A dropped `captures/` folder from the capture command holds, per page
 * and width, a JSON file, a viewport PNG and a full-page PNG (`scripts/capture.ts`). Pure: no DOM.
 */
import type { AssetRef, AssetRole } from "../../doc/types";
import { captureFitsImage, captureStem, type CaptureFile } from "../../assets/capture-json";

export interface ImportEntry {
  name: string;
  /** The path inside a dropped folder (`captures/site-desktop-1440.png`), else the name. */
  path: string;
  type: string;
}

export interface SortedImport<T extends ImportEntry> {
  /** Screenshots, in path order. */
  images: T[];
  captures: T[];
  /** Names of files that can't be imported. */
  unsupported: string[];
  /** Viewport captures left out because the import has the full page of the same capture. */
  viewportDuplicates: string[];
}

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/avif"]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "avif"]);
// Files a file manager adds to folders. They aren't the user's, so they are not reported.
const SYSTEM_FILES = new Set(["thumbs.db", "desktop.ini"]);

function extension(name: string): string {
  const match = /\.([^./]+)$/.exec(name);
  return match ? match[1].toLowerCase() : "";
}

function isSystemFile(name: string): boolean {
  return name.startsWith(".") || SYSTEM_FILES.has(name.toLowerCase());
}

function isImage(entry: ImportEntry): boolean {
  return (
    IMAGE_TYPES.has(entry.type) || (!entry.type && IMAGE_EXTENSIONS.has(extension(entry.name)))
  );
}

function isJson(entry: ImportEntry): boolean {
  return entry.type === "application/json" || extension(entry.name) === "json";
}

function folder(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "" : path.slice(0, slash);
}

function comparePaths(a: ImportEntry, b: ImportEntry): number {
  return a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Splits an import into screenshots, capture files and unsupported files. When a capture's
 * folder has both its viewport PNG and its full-page PNG, only the full page is imported: the
 * capture's sections describe it, and a device shows its top like the viewport PNG.
 */
export function sortImportFiles<T extends ImportEntry>(entries: T[]): SortedImport<T> {
  const sorted = [...entries].sort(comparePaths);
  const images: T[] = [];
  const captures: T[] = [];
  const unsupported: string[] = [];
  for (const entry of sorted) {
    if (isSystemFile(entry.name)) continue;
    if (isImage(entry)) images.push(entry);
    else if (isJson(entry)) captures.push(entry);
    else unsupported.push(entry.name);
  }

  const captureKeys = new Set(captures.map((c) => `${folder(c.path)}/${captureStem(c.name)}`));
  const fullPages = new Set(
    images
      .filter((image) => /-full\.[^./]+$/.test(image.name))
      .map((image) => `${folder(image.path)}/${captureStem(image.name)}`),
  );
  const viewportDuplicates: string[] = [];
  const kept = images.filter((image) => {
    if (/-full\.[^./]+$/.test(image.name)) return true;
    const key = `${folder(image.path)}/${captureStem(image.name)}`;
    if (!captureKeys.has(key) || !fullPages.has(key)) return true;
    viewportDuplicates.push(image.name);
    return false;
  });

  return { images: kept, captures, unsupported, viewportDuplicates };
}

/** The role a file name states: a `desktop`, `mobile` or `phone` word in it. */
export function roleFromName(name: string): AssetRole | undefined {
  const words = captureStem(name)
    .toLowerCase()
    .split(/[^a-z0-9]+/);
  if (words.includes("desktop")) return "desktop";
  if (words.includes("mobile") || words.includes("phone") || words.includes("iphone")) {
    return "mobile";
  }
  return undefined;
}

// Viewports narrower than a tablet's portrait width are phones.
const MOBILE_MAX_VIEWPORT = 767;

/**
 * The role of an imported screenshot: from its name, else from the viewport width of the capture
 * that describes it, else the role found from its size. A full-page desktop capture is taller
 * than wide, so its size alone reads as mobile.
 */
export function importRole(image: AssetRef, captures: CaptureFile[]): AssetRole | undefined {
  const named = roleFromName(image.name);
  if (named) return named;
  const stem = captureStem(image.name);
  const capture = captures.find(
    (c) => captureStem(c.name) === stem && captureFitsImage(c.capture, image),
  );
  if (capture) return capture.capture.viewportWidth <= MOBILE_MAX_VIEWPORT ? "mobile" : "desktop";
  return image.role;
}

/** A list of names for a message: all of them up to three, else three and a count. */
export function nameList(names: string[]): string {
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;
}

/** The message for files that can't be imported, or undefined when there are none. */
export function unsupportedMessage(names: string[]): string | undefined {
  if (names.length === 0) return undefined;
  return `Not imported: ${nameList(names)}. Use PNG, JPG, WebP, or AVIF.`;
}
