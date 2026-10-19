import type { Aspect, AssetRef, Layout, Shot } from "../../doc/types";
import { resolveDeckLayout } from "./deck";
import { resolveColumnsLayout } from "./columns";
import { resolvePairLayout } from "./pair";
import { resolveResponsiveLayout } from "./responsive";
import { resolveRowsLayout } from "./rows";
import { resolveSingleLayout } from "./single";
import { resolveSliderLayout } from "./slider";
import { resolveStackLayout } from "./stack";
import { resolveTitleLayout } from "./title";
import { resolveTrioLayout } from "./trio";
import type { LayoutNode } from "./types";
import { resolveWallLayout } from "./wall";

export * from "./types";
export { resolveSingleLayout } from "./single";
export { resolvePairLayout } from "./pair";
export { resolveTrioLayout } from "./trio";
export { framesAssetIds, framesDuration, resolveRowsLayout, rowsGeometry } from "./rows";
export {
  clampSliderStep,
  fixedShotCamera,
  fixedShotDuration,
  MAX_SHOT_DURATION,
  minShotDuration,
  SLIDER_MAX_SCREENSHOTS,
  SLIDER_MAX_STEP,
  SLIDER_MIN_STEP,
  sliderAssetIds,
  sliderDuration,
  sliderStepMax,
} from "./duration";
export { columnsGeometry, resolveColumnsLayout } from "./columns";
export { lanesAssetIds, lanesDuration, resolveLanes } from "./lanes";
export type { LaneAxis, LaneGeometry, LaneOptions } from "./lanes";
export { resolveWallLayout } from "./wall";
export {
  RESPONSIVE_DESKTOP_ASPECT,
  RESPONSIVE_MOBILE_ASPECT,
  resolveResponsiveLayout,
  responsiveGeometry,
} from "./responsive";
export { resolveStackLayout } from "./stack";
export { resolveTitleLayout } from "./title";
export { resolveSliderLayout, sliderStep, SLIDER_MOVE_DURATION } from "./slider";
export { deckDepth, resolveDeckLayout } from "./deck";

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
    case "pair":
      return resolvePairLayout(layout, aspect, assets, shotT, shotDuration, entrance);
    case "trio":
      return resolveTrioLayout(layout, aspect, assets, shotT, shotDuration, entrance);
    case "rows":
      return resolveRowsLayout(layout, aspect, assets, shotT, shotDuration, entrance);
    case "columns":
      return resolveColumnsLayout(layout, aspect, assets, shotT, shotDuration, entrance);
    case "wall":
      return resolveWallLayout(layout, aspect, assets, shotT, shotDuration, entrance);
    case "stack":
      return resolveStackLayout(layout, aspect, assets, shotT, shotDuration, entrance);
    case "slider":
      return layout.arrangement === "deck"
        ? resolveDeckLayout(layout, aspect, assets, shotT)
        : resolveSliderLayout(layout, aspect, assets, shotT);
    case "responsive":
      return resolveResponsiveLayout(layout, aspect, shotT, entrance);
    case "title":
      return resolveTitleLayout();
    default: {
      const _exhaustive: never = layout;
      return [];
    }
  }
}
