import type { Aspect, ExportSettings, ProjectDoc } from "../doc/types";
import { type AssetProvider, Engine, type TextRaster } from "../engine/Engine";
import { chromeUrlRequests } from "../engine/text/chrome-url";
import { screenLabelRequests } from "../engine/text/screen-labels";
import { textureRows, textureWidths } from "../engine/textures/sizing";
import { copyTopRows } from "../engine/textures/top-rows";
import { schedule } from "../motion";
import { calculateBitrate, outputDimensions } from "./destinations";
import { createWebEmbedBundle } from "./bundle";
import { probeVideoEncoders } from "./probe";
import { verifyExportBlob, type VerifyExportResult } from "./verify";
import { createCanvas, encodeInWorker, encodeMainThread, type StartMessage } from "./video-encode";

export { liveExportWorkers } from "./video-encode";

/**
 * Returns export dimensions (even integers, resolution is short side).
 * Kept for backward compatibility with existing tests.
 */
export function getExportDimensions(
  aspect: Aspect,
  resolution: number,
): { width: number; height: number } {
  return outputDimensions(aspect, resolution);
}

export interface ExportProgress {
  stage: "preparing" | "rendering" | "finishing";
  frame: number;
  total: number;
  percentage: number;
  thumbnailUrl?: string;
  /** The bundle video being rendered ("MP4", "WebM"); frame and total count its frames. */
  part?: string;
}

/** verify.ts result for one exported file ("MP4", "WebM", "PNG"). */
export interface ExportVerification {
  label: string;
  result: VerifyExportResult;
}

/** Options the editor never sets; scripts use them. */
export interface ExportOptions {
  /**
   * MP4/WebM video bitrate in bits per second, in place of the quality's. The template previews
   * use it to fit long loops into their byte budget (scripts/template-previews.ts).
   */
  videoBitrate?: number;
}

export interface ExportResult {
  blob: Blob;
  mime: string;
  bundleSnippet?: string;
  /** Things the export left out or changed, e.g. a bundle with one video format. */
  warnings: string[];
  /** Every exported file, re-read with Mediabunny (or decoded, for images). */
  verification: ExportVerification[];
}

/**
 * Exports a single still frame (e.g. for poster or PNG export) at the specified time.
 */
export async function exportCurrentFrame(
  doc: ProjectDoc,
  provider: AssetProvider,
  time: number,
  resolution = 1080,
  format: "png" | "webp" = "png",
): Promise<Blob> {
  const [blob] = await exportFrames(doc, provider, [time], resolution, format);
  return blob;
}

/** Exports still frames at several times with one engine (contact sheets). */
export async function exportFrames(
  doc: ProjectDoc,
  provider: AssetProvider,
  times: number[],
  resolution = 1080,
  format: "png" | "webp" = "png",
): Promise<Blob[]> {
  const { width, height } = outputDimensions(doc.aspect, resolution);
  const canvas = createCanvas(width, height);
  const engine = await Engine.create(canvas, {
    width,
    height,
    supersample: 1,
    preserveDrawingBuffer: true,
  });

  await engine.setDocument(doc, provider);
  const blobs: Blob[] = [];
  for (const time of times) {
    engine.renderAt(time);
    if (canvas instanceof OffscreenCanvas) {
      blobs.push(await canvas.convertToBlob({ type: `image/${format}` }));
    } else {
      blobs.push(
        await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error("Failed to capture canvas snapshot"));
          }, `image/${format}`);
        }),
      );
    }
  }

  engine.dispose();
  return blobs;
}

/**
 * Main export coordinator using the Three.js Engine and Mediabunny / fflate.
 * `settings.format` is the container that is written; the editor resolves MP4/WebM
 * against the encoder probe first (plan.ts).
 */
export async function exportWithEngine(
  doc: ProjectDoc,
  provider: AssetProvider,
  settings: ExportSettings,
  signal?: AbortSignal,
  onProgress?: (p: ExportProgress) => void,
  options: ExportOptions = {},
): Promise<ExportResult> {
  const { total } = schedule(doc);

  if (settings.format === "png") {
    const posterTime = total * 0.35;
    const blob = await exportCurrentFrame(doc, provider, posterTime, settings.resolution, "png");
    const { width, height } = outputDimensions(doc.aspect, settings.resolution);
    const result = await verifyExportBlob(blob, { width, height, duration: 0, fps: 1 });
    return { blob, mime: "image/png", warnings: [], verification: [{ label: "PNG", result }] };
  }

  if (settings.format === "bundle") {
    return exportBundleWithEngine(doc, provider, settings, signal, onProgress);
  }

  // Standard MP4 or WebM video export
  const { width, height } = outputDimensions(doc.aspect, settings.resolution);
  const container = settings.format === "webm" ? "webm" : "mp4";
  const codec = container === "mp4" ? "avc" : "vp9";

  const copies: ImageBitmap[] = [];
  let encoded: { blob: Blob; mime: string };
  try {
    const size = { width, height };
    const { images, texts } = await copyForWorker(doc, provider, settings, size, copies, signal);
    const start: StartMessage = {
      type: "start",
      doc,
      images,
      texts,
      settings,
      codec,
      container,
      width,
      height,
      bitrate:
        options.videoBitrate ??
        calculateBitrate(settings.quality, codec, width, height, settings.fps),
    };
    const useWorker = typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined";
    encoded = useWorker
      ? await encodeInWorker(start, signal, onProgress)
      : await encodeMainThread(doc, provider, start, signal, onProgress);
  } finally {
    // Closing a copy the worker took does nothing. This closes the ones it never got: on the
    // main thread (which renders from the provider), after a cancel, or when the post failed.
    for (const bitmap of copies) bitmap.close();
  }
  const { blob, mime } = encoded;

  const result = await verifyExportBlob(blob, {
    width,
    height,
    duration: total,
    fps: settings.fps,
    codec,
  });
  return {
    blob,
    mime,
    warnings: [],
    verification: [{ label: container === "mp4" ? "MP4" : "WebM", result }],
  };
}

