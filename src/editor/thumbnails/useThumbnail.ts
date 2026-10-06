import { useEffect, useState } from "react";
import type { Aspect, ProjectDoc } from "../../doc/types";
import { useThumbnailRenderer } from "./context";
import { ThumbnailCancelledError } from "./ThumbnailRenderer";

/**
 * Object URL of `doc` at time `t`, or null until the first render lands. Keeps showing the
 * previous image while a newer one renders. `doc` should be memoised: a new object with the
 * same content is a cache hit, but still a request.
 */
export function useThumbnail(
  doc: ProjectDoc | null,
  t: number,
  aspect: Aspect,
  key: string,
): string | null {
  const renderer = useThumbnailRenderer();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!renderer || !doc) return;
    let active = true;
    renderer.render(doc, t, aspect, key).then(
      (next) => {
        if (active) setUrl(next);
      },
      (err: unknown) => {
        // Cancelled means a newer request or an unmount replaced this one.
        if (err instanceof ThumbnailCancelledError) return;
        console.error(`[Thumbnail] ${key} failed to render`, err);
      },
    );
    return () => {
      active = false;
    };
  }, [renderer, doc, t, aspect, key]);

  useEffect(() => {
    if (!renderer) return;
    return () => renderer.release(key);
  }, [renderer, key]);

  return url;
}
