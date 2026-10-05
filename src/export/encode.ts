import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  Quality,
  WebMOutputFormat,
} from "mediabunny";
import type { ExportProgress, Project } from "../types";
import { renderScene } from "../rendering/renderer";
export type VideoCapability = {
  codec: "avc" | "vp9" | "vp8";
  format: "mp4" | "webm";
  method: "frames" | "recorder";
  mimeType: string;
};
export function bitrate(project: Project) {
  return (
    (project.exportSettings.quality === "high" ? 10_000_000 : 5_000_000) *
    (project.exportSettings.resolution / 1080) ** 2 *
    (project.exportSettings.fps / 30)
  );
}
export async function encodeCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  project: Project,
  capability: VideoCapability,
  signal: AbortSignal,
  onProgress: (p: ExportProgress) => void,
): Promise<Blob> {
  const ctx = canvas.getContext("2d") as
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error("Could not create a rendering canvas.");
  const output = new Output({
    format:
      capability.format === "mp4"
        ? new Mp4OutputFormat({ fastStart: "in-memory" })
        : new WebMOutputFormat(),
    target: new BufferTarget(),
  });
  const source = new CanvasSource(canvas, {
    codec: capability.codec,
    quality: new Quality({ bitrate: bitrate(project) }),
    keyFrameInterval: 2,
  });
  output.addVideoTrack(source, { frameRate: project.exportSettings.fps });
  const fps = project.exportSettings.fps,
    totalFrames = Math.round(project.composition.motion.duration * fps);
  try {
    signal.throwIfAborted();
    await output.start();
    for (let frame = 0; frame < totalFrames; frame++) {
      signal.throwIfAborted();
      renderScene({
        ctx,
        width: canvas.width,
        height: canvas.height,
        time: frame / fps,
        composition: project.composition,
        images: project.images,
      });
      await source.add(frame / fps, 1 / fps);
      if (frame % 4 === 0) {
        onProgress({
          stage: "rendering",
          percentage: Math.round((frame / totalFrames) * 92),
          currentFrame: frame,
          totalFrames,
        });
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    signal.throwIfAborted();
    source.close();
    onProgress({
      stage: "finishing",
      percentage: 96,
      currentFrame: totalFrames,
      totalFrames,
    });
    await output.finalize();
    signal.throwIfAborted();
    if (!output.target.buffer) throw new Error("The encoded video is empty.");
    return new Blob([output.target.buffer], { type: capability.mimeType });
  } finally {
    if (output.state !== "finalized" && output.state !== "canceled")
      await output.cancel();
  }
}
