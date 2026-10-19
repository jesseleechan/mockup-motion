import type { Aspect, AssetRef, Layout, Shot } from "../../doc/types";
import { resolveDeckLayout } from "./deck";
import { resolveColumnsLayout } from "./columns";
import { resolveResponsiveLayout } from "./responsive";
import { resolveRowsLayout } from "./rows";
import { resolveSingleLayout } from "./single";
import { resolveOrbitLayout } from "./orbit";
import { resolveSliderLayout } from "./slider";
import type { LayoutNode } from "./types";

export * from "./types";
export { resolveSingleLayout } from "./single";
export { framesAssetIds, framesDuration, resolveRowsLayout, rowsGeometry } from "./rows";
export {
  clampSliderStep,
  fixedShotCamera,
  fixedShotDuration,
  MAX_SHOT_DURATION,
  isSteppedLayout,
  minShotDuration,
  ORBIT_MAX_SCREENSHOTS,
  orbitAssetIds,
  SLIDER_MAX_SCREENSHOTS,
  SLIDER_MAX_STEP,
  SLIDER_MIN_STEP,
  sliderAssetIds,
  sliderDuration,
  sliderStepMax,
  steppedAssetIds,
} from "./duration";
export type { SteppedLayout } from "./duration";
export { columnsGeometry, resolveColumnsLayout } from "./columns";
export { lanesAssetIds, lanesDuration, resolveLanes } from "./lanes";
export type { LaneAxis, LaneGeometry, LaneOptions } from "./lanes";
export {
  RESPONSIVE_DESKTOP_ASPECT,
  RESPONSIVE_MOBILE_ASPECT,
  resolveResponsiveLayout,
  responsiveGeometry,
} from "./responsive";
export { resolveSliderLayout, sliderStep, SLIDER_MOVE_DURATION } from "./slider";
export { deckDepth, resolveDeckLayout } from "./deck";
export { orbitGeometry, resolveOrbitLayout } from "./orbit";
export type { OrbitGeometry } from "./orbit";

export function resolveLayout(
  layout: Layout,
  aspect: Aspect,
  assets: AssetRef[],
  shotT: number,
  shotDuration: number,
  entrance: Shot["entrance"] = "none",
): LayoutNode[] {
  switch (layout.kind) {
    case "single":
      return resolveSingleLayout(layout, aspect, assets, shotT, shotDuration, entrance);
    case "rows":
      return resolveRowsLayout(layout, aspect, assets, shotT, shotDuration, entrance);
    case "columns":
      return resolveColumnsLayout(layout, aspect, assets, shotT, shotDuration, entrance);
    case "slider":
      return layout.arrangement === "deck"
        ? resolveDeckLayout(layout, aspect, assets, shotT)
        : resolveSliderLayout(layout, aspect, assets, shotT);
    case "orbit":
      return resolveOrbitLayout(layout, aspect, assets, shotT);
    case "responsive":
      return resolveResponsiveLayout(layout, aspect, shotT, entrance);
    default: {
      const _exhaustive: never = layout;
      return [];
    }
  }
}
