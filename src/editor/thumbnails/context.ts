import { createContext, useContext } from "react";
import type { ThumbnailRenderer } from "./ThumbnailRenderer";

/** The editor's shared renderer; null until ThumbnailProvider has created it. */
export const ThumbnailContext = createContext<ThumbnailRenderer | null>(null);

export function useThumbnailRenderer(): ThumbnailRenderer | null {
  return useContext(ThumbnailContext);
}
