import type { Aspect, AssetRef, Layout } from "../../doc/types";
import { PHONE_SCREEN_ASPECT } from "../phone-spec";
import { sliderAssetIds } from "./duration";
import { singleDeviceSize } from "./single";
import { sliderStep } from "./slider";
import { type LayoutNode, type ScreenPane, screenAspectFor } from "./types";

type TourLayout = Extract<Layout, { kind: "tour" }>;

/** The whole screen: a tour's pages are clipped only by the screen's own edges. */
const WHOLE_SCREEN: readonly [number, number] = [0, 1];

/**
 * The panes of a screen that steps through `ids` on the slider's step timing (quality bar §2.2):
 * during step k, page k mod N leaves to the left while the next page slides in from the right,
 * edge to edge, both moved by the step's eased progress p and clipped to the screen. After N
 * steps the first page is back, so frame(N × step) is frame(0).
 *
 * Every page is listed, in `ids` order, so the engine loads and uploads each once; the pages that
 * are not on the screen wait just past its right edge, where they draw nothing. With one page it
 * stays put. Site Tour uses it on a browser or a phone; a stepping card (Responsive Tour)
 * can use it as it is.
 */
export function steppingPanes(
  ids: readonly (string | null)[],
  step: number,
  t: number,
): ScreenPane[] {
  const N = ids.length;
  if (N <= 1) return ids.map((assetId) => ({ assetId, offset: 0, clip: WHOLE_SCREEN, scroll: 0 }));
  const { k, p } = sliderStep(t, step);
  const current = k % N;
  const next = (k + 1) % N;
  return ids.map((assetId, i) => {
    // Waiting just past the right edge; the leaving page goes there once it is off the screen,
    // so the hold before the loop point lists the same panes as frame 0.
    let offset = 1;
    if (i === next) offset = 1 - p;
    // 0 - p, not -p, so the page at rest has no -0.
    else if (i === current && p < 1) offset = 0 - p;
    return { assetId, offset, clip: WHOLE_SCREEN, scroll: 0 };
  });
}

/** The pane that covers most of the screen; a tie goes to the later pane, which draws on top. */
export function mainPane(panes: readonly ScreenPane[]): ScreenPane | undefined {
  const covered = (pane: ScreenPane) => {
    const left = Math.max(pane.clip[0], pane.offset, 0);
    const right = Math.min(pane.clip[1], pane.offset + 1, 1);
    return Math.max(0, right - left);
  };
  // Later panes draw over earlier ones, so they win a tie.
  return panes.reduce<ScreenPane | undefined>(
    (best, pane) => (!best || covered(pane) >= covered(best) ? pane : best),
    undefined,
  );
}

/** The device a tour shows its pages on, and its screen's aspect. */
export interface TourGeometry {
  width: number;
  height: number;
  screenAspect: number;
}

/**
 * Site Tour's device (quality bar §4): the single-device size Scroll Story uses, a browser 0.68
 * of the frame width wide at 16:9 and 4:3 and 0.86 at the other aspects, or a phone 0.74 of the
 * frame height tall. The browser's screen takes the first page's aspect by the desktop rule
 * (quality bar §3.1); every page is fit to that screen's width.
 */
export function tourGeometry(layout: TourLayout, aspect: Aspect, assets: AssetRef[]): TourGeometry {
  const first = sliderAssetIds(layout)[0];
  const screenAspect =
    layout.device === "phone"
      ? PHONE_SCREEN_ASPECT
      : screenAspectFor(
          "browser",
          assets.find((a) => a.id === first),
        );
  return { ...singleDeviceSize(layout.device, aspect, screenAspect), screenAspect };
}

/**
 * Site Tour (quality bar §2.2, §4): one browser or phone, centred and still, whose screen steps
 * through the pages. The node is the same device in every frame; its `panes` move.
 */
export function resolveTourLayout(
  layout: TourLayout,
  aspect: Aspect,
  assets: AssetRef[],
  shotT: number,
): LayoutNode[] {
  // A shot shows at most 18 screenshots, so it fits in 30 s (duration.ts).
  const shown = sliderAssetIds(layout);
  const ids: (string | null)[] = shown.length > 0 ? shown : [null];
  const panes = steppingPanes(ids, layout.step, shotT);
  const { width, height, screenAspect } = tourGeometry(layout, aspect, assets);
  return [
    {
      // No digit in the id: a screenshot dropped on the screen joins the end of the tour.
      id: "tour:screen",
      device: layout.device,
      assetId: mainPane(panes)?.assetId ?? null,
      width,
      height,
      screenAspect,
      transform: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 },
      opacity: 1,
      scroll: 0,
      depthOrder: 0,
      panes,
    },
  ];
}
