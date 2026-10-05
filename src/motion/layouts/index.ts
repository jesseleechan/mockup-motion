import type { Aspect, AssetRef, Layout, Shot } from "../../doc/types";
import { resolveColumnsLayout } from "./columns";
import { resolvePairLayout } from "./pair";
import { resolveRowsLayout } from "./rows";
import { resolveSingleLayout } from "./single";
import { resolveStackLayout } from "./stack";
import { resolveTitleLayout } from "./title";
import { resolveTrioLayout } from "./trio";
import type { LayoutNode } from "./types";
import { resolveWallLayout } from "./wall";

export * from "./types";
export { resolveSingleLayout } from "./single";
export { resolvePairLayout } from "./pair";
export { resolveTrioLayout } from "./trio";
export { resolveRowsLayout } from "./rows";
export { resolveColumnsLayout } from "./columns";
export { resolveWallLayout } from "./wall";
export { resolveStackLayout } from "./stack";
export { resolveTitleLayout } from "./title";

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
    case "title":
      return resolveTitleLayout();
    default: {
      const _exhaustive: never = layout;
      return [];
    }
  }
}
