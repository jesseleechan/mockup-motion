import type { Aspect, AssetRef, Layout } from "../../doc/types";
import { aspectRatioValue } from "../camera";
import { sliderAssetIds } from "./duration";
import { sliderStep } from "./slider";
import { type LayoutNode, screenAspectFor } from "./types";

type SliderLayout = Extract<Layout, { kind: "slider" }>;

// Quality bar §4 (Desktop Stack, Mobile Stack). The front card plus up to two behind it.
const MAX_DEPTH = 3;
// Each slot back is 6% smaller.
const SLOT_SCALE_STEP = 0.06;
// How far each slot back is offset along the peek direction, as a share of the card's length
// along the axis: below the front card on y, to its right on x.
const Y_PEEK = 0.12;
const X_PEEK = 0.2;
// Card size. y: at most 0.84 of the frame width wide, and the deck at most 0.86 of the frame
// height tall (the preview's 0.8 left the 16:9 front card at 58% of the frame width; 0.86 gives
// 62%, the low end for a single desktop device: quality bar §4, stack plan S04 review). x: at
// most 0.7 of the frame height tall, and the deck at most 0.86 of the frame width wide.
const Y_CARD_WIDTH = 0.84;
const Y_DECK_HEIGHT = 0.86;
const X_CARD_HEIGHT = 0.7;
const X_DECK_WIDTH = 0.86;
// The leaving card goes this far past the frame edge, so its edge is not left on the border.
const EXIT_MARGIN = 0.03;
// Overlapping cards draw in one pass with depth testing, so each slot back sits slightly
// behind the one in front. At the still camera this shrinks a card by about 0.2% per slot.
const SLOT_DEPTH = 0.005;

const PHONE_SCREEN_ASPECT = 0.4615;
const DESKTOP_CARD_ASPECT = 1.6;

/** Cards in view at rest: the front card and the ones behind it (quality bar §4). */
export function deckDepth(count: number): number {
  return count <= 1 ? 1 : Math.min(MAX_DEPTH, count - 1);
}

/**
 * A deck of flat cards on one axis (Desktop Stack on y, Mobile Stack on x). Each step the front
 * card leaves the frame (up on y, left on x) and every card behind it moves forward one slot,
 * on the slider's step timing (quality bar §2.2, §4).
 *
 * Every screenshot has one node with a fixed id and size, as in the carousel. During step k card
 * j is `s = (j − k) mod N` slots back: slot 0 leaves, slots 1…depth move to the slot in front,
 * the card coming from slot depth fades in, and the rest wait hidden at slot depth. After N
 * steps every card is back where it started, so the loop is native. A card only jumps back to
 * the end of the deck while it is out of the frame or hidden.
 */
export function resolveDeckLayout(
  layout: SliderLayout,
  aspect: Aspect,
  assets: AssetRef[],
  shotT: number,
): LayoutNode[] {
  const { axis, shape, step } = layout;
  const frameWidth = aspectRatioValue(aspect);
  const shown = sliderAssetIds(layout);
  const ids: (string | null)[] = shown.length > 0 ? shown : [null];
  const N = ids.length;
  const depth = deckDepth(N);

  const aspectOf = (assetId: string | null): number => {
    if (shape === "mobile") return PHONE_SCREEN_ASPECT;
    return screenAspectFor(
      "card",
      assets.find((a) => a.id === assetId),
    );
  };

  // The deck's nominal card sets the slots. Cards share its size across the axis, so a desktop
  // screenshot of another aspect only changes its card's length along y.
  const nominalAspect = shape === "mobile" ? PHONE_SCREEN_ASPECT : DESKTOP_CARD_ASPECT;
  const peekRatio = axis === "x" ? X_PEEK : Y_PEEK;
  const spread = 1 + (depth - 1) * peekRatio;
  const across =
    axis === "x"
      ? Math.min(X_CARD_HEIGHT, (X_DECK_WIDTH * frameWidth) / spread / nominalAspect)
      : Math.min(Y_CARD_WIDTH * frameWidth, (Y_DECK_HEIGHT / spread) * nominalAspect);
  const sizeOf = (screenAspect: number) =>
    axis === "x"
      ? { width: across * screenAspect, height: across }
      : { width: across, height: across / screenAspect };
  const along = (size: { width: number; height: number }) =>
    axis === "x" ? size.width : size.height;

  const nominal = along(sizeOf(nominalAspect));
  const peek = peekRatio * nominal;
  // Positions are measured toward the peek side: right on x, down on y. The deck at rest, from
  // the front card's far edge to the last card's peeking edge, is centred in the frame.
  // (1 - depth), not -(depth - 1), so a single card sits at 0 and not -0.
  const front = ((1 - depth) * (peek - (SLOT_SCALE_STEP / 2) * nominal)) / 2;
  const halfFrame = axis === "x" ? frameWidth / 2 : 0.5;

  const { k, p } = sliderStep(shotT, step);
  const nodes: LayoutNode[] = [];
  for (let j = 0; j < N; j++) {
    const assetId = ids[j];
    const screenAspect = aspectOf(assetId);
    const size = sizeOf(screenAspect);
    const s = (((j - k) % N) + N) % N;

    // r: slots back from the front at this moment (continuous during a step).
    let r: number;
    let position: number;
    let opacity = 1;
    if (N === 1) {
      r = 0;
      position = front;
    } else if (s === 0) {
      r = 0;
      const exit = -halfFrame - EXIT_MARGIN - along(size) / 2;
      position = front + (exit - front) * p;
      // Once it has left the frame it is not drawn, so the frame before the loop point draws
      // the same cards as the first frame.
      if (position + along(size) / 2 < -halfFrame) opacity = 0;
    } else if (s <= depth) {
      r = s - p;
      position = front + r * peek;
      // The card coming from slot depth was hidden behind the deck.
      if (s === depth) opacity = p;
    } else {
      r = depth;
      position = front + r * peek;
      opacity = 0;
    }

    nodes.push({
      id: `deck:${j}`,
      device: "card",
      assetId,
      width: size.width,
      height: size.height,
      screenAspect,
      transform: {
        x: axis === "x" ? position : 0,
        y: axis === "y" ? 0 - position : 0, // 0 - x, not -x, so a centred card has no -0
        z: 0 - r * SLOT_DEPTH,
        rx: 0,
        ry: 0,
        rz: 0,
        scale: 1 - SLOT_SCALE_STEP * r,
      },
      opacity,
      scroll: 0,
      // The front card draws last.
      depthOrder: 0 - r,
    });
  }
  return nodes;
}
