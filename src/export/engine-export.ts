import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  Quality,
  WebMOutputFormat,
} from "mediabunny";
import type { Aspect, ExportSettings, ProjectDoc } from "../doc/types";
import { type AssetProvider, Engine } from "../engine/Engine";
import { textureWidths } from "../engine/textures/sizing";
import { schedule } from "../motion";
import type { FromWorker, ToWorker } from "./engine-worker";
import { calculateBitrate, keyframeIntervalFor, outputDimensions } from "./destinations";
import { createWebEmbedBundle } from "./bundle";
import { encodeGif } from "./gif";
import {
  addAudioTrackToOutput,
  prepareExportAudio,
  withoutAudio,
  writeAudio,
  type ExportAudio,
} from "./audio-mux";

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

  let canvas: HTMLCanvasElement | OffscreenCanvas;
  if (typeof OffscreenCanvas !== "undefined") {
    canvas = new OffscreenCanvas(width, height);
  } else {
    canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
  }

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
 */
export async function exportWithEngine(
  doc: ProjectDoc,
  provider: AssetProvider,
  settings: ExportSettings,
  signal?: AbortSignal,
  onProgress?: (p: ExportProgress) => void,
): Promise<{ blob: Blob; mime: string; bundleSnippet?: string; warnings?: string[] }> {
  // 1. Single-frame PNG export
  if (settings.format === "png") {
    const { total } = schedule(doc);
    const posterTime = total * 0.35;
    const blob = await exportCurrentFrame(doc, provider, posterTime, settings.resolution, "png");
    return { blob, mime: "image/png" };
  }

  // 2. GIF export
  if (settings.format === "gif") {
    return exportGifWithEngine(doc, provider, settings, signal, onProgress);
  }

  // 3. Web Embed Bundle (MP4 + WebM + poster + zip)
  if (settings.format === "bundle") {
    return exportBundleWithEngine(doc, provider, settings, signal, onProgress);
  }

  // 4. Standard MP4 or WebM video export
  const { width, height } = outputDimensions(doc.aspect, settings.resolution);
  const container = settings.format === "webm" ? "webm" : "mp4";
  const codec = container === "mp4" ? "avc" : "vp9";

  // Mix the optional music track (absent or unsupported => no audio, reasons in warnings)
  const { total: audioTotal } = schedule(doc);
  const prepared = await prepareExportAudio(
    doc,
    provider.getAudio?.bind(provider),
    audioTotal,
    container,
  );
  const audio = prepared.audio;
  const warnings = prepared.warnings;
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
    images[id] = await provider.getImage(id, decodeWidth);
    signal?.throwIfAborted();
  }

  // Pre-rasterize all text layers at export resolution
  const ss = settings.supersample ?? 1;
  const texts: Record<string, import("../engine/Engine").TextRaster> = {};
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

  // Try Web Worker first if supported
  if (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined") {
    return new Promise<{ blob: Blob; mime: string; warnings?: string[] }>((resolve, reject) => {
      let worker: Worker;
      try {
        worker = new Worker(new URL("./engine-worker.ts", import.meta.url), { type: "module" });
      } catch {
        // Fall back to main thread
        encodeMainThread(
          doc,
          provider,
          settings,
          width,
          height,
          codec,
          container,
          signal,
          onProgress,
          audio,
        )
          .then((r) => resolve({ ...r, warnings }))
          .catch(reject);
        return;
      }

      signal?.addEventListener("abort", () => {
        worker.postMessage({ type: "cancel" } satisfies ToWorker);
        worker.terminate();
        reject(new Error("Export aborted."));
      });

      worker.onmessage = (e: MessageEvent<FromWorker>) => {
        const msg = e.data;
        if (msg.type === "progress") {
          const percentage = Math.round((msg.frame / msg.total) * 100);
          onProgress?.({
            stage: msg.stage,
            frame: msg.frame,
            total: msg.total,
            percentage,
          });
        } else if (msg.type === "done") {
          worker.terminate();
          resolve({ blob: msg.blob, mime: msg.mime, warnings });
        } else if (msg.type === "error") {
          worker.terminate();
          reject(new Error(msg.message));
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        reject(err);
      };

      const startMsg: ToWorker = {
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

      // Transfer ImageBitmap and audio buffer ownership to worker
      const transferList: Transferable[] = [
        ...Object.values(images),
        ...Object.values(texts).map((t) => t.bitmap),
        ...(audio ? audio.mix.channels.map((c) => c.buffer) : []),
      ];
      worker.postMessage(startMsg, transferList);
    });
  }

  // Fallback to main-thread encode
  const main = await encodeMainThread(
    doc,
    provider,
    settings,
    width,
    height,
    codec,
    container,
    signal,
    onProgress,
    audio,
  );
  return { ...main, warnings };
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
  // GIF max width 960 px per WP-16 §7
  const gifResolution = Math.min(960, settings.resolution);
  const { width, height } = outputDimensions(doc.aspect, gifResolution);
  const fps = Math.min(20, Math.max(10, settings.fps || 15));

  let canvas: HTMLCanvasElement | OffscreenCanvas;
  if (typeof OffscreenCanvas !== "undefined") {
    canvas = new OffscreenCanvas(width, height);
  } else {
    canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
  }

  const engine = await Engine.create(canvas, {
    width,
    height,
    supersample: 1,
    preserveDrawingBuffer: true,
  });

  await engine.setDocument(doc, provider);

  const { total: duration } = schedule(doc);
  const totalFrames = Math.max(1, Math.round(duration * fps));

  onProgress?.({ stage: "preparing", frame: 0, total: totalFrames, percentage: 0 });

  const frames: Uint8ClampedArray[] = [];

  for (let frame = 0; frame < totalFrames; frame++) {
    signal?.throwIfAborted();

    const t = frame / fps;
    engine.renderAt(t);

    const flipped = engine.readPixels();
    frames.push(flipped);

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

  engine.dispose();

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
 * Web Embed Bundle export: generates MP4, WebM, and WebP poster, then packages into .zip
 */
async function exportBundleWithEngine(
  doc: ProjectDoc,
  provider: AssetProvider,
  settings: ExportSettings,
  signal?: AbortSignal,
  onProgress?: (p: ExportProgress) => void,
): Promise<{ blob: Blob; mime: string; bundleSnippet?: string }> {
  const { width, height } = outputDimensions(doc.aspect, settings.resolution);

  // 1. Export MP4
  onProgress?.({ stage: "preparing", frame: 0, total: 100, percentage: 5 });
  const mp4Res = await exportWithEngine(
    withoutAudio(doc),
    provider,
    { ...settings, format: "mp4" },
    signal,
    (p) => {
      onProgress?.({
        stage: "rendering",
        frame: Math.round(p.percentage * 0.45),
        total: 100,
        percentage: Math.round(p.percentage * 0.45),
      });
    },
  );

  // 2. Export WebM
  const webmRes = await exportWithEngine(
    withoutAudio(doc),
    provider,
    { ...settings, format: "webm" },
    signal,
    (p) => {
      onProgress?.({
        stage: "rendering",
        frame: 45 + Math.round(p.percentage * 0.45),
        total: 100,
        percentage: 45 + Math.round(p.percentage * 0.45),
      });
    },
  );

  // 3. Export Poster WebP (frame at 35% time)
  const { total } = schedule(doc);
  const posterTime = total * 0.35;
  const posterBlob = await exportCurrentFrame(
    doc,
    provider,
    posterTime,
    settings.resolution,
    "webp",
  );

  // 4. Bundle into Zip via fflate
  onProgress?.({ stage: "finishing", frame: 95, total: 100, percentage: 95 });
  const { zipBlob, embedSnippet } = await createWebEmbedBundle({
    projectName: doc.name,
    width,
    height,
    mp4Blob: mp4Res.blob,
    webmBlob: webmRes.blob,
    posterBlob,
    webmCodec: "vp9",
  });

  onProgress?.({ stage: "finishing", frame: 100, total: 100, percentage: 100 });
  return {
    blob: zipBlob,
    mime: "application/zip",
    bundleSnippet: embedSnippet,
  };
}

async function encodeMainThread(
  doc: ProjectDoc,
  provider: AssetProvider,
  settings: ExportSettings,
  width: number,
  height: number,
  codec: "avc" | "vp9" | "av1",
  container: "mp4" | "webm",
  signal?: AbortSignal,
  onProgress?: (p: ExportProgress) => void,
  audio?: ExportAudio,
): Promise<{ blob: Blob; mime: string }> {
  let canvas: HTMLCanvasElement | OffscreenCanvas;
  if (typeof OffscreenCanvas !== "undefined") {
    canvas = new OffscreenCanvas(width, height);
  } else {
    canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
  }

  const ss = settings.supersample;
  const supersampleVal: 1 | 1.5 | 2 = ss === 2 ? 2 : ss === 1.5 ? 1.5 : 1;

  const engine = await Engine.create(canvas, {
    width,
    height,
    supersample: supersampleVal,
    preserveDrawingBuffer: true,
  });

  await engine.setDocument(doc, provider);

  const { total: duration } = schedule(doc);
  const fps = settings.fps;
  const totalFrames = Math.max(1, Math.round(duration * fps));

  onProgress?.({ stage: "preparing", frame: 0, total: totalFrames, percentage: 0 });

  const target = new BufferTarget();
  const format =
    container === "mp4" ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat();

  const output = new Output({ format, target });
  const bitrate = calculateBitrate(settings.quality, codec, width, height, fps);
  const keyframeInterval = keyframeIntervalFor(settings.quality);

  const source = new CanvasSource(canvas, {
    codec,
    quality: new Quality({ bitrate }),
    keyFrameInterval: keyframeInterval,
  });

  output.addVideoTrack(source, { frameRate: fps });
  const audioSource = audio ? addAudioTrackToOutput(output, audio) : null;
  await output.start();

  for (let frame = 0; frame < totalFrames; frame++) {
    signal?.throwIfAborted();

    const t = frame / fps;
    if (settings.motionBlur) {
      engine.renderAccumulated(t, (1 / fps) * 0.5, 4);
    } else {
      engine.renderAt(t);
    }

    await source.add(t, 1 / fps);

    if (frame % 4 === 0 || frame === totalFrames - 1) {
      onProgress?.({
        stage: "rendering",
        frame,
        total: totalFrames,
        percentage: Math.round((frame / totalFrames) * 100),
      });
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  onProgress?.({ stage: "finishing", frame: totalFrames, total: totalFrames, percentage: 100 });
  if (audio && audioSource) await writeAudio(audioSource, audio);
  await output.finalize();
  engine.dispose();

  const mime = container === "mp4" ? "video/mp4" : "video/webm";
  const blob = new Blob([target.buffer as ArrayBuffer], { type: mime });
  return { blob, mime };
}
