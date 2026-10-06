import React, { useEffect, useState } from "react";
import { createEditorAssetProvider } from "../asset-provider";
import { ThumbnailContext } from "./context";
import { createEngineThumbnailBackend } from "./engine-backend";
import { ThumbnailRenderer } from "./ThumbnailRenderer";

declare global {
  interface Window {
    __thumbnailRenderer?: ThumbnailRenderer;
  }
}

/** Owns the editor's one ThumbnailRenderer (and its WebGL context) for the shell's lifetime. */
export const ThumbnailProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Constructing is side-effect free: the backend creates its Engine on the first render.
  const [renderer] = useState(
    () =>
      new ThumbnailRenderer({
        backend: createEngineThumbnailBackend(createEditorAssetProvider()),
        pixelRatio: window.devicePixelRatio || 1,
      }),
  );

  useEffect(() => {
    if (import.meta.env.DEV) window.__thumbnailRenderer = renderer;
    return () => {
      renderer.dispose();
      if (import.meta.env.DEV && window.__thumbnailRenderer === renderer) {
        delete window.__thumbnailRenderer;
      }
    };
  }, [renderer]);

  return <ThumbnailContext.Provider value={renderer}>{children}</ThumbnailContext.Provider>;
};
