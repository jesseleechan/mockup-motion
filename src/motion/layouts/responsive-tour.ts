import type { Aspect, Layout } from "../../doc/types";
import { responsiveTourPageCount } from "./duration";
import {
  RESPONSIVE_DESKTOP_ASPECT,
  RESPONSIVE_MOBILE_ASPECT,
  responsiveGeometry,
} from "./responsive";
import { mainPane, steppingPanes } from "./tour";
import type { LayoutNode } from "./types";

type ResponsiveTourLayout = Extract<Layout, { kind: "responsive-tour" }>;

/** One page of a Responsive Tour: its desktop and mobile screenshots, null when one is missing. */
export interface ResponsiveTourPage {
  desktopId: string | null;
  mobileId: string | null;
}

/**
 * The pages a Responsive Tour shows, in order (presets round two D12): page i pairs the i-th
 * desktop screenshot with the i-th mobile one. A side without a screenshot is null, and shows the
 * empty-state fill.
 */
export function responsiveTourPages(layout: ResponsiveTourLayout): ResponsiveTourPage[] {
  return Array.from({ length: responsiveTourPageCount(layout) }, (_, i) => ({
    desktopId: layout.desktopIds[i] || null,
    mobileId: layout.mobileIds[i] || null,
  }));
}

/**
 * The pairs of a page list that show no screenshot twice: a pair that repeats an earlier pair's
 * desktop or mobile screenshot is left out, so a tour shows each page once. A template filled
 * from too few screenshots (`fillSlots` reuses one) or a user template uses it.
 */
export function distinctPages(
  desktopIds: readonly string[],
  mobileIds: readonly string[],
): { desktopIds: string[]; mobileIds: string[] } {
  const out = { desktopIds: [] as string[], mobileIds: [] as string[] };
  const count = Math.max(desktopIds.length, mobileIds.length);
  for (let i = 0; i < count; i++) {
    const desktop = desktopIds[i] ?? "";
    const mobile = mobileIds[i] ?? "";
    if (!desktop || !mobile) continue;
    if (out.desktopIds.includes(desktop) || out.mobileIds.includes(mobile)) continue;
    out.desktopIds.push(desktop);
    out.mobileIds.push(mobile);
  }
  return out;
}

/**
 * Responsive Tour (quality bar §2.2, §4): Responsive Scroll's desktop and mobile cards, still and
 * in Responsive Scroll's place at every aspect, whose screens step through the pages together.
 * Both cards' panes are `steppingPanes` on the same step and time, so during step k both leave
 * page k for page k + 1 at the same eased progress: the mobile screen moves in step with the
 * desktop one (D12). Every page shows its top.
 */
export function resolveResponsiveTourLayout(
  layout: ResponsiveTourLayout,
  aspect: Aspect,
  shotT: number,
): LayoutNode[] {
  const pages = responsiveTourPages(layout);
  const shown = pages.length > 0 ? pages : [{ desktopId: null, mobileId: null }];
  const { desktop, mobile } = responsiveGeometry(aspect);
  const cards = [
    {
      // No digit in the ids: a screenshot dropped on a card joins that side of the tour.
      id: "responsive-tour:desktop",
      card: desktop,
      screenAspect: RESPONSIVE_DESKTOP_ASPECT,
      ids: shown.map((page) => page.desktopId),
    },
    {
      id: "responsive-tour:mobile",
      card: mobile,
      screenAspect: RESPONSIVE_MOBILE_ASPECT,
      ids: shown.map((page) => page.mobileId),
    },
  ];
  return cards.map(({ id, card, screenAspect, ids }, order) => {
    const panes = steppingPanes(ids, layout.step, shotT);
    return {
      id,
      device: "card",
      assetId: mainPane(panes)?.assetId ?? null,
      width: card.width,
      height: card.height,
      screenAspect,
      transform: { x: card.x, y: card.y, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 },
      opacity: 1,
      scroll: 0,
      depthOrder: order,
      panes,
    };
  });
}
