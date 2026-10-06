import type { Aspect, ExportSettings, ProjectDoc } from "../doc/types";
import { type AssetProvider, Engine, type TextRaster } from "../engine/Engine";
import { textureWidths } from "../engine/textures/sizing";
import { schedule } from "../motion";
import { gifOutput, outputDimensions } from "./destinations";
import { createWebEmbedBundle } from "./bundle";
import { encodeGif } from "./gif";
import { probeVideoEncoders } from "./probe";
import { verifyExportBlob, type VerifyExportResult } from "./verify";
import { prepareExportAudio, withoutAudio } from "./audio-mux";
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

/** verify.ts result for one exported file ("MP4", "WebM", "GIF", "PNG"). */
export interface ExportVerification {
  label: string;
  result: VerifyExportResult;
}

export interface ExportResult {
  blob: Blob;
  mime: string;
  bundleSnippet?: string;
  /** Things the export left out or changed, e.g. music that could not be mixed. */
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
  const { width, height } = outputDimensions(doc.aspect, resolution);
  const canvas = createCanvas(width, height);
  const engine = await Engine.create(canvas, {
    width,
    height,
    supersample: 1,
    preserveDrawingBuffer: true,
  });

  await engine.setDocument(doc, provider);
  engine.renderAt(time);

  let blob: Blob;
  if (canvas instanceof OffscreenCanvas) {
    blob = await canvas.convertToBlob({ type: `image/${format}` });
  } else {
    blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error("Failed to capture canvas snapshot"));
      }, `image/${format}`);
    });
  }

  engine.dispose();
  return blob;
}

/**
 * Main export coordinator using the Three.js Engine and Mediabunny / gifenc / fflate.
 * `settings.format` is the container that is written; the editor resolves MP4/WebM
 * against the encoder probe first (plan.ts).
 */
export async function exportWithEngine(
  doc: ProjectDoc,
  provider: AssetProvider,
  settings: ExportSettings,
  signal?: AbortSignal,
  onProgress?: (p: ExportProgress) => void,
): Promise<ExportResult> {
  const { total } = schedule(doc);

  if (settings.format === "png") {
    const posterTime = total * 0.35;
    const blob = await exportCurrentFrame(doc, provider, posterTime, settings.resolution, "png");
    const { width, height } = outputDimensions(doc.aspect, settings.resolution);
    const result = await verifyExportBlob(blob, { width, height, duration: 0, fps: 1 });
    return { blob, mime: "image/png", warnings: [], verification: [{ label: "PNG", result }] };
  }

  if (settings.format === "gif") {
    const { blob, mime } = await exportGifWithEngine(doc, provider, settings, signal, onProgress);
    const gif = gifOutput(doc.aspect, settings.resolution, settings.fps);
    const result = await verifyExportBlob(blob, { ...gif, duration: total });
    return { blob, mime, warnings: [], verification: [{ label: "GIF", result }] };
  }

  if (settings.format === "bundle") {
    return exportBundleWithEngine(doc, provider, settings, signal, onProgress);
  }

  // Standard MP4 or WebM video export
  const { width, height } = outputDimensions(doc.aspect, settings.resolution);
  const container = settings.format === "webm" ? "webm" : "mp4";
  const codec = container === "mp4" ? "avc" : "vp9";

  // Mix the optional music track (absent or unsupported => no audio, reasons in warnings)
  const prepared = await prepareExportAudio(
    doc,
    provider.getAudio?.bind(provider),
    total,
    container,
  );
  const audio = prepared.audio;
  // The worker's abort listener is attached only after preparation, so a cancel
  // during preparation must be checked here or it is lost.
  signal?.throwIfAborted();

  // Decode every image at the width it appears on screen (quality-bar §3.1)
  const decodeWidths = textureWidths(doc, {
    outputWidthPx: width,
    supersample: settings.supersample ?? 1,
    quality: settings.quality,
  });
  const images: Record<string, ImageBitmap> = {};
  for (const [id, decodeWidth] of decodeWidths) {
    // The worker takes ownership of what it is sent, so send a copy: providers cache their
    // bitmaps, and a transferred one is detached for the next export (a bundle's WebM) and
    // for the editor preview.
    const source = await provider.getImage(id, decodeWidth);
    signal?.throwIfAborted();
    images[id] = await createImageBitmap(source);
  }

  // Pre-rasterize all text layers at export resolution
  const ss = settings.supersample ?? 1;
  const texts: Record<string, TextRaster> = {};
  for (const shot of doc.shots) {
    if (shot.texts && shot.texts.length > 0) {
      const shotStyle = shot.styleOverrides ? { ...doc.style, ...shot.styleOverrides } : doc.style;
      const frameHeightPx = Math.round(height * ss);
      for (const layer of shot.texts) {
        texts[layer.id] = await provider.getText(layer, shotStyle, frameHeightPx);
        signal?.throwIfAborted();
      }
    }
  }

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
    audio,
  };
  const useWorker = typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined";
  const { blob, mime } = useWorker
    ? await encodeInWorker(start, signal, onProgress)
    : await encodeMainThread(doc, provider, start, signal, onProgress);

  const result = await verifyExportBlob(blob, {
    width,
    height,
    duration: total,
    fps: settings.fps,
    codec,
    audio: Boolean(audio),
  });
  return {
    blob,
    mime,
    warnings: prepared.warnings,
    verification: [{ label: container === "mp4" ? "MP4" : "WebM", result }],
  };
}

/**
 * GIF export implementation using gifenc and Engine OffscreenCanvas.
 */
async function exportGifWithEngine(
  doc: ProjectDoc,
  provider: AssetProvider,
  settings: ExportSettings,
  signal?: AbortSignal,
  onProgress?: (p: ExportProgress) => void,
): Promise<{ blob: Blob; mime: string }> {
  const { width, height, fps } = gifOutput(doc.aspect, settings.resolution, settings.fps);
  const canvas = createCanvas(width, height);
  const engine = await Engine.create(canvas, {
    width,
    height,
    supersample: 1,
    preserveDrawingBuffer: true,
  });

  const { total: duration } = schedule(doc);
  const totalFrames = Math.max(1, Math.round(duration * fps));
  const frames: Uint8ClampedArray[] = [];
  try {
    await engine.setDocument(doc, provider);
    onProgress?.({ stage: "preparing", frame: 0, total: totalFrames, percentage: 0 });

    for (let frame = 0; frame < totalFrames; frame++) {
      signal?.throwIfAborted();

      engine.renderAt(frame / fps);
      frames.push(engine.readPixels());

      if (frame % 3 === 0 || frame === totalFrames - 1) {
        onProgress?.({
          stage: "rendering",
          frame,
          total: totalFrames,
          percentage: Math.round((frame / totalFrames) * 70),
        });
        await new Promise((r) => setTimeout(r, 0));
      }
    }
  } finally {
    engine.dispose();
  }

  onProgress?.({ stage: "finishing", frame: totalFrames, total: totalFrames, percentage: 80 });

  const { blob, mime } = encodeGif(frames, { width, height, fps, dither: true }, (p) => {
    onProgress?.({
      stage: "finishing",
      frame: p.frame,
      total: p.total,
      percentage: 80 + Math.round(p.percentage * 0.2),
    });
  });

  return { blob, mime };
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
  const silent = withoutAudio(doc);
  const videos: Partial<Record<"mp4" | "webm", Blob>> = {};
  const verification: ExportVerification[] = [];
  const share = 90 / formats.length;
  for (const [index, format] of formats.entries()) {
    const part = await exportWithEngine(silent, provider, { ...settings, format }, signal, (p) => {
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
