import { canEncodeVideo, Quality } from "mediabunny";
import type { ExportProgress, ExportResult, Project } from "../types";
import { outputDimensions } from "../rendering/geometry";
import { renderScene } from "../rendering/renderer";
import { bitrate, encodeCanvas, type VideoCapability } from "./encode";
export type { VideoCapability } from "./encode";
export async function probeExport(project: Project): Promise<VideoCapability> {
  const { width, height } = outputDimensions(
    project.aspectRatio,
    project.exportSettings.resolution,
  );
  const options = {
    width,
    height,
    frameRate: project.exportSettings.fps,
    quality: new Quality({ bitrate: bitrate(project) }),
  };
  if (typeof VideoEncoder !== "undefined") {
    for (const codec of (project.exportSettings.format === "mp4"
      ? ["avc", "vp9", "vp8"]
      : ["vp9", "vp8"]) as VideoCapability["codec"][]) {
      try {
        if (await canEncodeVideo(codec, options))
          return {
            codec,
            format: codec === "avc" ? "mp4" : "webm",
            method: "frames",
            mimeType: codec === "avc" ? "video/mp4" : "video/webm",
          };
      } catch {}
    }
  }
  if (typeof MediaRecorder !== "undefined")
    for (const mimeType of project.exportSettings.format === "mp4"
      ? [
          "video/mp4;codecs=avc1",
          "video/mp4",
          "video/webm;codecs=vp9",
          "video/webm",
        ]
      : ["video/webm;codecs=vp9", "video/webm"])
      if (MediaRecorder.isTypeSupported(mimeType))
        return {
          codec: mimeType.includes("mp4") ? "avc" : "vp9",
          format: mimeType.includes("mp4") ? "mp4" : "webm",
          method: "recorder",
          mimeType,
        };
  throw new Error(
    "Video encoding is unavailable in this browser. Try Chrome or export a PNG.",
  );
}
function encodeInWorker(
  project: Project,
  capability: VideoCapability,
  signal: AbortSignal,
  onProgress: (p: ExportProgress) => void,
) {
  return new Promise<Blob>((resolve, reject) => {
    const worker = new Worker(new URL("./video.worker.ts", import.meta.url), {
      type: "module",
    });
    const cleanup = () => {
      signal.removeEventListener("abort", abort);
      worker.terminate();
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Export cancelled", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    worker.onmessage = (event) => {
      if (event.data.type === "progress") onProgress(event.data.progress);
      else {
        cleanup();
        event.data.type === "complete"
          ? resolve(event.data.blob)
          : reject(new Error(event.data.error));
      }
    };
    worker.onerror = (event) => {
      cleanup();
      reject(new Error(event.message || "The export worker stopped."));
    };
    const images = project.images.map(
      ({ imageElement: _element, ...image }) => image,
    );
    worker.postMessage({ project: { ...project, images }, capability });
  });
}
async function recordCanvas(
  canvas: HTMLCanvasElement,
  project: Project,
  capability: VideoCapability,
  signal: AbortSignal,
  onProgress: (p: ExportProgress) => void,
): Promise<Blob> {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create a rendering canvas.");
  renderScene({
    ctx,
    width: canvas.width,
    height: canvas.height,
    time: 0,
    composition: project.composition,
    images: project.images,
  });
  const stream = canvas.captureStream(project.exportSettings.fps);
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, {
      mimeType: capability.mimeType,
      videoBitsPerSecond: bitrate(project),
    });
  } catch (error) {
    stream.getTracks().forEach((t) => t.stop());
    throw error;
  }
  return new Promise((resolve, reject) => {
    const chunks: Blob[] = [];
    let frame = 0,
      finished = false;
    const totalFrames = Math.round(
      project.composition.motion.duration * project.exportSettings.fps,
    );
    const cleanup = () => {
      cancelAnimationFrame(frame);
      stream.getTracks().forEach((t) => t.stop());
      signal.removeEventListener("abort", abort);
    };
    const fail = (error: unknown) => {
      if (finished) return;
      finished = true;
      cleanup();
      if (recorder.state !== "inactive") recorder.stop();
      reject(error);
    };
    const abort = () =>
      fail(new DOMException("Export cancelled", "AbortError"));
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onerror = () => fail(new Error("The video recorder stopped."));
    recorder.onstop = () => {
      cleanup();
      if (finished) return;
      finished = true;
      const blob = new Blob(chunks, { type: capability.mimeType });
      blob.size
        ? resolve(blob)
        : reject(new Error("The recorder returned an empty video."));
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    recorder.start();
    const start = performance.now();
    const draw = (now: number) => {
      if (finished) return;
      try {
        const time = Math.min(
          (now - start) / 1000,
          project.composition.motion.duration,
        );
        renderScene({
          ctx,
          width: canvas.width,
          height: canvas.height,
          time,
          composition: project.composition,
          images: project.images,
        });
        onProgress({
          stage: "rendering",
          percentage: Math.round(
            (time / project.composition.motion.duration) * 95,
          ),
          currentFrame: Math.round(time * project.exportSettings.fps),
          totalFrames,
        });
        if (time < project.composition.motion.duration)
          frame = requestAnimationFrame(draw);
        else recorder.stop();
      } catch (error) {
        fail(error);
      }
    };
    frame = requestAnimationFrame(draw);
  });
}
export async function exportVideo(
  project: Project,
  capability: VideoCapability,
  signal: AbortSignal,
  onProgress: (p: ExportProgress) => void,
): Promise<ExportResult> {
  const { width, height } = outputDimensions(
      project.aspectRatio,
      project.exportSettings.resolution,
    ),
    fps = project.exportSettings.fps,
    duration = project.composition.motion.duration;
  onProgress({
    stage: "preparing",
    percentage: 0,
    currentFrame: 0,
    totalFrames: duration * fps,
  });
  signal.throwIfAborted();
  await document.fonts.ready;
  let blob: Blob;
  if (
    capability.method === "frames" &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof Worker !== "undefined" &&
    typeof createImageBitmap !== "undefined"
  )
    blob = await encodeInWorker(project, capability, signal, onProgress);
  else {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    blob =
      capability.method === "frames"
        ? await encodeCanvas(canvas, project, capability, signal, onProgress)
        : await recordCanvas(canvas, project, capability, signal, onProgress);
  }
  signal.throwIfAborted();
  const extension = capability.format;
  return {
    url: URL.createObjectURL(blob),
    mimeType: blob.type,
    extension,
    filename: `${safeName(project.name)}.${extension}`,
    width,
    height,
    fps,
    duration,
    size: blob.size,
  };
}
export function safeName(name: string) {
  return (
    name
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "") || "mockup-motion"
  );
}
export async function exportPng(
  project: Project,
  time: number,
): Promise<ExportResult> {
  await document.fonts.ready;
  const { width, height } = outputDimensions(
      project.aspectRatio,
      project.exportSettings.resolution,
    ),
    canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create an image canvas.");
  renderScene({
    ctx,
    width,
    height,
    time,
    composition: project.composition,
    images: project.images,
  });
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Could not create a PNG.")),
      "image/png",
    ),
  );
  return {
    url: URL.createObjectURL(blob),
    mimeType: "image/png",
    extension: "png",
    filename: `${safeName(project.name)}.png`,
    width,
    height,
    fps: 0,
    duration: 0,
    size: blob.size,
  };
}
