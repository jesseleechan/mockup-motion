import type { Aspect, AssetRef, Layout } from "../../doc/types";
import { aspectRatioValue } from "../camera";
import { ease } from "../easing";
import { type LayoutNode, screenAspectFor } from "./types";

type SliderLayout = Extract<Layout, { kind: "slider" }>;

// Quality bar §2.2 (carousel steps): each step is a 1.85 s move on `slide`, then a hold.
export const SLIDER_MOVE_DURATION = 1.85;

// Quality bar §4 (slider): every card but the active one sits at this scale and opacity.
const NEIGHBOUR_SCALE = 0.75;
const NEIGHBOUR_OPACITY = 0.65;

const PHONE_SCREEN_ASPECT = 0.4615;
const DESKTOP_CARD_ASPECT = 1.6;

// Active card size (quality bar §4). These reproduce docs/presets-plan/reference.md at 4:5:
// a 0.29 × 0.63 mobile card on x, a 0.67 × 0.42 desktop card on y.
const X_CARD_HEIGHT = 0.63; // of the frame height
const X_MAX_CARD_WIDTH = 0.52; // of the frame width
const Y_CARD_WIDTH = 0.84; // of the frame width
const Y_MAX_CARD_HEIGHT = 0.5; // of the frame height

// The reference gaps at 4:5 (0.128 stage units on x, 0.115 on y), kept as a fraction of the
// active card's size along the axis so the gap scales with the card at other aspects.
const REFERENCE_FRAME_WIDTH_4X5 = 0.8;
const X_GAP_RATIO = 0.128 / (X_CARD_HEIGHT * PHONE_SCREEN_ASPECT);
const Y_GAP_RATIO = 0.115 / ((Y_CARD_WIDTH * REFERENCE_FRAME_WIDTH_4X5) / DESKTOP_CARD_ASPECT);

/** Shot length that keeps a slider loop seamless: one step per screenshot. */
export function sliderDuration(layout: SliderLayout): number {
  return Math.max(1, layout.assetIds.length) * layout.step;
}

/** Completed steps `k` and the eased progress `p` of the current step at shot time `t`. */
export function sliderStep(t: number, step: number): { k: number; p: number } {
  const time = Math.max(0, t);
  const k = Math.floor(time / step);
  const move = Math.min(SLIDER_MOVE_DURATION, step);
  return { k, p: ease("slide", (time - k * step) / move) };
}

function cardSize(axis: SliderLayout["axis"], frameWidth: number, screenAspect: number) {
  if (axis === "x") {
    const height = Math.min(X_CARD_HEIGHT, (X_MAX_CARD_WIDTH * frameWidth) / screenAspect);
    return { width: height * screenAspect, height };
  }
  const width = Math.min(Y_CARD_WIDTH * frameWidth, Y_MAX_CARD_HEIGHT * screenAspect);
  return { width, height: width / screenAspect };
}

/**
 * A ring of cards on one axis that steps one slot per `step` seconds (quality bar §2.2, §4).
 *
 * Node ids and sizes do not depend on time (the device pool builds devices from the layout at
 * t = 0), so every node is a fixed card with a fixed screenshot; neighbours shrink through
 * `transform.scale`. The ring holds a whole number of asset periods, so after N steps every
 * card is back where it started and the loop is native.
 *
 * When there are too few screenshots to fill every slot that can show during a step, only a
 * window of N consecutive slots is lit. Each step the window moves one slot: the card leaving
 * it fades out over the first half of the step and the card entering it (the same screenshot)
 * fades in over the second half, so a screenshot never appears twice in view.
 */
export function resolveSliderLayout(
  layout: SliderLayout,
  aspect: Aspect,
  assets: AssetRef[],
  shotT: number,
): LayoutNode[] {
  const { axis, shape, step } = layout;
  const frameWidth = aspectRatioValue(aspect);
  const ids: (string | null)[] = layout.assetIds.length > 0 ? layout.assetIds : [null];
  const N = ids.length;

  const aspectOf = (assetId: string | null): number => {
    if (shape === "mobile") return PHONE_SCREEN_ASPECT;
    return screenAspectFor(
      "card",
      assets.find((a) => a.id === assetId),
    );
  };
  const alongOf = (size: { width: number; height: number }) =>
    axis === "x" ? size.width : size.height;

  const nominal = alongOf(
    cardSize(axis, frameWidth, shape === "mobile" ? PHONE_SCREEN_ASPECT : DESKTOP_CARD_ASPECT),
  );
  const gap = (axis === "x" ? X_GAP_RATIO : Y_GAP_RATIO) * nominal;
  const spacing = nominal / 2 + gap + (NEIGHBOUR_SCALE * nominal) / 2;

  const node = (j: number, d: number, factor: number): LayoutNode => {
    const assetId = ids[j % N];
    const screenAspect = aspectOf(assetId);
    const { width, height } = cardSize(axis, frameWidth, screenAspect);
    const away = Math.min(1, Math.abs(d));
    const position = d * spacing;
    return {
      id: `slider:${j}`,
      device: "card",
      assetId,
      width,
      height,
      screenAspect,
      transform: {
        // The next card waits on the right (x) or below (y) and moves left or up.
        x: axis === "x" ? position : 0,
        y: axis === "y" ? 0 - position : 0, // 0 - x, not -x, so the active card has no -0
        z: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        scale: 1 - (1 - NEIGHBOUR_SCALE) * away,
      },
      opacity: (1 - (1 - NEIGHBOUR_OPACITY) * away) * factor,
      scroll: 0,
      // The card nearest the active slot draws last.
      depthOrder: 0 - Math.abs(d),
    };
  };

  if (N === 1) return [node(0, 0, 1)];

  // Slots 0..reach (each side) can show at rest; slot reach + 1 enters during a step.
  const halfFrame = axis === "x" ? frameWidth / 2 : 0.5;
  const maxAlong = Math.max(...ids.map((id) => alongOf(cardSize(axis, frameWidth, aspectOf(id)))));
  let reach = 0;
  while ((reach + 1) * spacing - (NEIGHBOUR_SCALE * maxAlong) / 2 < halfFrame) reach++;

  // A step can show 2 × reach + 2 slots. The ring covers them with whole asset periods, so a
  // card only wraps from one end to the other while it is outside the frame.
  const ringCount = N * Math.ceil((2 * reach + 2) / N);
  const windowed = N <= 2 * reach + 1;
  const left = Math.floor((N - 1) / 2); // lit slots left of the active one at rest

  const { k, p } = sliderStep(shotT, step);
  const u = k + p;
  const nodes: LayoutNode[] = [];
  for (let j = 0; j < ringCount; j++) {
    const raw = j - u + ringCount / 2;
    const d = (((raw % ringCount) + ringCount) % ringCount) - ringCount / 2;
    let factor = 1;
    if (windowed) {
      const m = Math.round(d + p); // slot relative to the step's start
      if (m === -left) factor = Math.max(0, 1 - 2 * p);
      else if (m === N - left) factor = Math.max(0, 2 * p - 1);
      else factor = m > -left && m < N - left ? 1 : 0;
    }
    nodes.push(node(j, d, factor));
  }
  return nodes;
}
