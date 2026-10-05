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
import { schedule } from "../motion";
import type { FromWorker, ToWorker } from "./engine-worker";

export function getExportDimensions(
  aspect: Aspect,
  resolution: number,
): { width: number; height: number } {
  let w: number;
  let h: number;

  switch (aspect) {
    case "16:9":
      h = resolution;
      w = Math.round((resolution * 16) / 9);
      break;
    case "9:16":
      w = resolution;
      h = Math.round((resolution * 16) / 9);
      break;
    case "1:1":
      w = resolution;
      h = resolution;
      break;
    case "4:5":
      w = resolution;
      h = Math.round((resolution * 5) / 4);
      break;
    case "4:3":
      h = resolution;
      w = Math.round((resolution * 4) / 3);
      break;
  }

  // Ensure dimensions are even numbers for H.264 / WebM video codecs
  w = w % 2 === 0 ? w : w + 1;
  h = h % 2 === 0 ? h : h + 1;

  return { width: w, height: h };
}

export interface ExportProgress {
  stage: "preparing" | "rendering" | "finishing";
  frame: number;
  total: number;
  percentage: number;
}

/**
 * Main-thread export runner using the Engine and Mediabunny.
 * Tries Web Worker first with transferable ImageBitmaps, falling back to
 * main-thread OffscreenCanvas if Workers are not supported.
 */
export async function exportWithEngine(
  doc: ProjectDoc,
  provider: AssetProvider,
  settings: ExportSettings,
  signal?: AbortSignal,
  onProgress?: (p: ExportProgress) => void,
): Promise<{ blob: Blob; mime: string }> {
  const { width, height } = getExportDimensions(doc.aspect, settings.resolution);
  const container = settings.format === "webm" ? "webm" : "mp4";
  const codec = container === "mp4" ? "avc" : "vp9";

  // Decode needed images at export scale
  const neededAssetIds = new Set<string>();
  for (const shot of doc.shots) {
    if (shot.layout.kind === "single" && shot.layout.assetId) {
      neededAssetIds.add(shot.layout.assetId);
    }
  }

  const images: Record<string, ImageBitmap> = {};
  for (const id of neededAssetIds) {
    images[id] = await provider.getImage(id, width * (settings.supersample ?? 1));
  }

  // Try Web Worker if Worker and OffscreenCanvas are supported
  if (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined") {
    return new Promise<{ blob: Blob; mime: string }>((resolve, reject) => {
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
        )
          .then(resolve)
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
          resolve({ blob: msg.blob, mime: msg.mime });
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
        texts: {},
        settings,
        codec,
        container,
        width,
        height,
      };

      // Transfer ImageBitmap ownership to worker
      const transferList = Object.values(images);
      worker.postMessage(startMsg, transferList);
    });
  }

  // Fallback to main-thread encode
  return encodeMainThread(
    doc,
    provider,
    settings,
    width,
    height,
    codec,
    container,
    signal,
    onProgress,
  );
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
): Promise<{ blob: Blob; mime: string }> {
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
    supersample: settings.supersample ?? 1,
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
  const source = new CanvasSource(canvas, {
    codec,
    quality: new Quality({ bitrate: 16_000_000 }),
    keyFrameInterval: 2,
  });

  output.addVideoTrack(source, { frameRate: fps });
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
  await output.finalize();
  engine.dispose();

  const mime = container === "mp4" ? "video/mp4" : "video/webm";
  const blob = new Blob([target.buffer as ArrayBuffer], { type: mime });
  return { blob, mime };
}
