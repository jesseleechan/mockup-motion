import type { ProjectDoc } from "../../doc/types";
import type { AssetProvider, Engine } from "../../engine/Engine";
import type { ThumbnailBackend } from "./ThumbnailRenderer";

const THUMBNAIL_TYPE = "image/webp";
const THUMBNAIL_QUALITY = 0.85;

type ThumbnailCanvas = HTMLCanvasElement | OffscreenCanvas;

function createCanvas(width: number, height: number): ThumbnailCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function canvasToBlob(canvas: ThumbnailCanvas): Promise<Blob> {
  if (canvas instanceof HTMLCanvasElement) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Thumbnail canvas produced no image"))),
        THUMBNAIL_TYPE,
        THUMBNAIL_QUALITY,
      );
    });
  }
  return canvas.convertToBlob({ type: THUMBNAIL_TYPE, quality: THUMBNAIL_QUALITY });
}

/**
 * One Engine on its own canvas (one WebGL context), created on the first render and
 * resized per request. three.js loads with it, outside the editor's initial bundle.
 */
export function createEngineThumbnailBackend(provider: AssetProvider): ThumbnailBackend {
  let canvas: ThumbnailCanvas | null = null;
  let engine: Promise<Engine> | null = null;
  let disposed = false;

  const getEngine = (width: number, height: number): Promise<Engine> => {
    if (!engine) {
      canvas = createCanvas(width, height);
      const target = canvas;
      engine = import("../../engine/Engine").then(({ Engine: EngineClass }) =>
        EngineClass.create(target, {
          width,
          height,
          supersample: 1,
          // The canvas is read back after renderAt, outside the frame that drew it.
          preserveDrawingBuffer: true,
        }),
      );
    }
    return engine;
  };

  return {
    async render(doc: ProjectDoc, t: number, width: number, height: number): Promise<Blob> {
      if (disposed) throw new Error("Thumbnail backend is disposed");
      const instance = await getEngine(width, height);
      instance.resize(width, height);
      await instance.setDocument(doc, provider);
      instance.renderAt(t);
      if (!canvas) throw new Error("Thumbnail canvas is missing");
      return canvasToBlob(canvas);
    },

    dispose() {
      disposed = true;
      const pending = engine;
      engine = null;
      canvas = null;
      // An engine still being created is disposed as soon as it exists.
      void pending?.then((instance) => instance.dispose());
    },
  };
}
