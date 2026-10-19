import type { ProjectDoc } from "../../doc/types";

/** Which "Frame and effects" controls apply to a document (docs/polish-plan/inspectors.md P2). */
export interface FrameEffects {
  browserChrome: boolean;
  browserUrl: boolean;
  grain: boolean;
  vignette: boolean;
}

/**
 * Browser chrome only with a browser on screen, and its URL only when the chrome shows an
 * address bar. Grain and vignette only where they help: a gradient can band, a flat fill cannot
 * (quality-bar §6). A value already above 0 keeps its control, so a saved project can turn it off.
 */
export function frameEffectsFor(doc: Pick<ProjectDoc, "shots" | "style">): FrameEffects {
  const browser = doc.shots.some(
    (shot) =>
      (shot.layout.kind === "single" || shot.layout.kind === "rows") &&
      shot.layout.device === "browser",
  );
  const gradient = doc.style.background.kind === "gradient";
  return {
    browserChrome: browser,
    browserUrl: browser && doc.style.browserChrome !== "none",
    grain: gradient || doc.style.grain > 0,
    vignette: gradient || doc.style.vignette > 0,
  };
}
