import type { Aspect, AssetRef, Layout } from "../../doc/types";
import { aspectRatioValue } from "../camera";
import { orbitAssetIds } from "./duration";
import { sliderStep } from "./slider";
import { type LayoutNode, screenAspectFor } from "./types";

type OrbitLayout = Extract<Layout, { kind: "orbit" }>;

const PHONE_SCREEN_ASPECT = 0.4615;
const DESKTOP_CARD_ASPECT = 1.6;

// Quality bar §4 (orbit): a card's scale runs from BACK_SCALE at the back of the ring to 1 at
// the front, and its strength from the slider's 65% to 100% only near the front (z^4), so the
// front card stands out and the others read as one calm ring.
const BACK_SCALE = 0.58;
const BACK_STRENGTH = 0.65;
const STRENGTH_POWER = 4;

// The composition is centred between the front card's bottom edge and the back card's top
// edge: the back card's top is lift + (BACK_SCALE / 2) h0 above the front card's centre and the
// front card's bottom is h0 / 2 below it, so the centre sits (lift - 0.21 h0) / 2 above it.
const CENTRE_OFFSET = 0.5 - BACK_SCALE / 2;

/** The ring for one aspect: front card size, ring radius and how far the back rises. */
export interface OrbitGeometry {
  /** Front card size in stage units, at the nominal card aspect. */
  cardWidth: number;
  cardHeight: number;
  /** Half the ring's width: a card at the side of the ring sits this far from the centre. */
  radius: number;
  /** How much higher the back of the ring sits than the front. */
  lift: number;
  /** The front card's centre, below the frame centre so the whole ring is centred. */
  frontY: number;
}

/**
 * Quality bar §4 (orbit). Mobile: portrait cards 0.58 of the frame height tall, at most 0.42 of
 * the frame width wide; the ring is 1.25 card widths across each side, pulled in so a side card
 * keeps at least three quarters of its width in frame. Desktop: landscape cards 0.62 of the frame
 * width wide, at most 0.42 tall; the ring is 0.62 card widths across each side, as tight as a
 * side card allows.
 */
export function orbitGeometry(shape: OrbitLayout["shape"], aspect: Aspect): OrbitGeometry {
  const frameWidth = aspectRatioValue(aspect);
  let cardWidth: number;
  let cardHeight: number;
  let radius: number;
  let lift: number;
  if (shape === "mobile") {
    cardHeight = Math.min(0.58, (0.42 * frameWidth) / PHONE_SCREEN_ASPECT);
    cardWidth = cardHeight * PHONE_SCREEN_ASPECT;
    radius = Math.min(1.25 * cardWidth, frameWidth / 2 - 0.25 * cardWidth);
    lift = 0.42 * cardHeight;
  } else {
    cardWidth = Math.min(0.62 * frameWidth, 0.42 * DESKTOP_CARD_ASPECT);
    cardHeight = cardWidth / DESKTOP_CARD_ASPECT;
    radius = Math.min(0.62 * cardWidth, frameWidth / 2 - 0.2 * cardWidth);
    lift = 0.34 * cardHeight;
  }
  const frontY = 0 - (lift - CENTRE_OFFSET * cardHeight) / 2;
  return { cardWidth, cardHeight, radius, lift, frontY };
}

/**
 * Screenshots on a ring seen from slightly above (quality bar §2.2, §4). Each step turns the
 * ring one card, on the slider's step timing, so the next card comes in from the right and the
 * front card moves off to the left. After N steps the ring is back where it started, so the
 * loop is native.
 *
 * Cards always face the camera: nothing is tilted, so the front card is colour-exact. Depth is
 * shown by scale, height (further back sits higher), draw order and strength, a mix with the
 * background colour (the engine's `background` fade blend), never with the cards behind.
 * One node per screenshot, so no screenshot appears twice in view.
 */
export function resolveOrbitLayout(
  layout: OrbitLayout,
  aspect: Aspect,
  assets: AssetRef[],
  shotT: number,
): LayoutNode[] {
  const shown = orbitAssetIds(layout);
  const ids: (string | null)[] = shown.length > 0 ? shown : [null];
  const N = ids.length;
  const geometry = orbitGeometry(layout.shape, aspect);

  // The phase counts whole steps modulo N, so frame(N × step) is exactly frame(0).
  const { k, p } = sliderStep(shotT, layout.step);
  const phase = (k % N) + p;

  return ids.map((assetId, i) => {
    const screenAspect =
      layout.shape === "mobile"
        ? PHONE_SCREEN_ASPECT
        : screenAspectFor(
            "card",
            assets.find((a) => a.id === assetId),
          );
    // A card keeps the front card's width (fit to width, quality bar §3.1); a short desktop
    // screenshot gets a shorter card.
    const width = geometry.cardWidth;
    const height = width / screenAspect;

    const angle = (2 * Math.PI * (i - phase)) / N;
    // 1 at the front, -1 at the back.
    const depth = Math.cos(angle);
    const toBack = (1 - depth) / 2;
    const strength =
      BACK_STRENGTH + (1 - BACK_STRENGTH) * Math.pow(Math.max(0, depth), STRENGTH_POWER);
    return {
      id: `orbit:${i}`,
      device: "card",
      assetId,
      width,
      height,
      screenAspect,
      transform: {
        // 0 + x, so a card at the front or back has no -0.
        x: 0 + geometry.radius * Math.sin(angle),
        y: geometry.frontY + geometry.lift * toBack,
        z: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        scale: 1 - (1 - BACK_SCALE) * toBack,
      },
      opacity: strength,
      scroll: 0,
      // Nearer cards draw over further ones.
      depthOrder: depth,
    };
  });
}