/**
 * The images and text rasters `doc` shows, as copies for the export worker, which takes
 * ownership of what it is sent. Providers cache the bitmaps they hand out (text rasters for the
 * whole page, in rasterizeText), and a transferred one is detached for the next export (a
 * bundle's WebM, the next template preview) and for the editor's preview. Each copy is pushed
 * to `copies` as it is made, so the caller can close the ones the worker never takes.
 */
async function copyForWorker(
  doc: ProjectDoc,
  provider: AssetProvider,
  settings: ExportSettings,
  size: { width: number; height: number },
  copies: ImageBitmap[],
  signal?: AbortSignal,
): Promise<Pick<StartMessage, "images" | "texts">> {
  const ss = settings.supersample ?? 1;

  // Decode every image at the width it appears on screen (quality-bar §3.1), and only the rows
  // the document can show, as the preview does (textureRows).
  const decodeWidths = textureWidths(doc, {
    outputWidthPx: size.width,
    supersample: ss,
    quality: settings.quality,
  });
  const decodeRows = textureRows(doc);
  const images: Record<string, ImageBitmap> = {};
  for (const [id, decodeWidth] of decodeWidths) {
    const rows = decodeRows.get(id) ?? null;
    const source = await provider.getImage(id, decodeWidth, rows);
    signal?.throwIfAborted();
    const copy = await copyTopRows(source, rows);
    copies.push(copy);
    images[id] = copy;
  }

  // The browser URL pills and the screens' labels, rasterized at export resolution.
  const frameHeightPx = Math.round(size.height * ss);
  const texts: Record<string, TextRaster> = {};
  for (const request of [...chromeUrlRequests(doc), ...screenLabelRequests(doc)]) {
    const raster = await provider.getText(request.line, frameHeightPx);
    signal?.throwIfAborted();
    const copy = await createImageBitmap(raster.bitmap);
    copies.push(copy);
    texts[request.line.id] = { ...raster, bitmap: copy };
  }
  return { images, texts };
}

/**
 * Web embed bundle: the MP4 and WebM this browser can encode, a WebP poster and embed
 * code, packaged into a .zip.
 */
async function exportBundleWithEngine(
  doc: ProjectDoc,
  provider: AssetProvider,
  settings: ExportSettings,
  signal?: AbortSignal,
  onProgress?: (p: ExportProgress) => void,
): Promise<ExportResult> {
  const { width, height } = outputDimensions(doc.aspect, settings.resolution);
  const encoders = await probeVideoEncoders({
    width,
    height,
    fps: settings.fps,
    quality: settings.quality,
  });
  const formats = (["mp4", "webm"] as const).filter((f) =>
    f === "mp4" ? encoders.avc : encoders.vp9,
  );
  if (formats.length === 0) throw new Error("This browser can't encode MP4 or WebM video.");

  onProgress?.({ stage: "preparing", frame: 0, total: 100, percentage: 0 });
  const videos: Partial<Record<"mp4" | "webm", Blob>> = {};
  const verification: ExportVerification[] = [];
  const share = 90 / formats.length;
  for (const [index, format] of formats.entries()) {
    const part = await exportWithEngine(doc, provider, { ...settings, format }, signal, (p) => {
      const percentage = Math.round(index * share + p.percentage * (share / 100));
      const part = format === "mp4" ? "MP4" : "WebM";
      onProgress?.({ stage: "rendering", frame: p.frame, total: p.total, percentage, part });
    });
    videos[format] = part.blob;
    verification.push(...part.verification);
  }

  // Poster: the frame at 35% of the video
  const { total } = schedule(doc);
  const posterBlob = await exportCurrentFrame(
    doc,
    provider,
    total * 0.35,
    settings.resolution,
    "webp",
  );

  onProgress?.({ stage: "finishing", frame: 95, total: 100, percentage: 95 });
  const { zipBlob, embedSnippet } = await createWebEmbedBundle({
    projectName: doc.name,
    width,
    height,
    mp4Blob: videos.mp4,
    webmBlob: videos.webm,
    posterBlob,
    webmCodec: "vp9",
  });

  onProgress?.({ stage: "finishing", frame: 100, total: 100, percentage: 100 });
  return {
    blob: zipBlob,
    mime: "application/zip",
    bundleSnippet: embedSnippet,
    warnings: formats.length < 2 ? [`The bundle holds ${formats[0].toUpperCase()} only.`] : [],
    verification,
  };
}
