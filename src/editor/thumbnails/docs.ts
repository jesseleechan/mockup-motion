import type { ProjectDoc, Shot } from "../../doc/types";

/** Fraction of the total where the Projects dialog thumbnail (and template poster) is taken. */
export const PROJECT_THUMBNAIL_FRACTION = 0.35;

/**
 * A one-shot, non-looping document that renders `shot` exactly as it plays in `base`
 * (same style, assets and aspect). Its time equals the shot's local time.
 */
export function shotThumbnailDoc(
  base: Pick<ProjectDoc, "style" | "assets" | "aspect" | "export">,
  shot: Shot,
): ProjectDoc {
  return {
    version: 2,
    id: `shot-thumbnail:${shot.id}`,
    name: "",
    createdAt: 0,
    updatedAt: 0,
    aspect: base.aspect,
    loop: false,
    assets: base.assets,
    style: base.style,
    shots: [shot],
    export: base.export,
  };
}
