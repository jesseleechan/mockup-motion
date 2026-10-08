import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  Quality,
  WebMOutputFormat,
} from "mediabunny";
import type { ProjectDoc } from "../doc/types";
import { type AssetProvider, Engine } from "../engine/Engine";
import { schedule } from "../motion";
import type { ExportProgress } from "./engine-export";
import type { FromWorker, ToWorker } from "./engine-worker";
import { keyframeIntervalFor, MOTION_BLUR_SAMPLES, motionBlurShutter } from "./destinations";
import { addAudioTrackToOutput, writeAudio } from "./audio-mux";

// Video encoding for MP4/WebM exports: in a module worker where OffscreenCanvas exists,
// otherwise the same loop on the main thread.

export type StartMessage = Extract<ToWorker, { type: "start" }>;

// Export workers alive right now. A cancelled or finished export must bring this back to 0.
let liveWorkers = 0;

export function liveExportWorkers(): number {
  return liveWorkers;
}

if (import.meta.env?.DEV && typeof window !== "undefined") {
  (window as unknown as { __liveExportWorkers?: () => number }).__liveExportWorkers =
    liveExportWorkers;
}

export function createCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** Renders and encodes in a module worker; cancel terminates it at once. */
export function encodeInWorker(
  start: StartMessage,
  signal?: AbortSignal,
  onProgress?: (p: ExportProgress) => void,
): Promise<{ blob: Blob; mime: string }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./engine-worker.ts", import.meta.url), { type: "module" });
    liveWorkers++;
    let finished = false;
    const finish = () => {
      if (finished) return false;
      finished = true;
      worker.terminate();
      liveWorkers--;
      signal?.removeEventListener("abort", onAbort);
      return true;
    };
    const onAbort = () => {
      if (finish()) reject(new DOMException("Export aborted.", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort);

    worker.onmessage = (e: MessageEvent<FromWorker>) => {
      const msg = e.data;
      if (msg.type === "progress") {
        onProgress?.({
          stage: msg.stage,
          frame: msg.frame,
          total: msg.total,
          percentage: Math.round((msg.frame / msg.total) * 100),
        });
      } else if (msg.type === "done") {
        if (finish()) resolve({ blob: msg.blob, mime: msg.mime });
      } else if (msg.type === "error") {
        if (finish()) reject(new Error(msg.message));
      }
    };
    worker.onerror = (event) => {
      event.preventDefault();
      if (finish()) reject(new Error(`Export worker failed: ${event.message}`));
    };

    // Transfer ImageBitmap and audio buffer ownership to worker
    const transferList: Transferable[] = [
      ...Object.values(start.images),
      ...Object.values(start.texts).map((t) => t.bitmap),
      ...(start.audio ? start.audio.mix.channels.map((c) => c.buffer) : []),
    ];
    worker.postMessage(start, transferList);
  });
}

/** Same render and encode loop as the worker, on the main thread (no OffscreenCanvas). */
export async function encodeMainThread(
  doc: ProjectDoc,
  provider: AssetProvider,
  start: StartMessage,
  signal?: AbortSignal,
  onProgress?: (p: ExportProgress) => void,
): Promise<{ blob: Blob; mime: string }> {
  const { settings, width, height } = start;
  const canvas = createCanvas(width, height);
  const ss = settings.supersample;
  const engine = await Engine.create(canvas, {
    width,
    height,
    supersample: ss === 2 ? 2 : ss === 1.5 ? 1.5 : 1,
    preserveDrawingBuffer: true,
  });

  try {
    return await encodeFrames(engine, doc, provider, canvas, start, signal, onProgress);
  } finally {
    engine.dispose();
  }
}

async function encodeFrames(
  engine: Engine,
  doc: ProjectDoc,
  provider: AssetProvider,
  canvas: HTMLCanvasElement | OffscreenCanvas,
  start: StartMessage,
  signal?: AbortSignal,
  onProgress?: (p: ExportProgress) => void,
): Promise<{ blob: Blob; mime: string }> {
  const { settings, codec, container, bitrate, audio } = start;
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
    quality: new Quality({ bitrate }),
    keyFrameInterval: keyframeIntervalFor(settings.quality),
  });

  output.addVideoTrack(source, { frameRate: fps });
  const audioSource = audio ? addAudioTrackToOutput(output, audio) : null;
  await output.start();

  for (let frame = 0; frame < totalFrames; frame++) {
    signal?.throwIfAborted();

    const t = frame / fps;
    if (settings.motionBlur) {
      engine.renderAccumulated(t, motionBlurShutter(fps), MOTION_BLUR_SAMPLES);
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

  const mime = container === "mp4" ? "video/mp4" : "video/webm";
  const blob = new Blob([target.buffer as ArrayBuffer], { type: mime });
  return { blob, mime };
}
