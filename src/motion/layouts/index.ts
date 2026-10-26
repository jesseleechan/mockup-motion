import type { Aspect, AssetRef, Layout } from "../../doc/types";
import { resolveDeckLayout } from "./deck";
import { resolveColumnsLayout } from "./columns";
import { resolveResponsiveLayout } from "./responsive";
import { resolveRowsLayout } from "./rows";
import { resolveSingleLayout } from "./single";
import { resolveOrbitLayout } from "./orbit";
import { resolvePageColumnsLayout } from "./page-columns";
import { resolveSliderLayout } from "./slider";
import { resolveTourLayout } from "./tour";
import type { LayoutNode } from "./types";

export * from "./types";
export { resolveSingleLayout, singleDeviceSize } from "./single";
export { framesAssetIds, framesDuration, resolveRowsLayout, rowsGeometry } from "./rows";
export {
  clampSliderStep,
  clampSteppedStep,
  fixedShotCamera,
  fixedShotDuration,
  MAX_SHOT_DURATION,
  isSteppedLayout,
  isStillCamera,
  minShotDuration,
  minShotScreenshots,
  ORBIT_MAX_SCREENSHOTS,
  orbitAssetIds,
  SLIDER_MAX_SCREENSHOTS,
  SLIDER_MAX_STEP,
  SLIDER_MIN_STEP,
  sliderAssetIds,
  sliderDuration,
  sliderStepMax,
  steppedAssetIds,
  steppedStepMax,
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
export { mainPane, resolveTourLayout, steppingPanes, tourGeometry } from "./tour";
export type { TourGeometry } from "./tour";
export {
  PAGE_COLUMNS_MAX_LOOP,
  PAGE_COLUMNS_MAX_SCREENSHOTS,
  PAGE_COLUMNS_MIN_LOOP,
  PAGE_COLUMNS_SPEED_LIMIT,
  PAGE_COLUMNS_WRAP_OVERLAP,
  pageColumnScroll,
  pageColumns,
  pageColumnsAssetIds,
  pageColumnsCount,
  pageColumnsDefaultLoop,
  pageColumnsGeometry,
  pageColumnsLoop,
  pageColumnsPacedDuration,
  pageColumnsShortestLoop,
  resolvePageColumnsLayout,
} from "./page-columns";
export type { PageColumn, PageColumnsGeometry, PageColumnsLayout } from "./page-columns";

export function resolveLayout(
  layout: Layout,
  aspect: Aspect,
  assets: AssetRef[],
  shotT: number,
  shotDuration: number,
): LayoutNode[] {
  switch (layout.kind) {
    case "single":
      return resolveSingleLayout(layout, aspect, assets);
    case "rows":
      return resolveRowsLayout(layout, aspect, assets, shotT, shotDuration);
    case "columns":
      return resolveColumnsLayout(layout, aspect, assets, shotT, shotDuration);
    case "slider":
      return layout.arrangement === "deck"
        ? resolveDeckLayout(layout, aspect, assets, shotT)
        : resolveSliderLayout(layout, aspect, assets, shotT);
    case "orbit":
      return resolveOrbitLayout(layout, aspect, assets, shotT);
    case "tour":
      return resolveTourLayout(layout, aspect, assets, shotT);
    case "responsive":
      return resolveResponsiveLayout(layout, aspect);
    case "pageColumns":
      return resolvePageColumnsLayout(layout, aspect, assets, shotT, shotDuration);
    default: {
      const _exhaustive: never = layout;
      return [];
    }
  }
}
