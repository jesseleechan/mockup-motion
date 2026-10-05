import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  Quality,
  WebMOutputFormat,
} from "mediabunny";
import type { ExportSettings, ProjectDoc } from "../doc/types";
import { type AssetProvider, Engine, type TextRaster } from "../engine/Engine";
import { schedule } from "../motion";

export type ToWorker =
  | {
      type: "start";
      doc: ProjectDoc;
      images: Record<string, ImageBitmap>;
      texts: Record<string, TextRaster>;
      settings: ExportSettings;
      codec: "avc" | "vp9" | "av1";
      container: "mp4" | "webm";
      width: number;
      height: number;
    }
  | { type: "cancel" };

export type FromWorker =
  | {
      type: "progress";
      stage: "preparing" | "rendering" | "finishing";
      frame: number;
      total: number;
    }
  | { type: "done"; blob: Blob; mime: string }
  | { type: "error"; message: string };

function calculateBitrate(settings: ExportSettings, width: number, height: number): number {
  let baseBps = 16_000_000; // high
  if (settings.quality === "web") baseBps = 6_000_000;
  if (settings.quality === "master") baseBps = 40_000_000;

  const pixelScale = (width * height) / (1920 * 1080);
  const fpsScale = settings.fps / 30;
  return Math.round(baseBps * pixelScale * fpsScale);
}

let isCancelled = false;

if (typeof self !== "undefined" && typeof window === "undefined") {
  self.onmessage = async (e: MessageEvent<ToWorker>) => {
    const msg = e.data;
    if (msg.type === "cancel") {
      isCancelled = true;
      return;
    }

    if (msg.type === "start") {
      isCancelled = false;
      const { doc, images, settings, codec, container, width, height } = msg;

      try {
        const post = (data: FromWorker) => self.postMessage(data);
        const { total: duration } = schedule(doc);
        const fps = settings.fps;
        const totalFrames = Math.max(1, Math.round(duration * fps));

        post({ type: "progress", stage: "preparing", frame: 0, total: totalFrames });

        const canvas = new OffscreenCanvas(width, height);
        const engine = await Engine.create(canvas, {
          width,
          height,
          supersample: settings.supersample ?? 1,
          preserveDrawingBuffer: true,
        });

        const assetProvider: AssetProvider = {
          getImage: async (assetId: string) => {
            const bmp = images[assetId];
            if (!bmp) throw new Error(`Asset not provided to worker: ${assetId}`);
            return bmp;
          },
          getText: async (layer) => {
            const raster = msg.texts[layer.id];
            if (!raster) throw new Error(`Text raster not provided to worker: ${layer.id}`);
            return raster;
          },
        };

        await engine.setDocument(doc, assetProvider);

        const target = new BufferTarget();
        const format =
          container === "mp4"
            ? new Mp4OutputFormat({ fastStart: "in-memory" })
            : new WebMOutputFormat();

        const output = new Output({ format, target });
        const source = new CanvasSource(canvas, {
          codec,
          quality: new Quality({ bitrate: calculateBitrate(settings, width, height) }),
          keyFrameInterval: 2,
        });

        output.addVideoTrack(source, { frameRate: fps });
        await output.start();

        for (let frame = 0; frame < totalFrames; frame++) {
          if (isCancelled) {
            engine.dispose();
            return;
          }

          const t = frame / fps;
          if (settings.motionBlur) {
            engine.renderAccumulated(t, (1 / fps) * 0.5, 4);
          } else {
            engine.renderAt(t);
          }

          await source.add(t, 1 / fps);

          if (frame % 4 === 0 || frame === totalFrames - 1) {
            post({ type: "progress", stage: "rendering", frame, total: totalFrames });
          }
        }

        post({ type: "progress", stage: "finishing", frame: totalFrames, total: totalFrames });
        await output.finalize();
        engine.dispose();

        const mime = container === "mp4" ? "video/mp4" : "video/webm";
        const blob = new Blob([target.buffer as ArrayBuffer], { type: mime });
        post({ type: "done", blob, mime });
      } catch (err: unknown) {
        self.postMessage({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        } satisfies FromWorker);
      }
    }
  };
}
