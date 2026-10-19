/**
 * Section data from the capture command (packages/capture, also `npm run capture`): each
 * screenshot comes with a JSON file of section positions in CSS px. Responsive Scroll stops both screens on the same section, so
 * the sections are stored on the screenshot's asset in image px (docs/responsive-scroll-plan, R02).
 * Pure: no DOM.
 */
import type { AssetMeta, AssetRef, CaptureSection } from "../doc/types";

/** The fields of a capture JSON this app reads (`CaptureMetadata` in packages/capture/src/index.d.mts). */
export interface CaptureJson {
  url: string;
  viewportWidth: number;
  scale: number;
  pageHeight: number;
  sections: { tag: string; id?: string; className?: string; top: number }[];
}

export interface CaptureFile {
  name: string;
  capture: CaptureJson;
}

// A capture's page height × scale can differ from the PNG by a rounding pixel.
const SIZE_TOLERANCE_PX = 2;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Parses a capture JSON. Throws an error that names the file when it isn't one. */
export function parseCaptureJson(name: string, text: string): CaptureJson {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(`${name}: this file isn't valid JSON.`);
  }
  const notCapture = new Error(`${name}: this isn't a capture file from mockup-motion-capture.`);
  if (!raw || typeof raw !== "object") throw notCapture;
  const r = raw as Record<string, unknown>;
  if (
    !isFiniteNumber(r.viewportWidth) ||
    r.viewportWidth <= 0 ||
    !isFiniteNumber(r.scale) ||
    r.scale <= 0 ||
    !isFiniteNumber(r.pageHeight) ||
    r.pageHeight <= 0 ||
    !Array.isArray(r.sections)
  ) {
    throw notCapture;
  }
  const sections: CaptureJson["sections"] = [];
  for (const s of r.sections as unknown[]) {
    if (!s || typeof s !== "object") continue;
    const section = s as Record<string, unknown>;
    if (typeof section.tag !== "string" || !isFiniteNumber(section.top)) continue;
    sections.push({
      tag: section.tag,
      id: typeof section.id === "string" && section.id ? section.id : undefined,
      className:
        typeof section.className === "string" && section.className ? section.className : undefined,
      top: section.top,
    });
  }
  return {
    url: typeof r.url === "string" ? r.url : "",
    viewportWidth: r.viewportWidth,
    scale: r.scale,
    pageHeight: r.pageHeight,
    sections,
  };
}

/** A section's key: its id, else its tag and first class (`section.works-section`). */
export function sectionKey(section: { tag: string; id?: string; className?: string }): string {
  if (section.id) return section.id;
  const firstClass = section.className?.split(/\s+/)[0];
  return firstClass ? `${section.tag}.${firstClass}` : section.tag;
}

/**
 * The capture's sections in image px (CSS px × scale), ascending. A key that repeats keeps its
 * first section, so a key names one place on the page.
 */
export function captureSections(capture: CaptureJson): CaptureSection[] {
  const seen = new Set<string>();
  const result: CaptureSection[] = [];
  const sorted = [...capture.sections].sort((a, b) => a.top - b.top);
  for (const section of sorted) {
    const id = sectionKey(section);
    if (seen.has(id)) continue;
    seen.add(id);
    result.push({ id, top: Math.max(0, Math.round(section.top * capture.scale)) });
  }
  return result;
}

/**
 * A capture's file stem: the name without extension and without the `-full` suffix, so
 * `site-desktop-1440-full.png` and `site-desktop-1440.json` share `site-desktop-1440`.
 */
export function captureStem(fileName: string): string {
  return fileName.replace(/\.[^./]+$/, "").replace(/-full$/, "");
}

/** Whether the capture describes an image of this size (full page, within 2 px). */
export function captureFitsImage(capture: CaptureJson, image: Pick<AssetRef, "width" | "height">) {
  if (!image.width || !image.height) return false;
  const width = capture.viewportWidth * capture.scale;
  const height = capture.pageHeight * capture.scale;
  return (
    Math.abs(width - image.width) <= SIZE_TOLERANCE_PX &&
    Math.abs(height - image.height) <= SIZE_TOLERANCE_PX
  );
}

/** The meta a capture adds to its screenshot's asset. */
export function captureMeta(capture: CaptureJson): Pick<AssetMeta, "sections" | "page"> {
  const meta: Pick<AssetMeta, "sections" | "page"> = { sections: captureSections(capture) };
  if (capture.url) meta.page = capture.url;
  return meta;
}

/**
 * The image a capture belongs to: the one whose name shares the capture's stem, else the only one
 * of the capture's size. New images are searched before the library. Undefined when none or
 * several match.
 */
function matchImage(file: CaptureFile, candidates: AssetRef[]): AssetRef | undefined {
  const images = candidates.filter((a) => a.kind === "image");
  const stem = captureStem(file.name);
  const byName = images.find((a) => captureStem(a.name) === stem);
  if (byName && captureFitsImage(file.capture, byName)) return byName;
  const bySize = images.filter((a) => captureFitsImage(file.capture, a));
  return bySize.length === 1 ? bySize[0] : undefined;
}

export interface AttachedCaptures {
  /** The new images, with the sections of their captures. */
  images: AssetRef[];
  /** Library assets that a capture in this import belongs to. */
  libraryUpdates: { id: string; meta: Pick<AssetMeta, "sections" | "page"> }[];
  /** Capture files that match no image. */
  unmatched: string[];
}

/** Attaches each capture's sections to its screenshot, new in this import or in the library. */
export function attachCaptures(
  images: AssetRef[],
  captures: CaptureFile[],
  library: AssetRef[],
): AttachedCaptures {
  const result: AttachedCaptures = { images: [...images], libraryUpdates: [], unmatched: [] };
  for (const file of captures) {
    const meta = captureMeta(file.capture);
    const fresh = matchImage(file, result.images);
    if (fresh) {
      const index = result.images.indexOf(fresh);
      result.images[index] = { ...fresh, meta: { ...fresh.meta, ...meta } };
      continue;
    }
    const existing = matchImage(file, library);
    if (existing) {
      result.libraryUpdates.push({ id: existing.id, meta });
      continue;
    }
    result.unmatched.push(file.name);
  }
  return result;
}
