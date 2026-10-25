import type { AssetRef } from "../../doc/types";

/**
 * The Library's tiles and the inspector's screenshot thumbnails are 16:10, the shape of a desktop
 * viewport capture, so a viewport screenshot fills its tile exactly.
 */
export const TILE_ASPECT = 16 / 10;

/** How a screenshot fills a preview box: `cover` cuts only its bottom, `contain` shows it whole. */
export type TileFit = "cover" | "contain";

/**
 * The fit for a screenshot in a box of `boxAspect` (width / height), drawn from the top. A
 * screenshot no wider than the box covers it, so only its bottom is cut; a wider one shows whole.
 * A page is never cropped at the sides (quality bar §3). A phone screen (a mobile screenshot that
 * isn't a full page) also shows whole, so it reads as a screen; leave out `role` to cover with it.
 */
export function tileFit(
  asset: Pick<AssetRef, "width" | "height" | "role" | "meta">,
  boxAspect: number,
): TileFit {
  const aspect = asset.width && asset.height ? asset.width / asset.height : boxAspect;
  const phoneScreen = asset.role === "mobile" && !asset.meta?.tall;
  return !phoneScreen && aspect <= boxAspect ? "cover" : "contain";
}
