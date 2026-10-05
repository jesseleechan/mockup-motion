import type { Project } from "../types";
import { outputDimensions } from "../rendering/geometry";
import { encodeCanvas, type VideoCapability } from "./encode";
self.onmessage = async (event: MessageEvent<{ project: Project; capability: VideoCapability }>) => {
  const { project, capability } = event.data;
  const bitmaps: ImageBitmap[] = [];
  try {
    const images = await Promise.all(
      project.images.map(async (image) => {
        if (!image.blob) throw new Error("A screenshot could not be loaded.");
        const bitmap = await createImageBitmap(image.blob);
        bitmaps.push(bitmap);
        return { ...image, imageElement: bitmap };
      }),
    );
    const { width, height } = outputDimensions(
      project.aspectRatio,
      project.exportSettings.resolution,
    );
    const canvas = new OffscreenCanvas(width, height);
    const blob = await encodeCanvas(
      canvas,
      { ...project, images },
      capability,
      new AbortController().signal,
      (p) => self.postMessage({ type: "progress", progress: p }),
    );
    self.postMessage({ type: "complete", blob });
  } catch (error) {
    self.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : "Export failed.",
    });
  } finally {
    bitmaps.forEach((b) => b.close());
  }
};
