/**
 * Responsive Scroll: two screens of one page (desktop and mobile) scroll together and stop on the
 * same sections (contracts.md §5, quality-bar §2.2). Positions here are image px of each screen's
 * screenshot; `LayoutNode.scroll` gets them as fractions of the scrollable range.
 */
import type { AssetRef, CaptureSection, Layout, ScrollSpec } from "../doc/types";
import { ease } from "./easing";
import { MAX_SHOT_DURATION } from "./layouts/limits";
import { RESPONSIVE_DESKTOP_ASPECT, RESPONSIVE_MOBILE_ASPECT } from "./layouts/responsive";

// The average rate of `scroll.ts` (quality bar §2.2), applied to the screen that travels further.
const SCREENS_PER_SECOND = 0.9;
// Stops the default picker adds after the top (quality bar §2.2: top plus three sections).
const DEFAULT_SECTION_STOPS = 3;
// Section keys that are never default stops: the header is the top, the footer the page's end.
const CHROME_KEYS = ["header", "footer"];
// The loop wrap crossfade (quality bar §2.2). A looping shot shows `duration − 0.8` s and fades
// over the 0.8 s before that, so the shot runs 0.8 s past its last hold's end: the loop is
// holds plus moves, and the fade falls inside the last hold.
export const RESPONSIVE_WRAP_OVERLAP = 0.8;

/** One screen of the layout: its screenshot's size, screen aspect and capture sections. */
export interface ScrollScreen {
  width: number;
  height: number;
  aspect: number;
  sections?: CaptureSection[];
}

/** Screen height in image px: the screenshot fit to the screen's width (quality bar §3.1). */
function screenHeightPx(screen: ScrollScreen): number {
  return screen.width / screen.aspect;
}

function scrollablePx(screen: ScrollScreen): number {
  return Math.max(0, screen.height - screenHeightPx(screen));
}

/** The screens of a responsive layout, desktop first. Null when a screenshot is missing. */
export function responsiveScreens(
  layout: Extract<Layout, { kind: "responsive" }>,
  assets: AssetRef[],
): ScrollScreen[] | null {
  const pick = (id: string, aspect: number): ScrollScreen | null => {
    const asset = assets.find((a) => a.id === id);
    if (!asset?.width || !asset.height) return null;
    return { width: asset.width, height: asset.height, aspect, sections: asset.meta?.sections };
  };
  const desktop = pick(layout.desktopId, RESPONSIVE_DESKTOP_ASPECT);
  const mobile = pick(layout.mobileId, RESPONSIVE_MOBILE_ASPECT);
  return desktop && mobile ? [desktop, mobile] : null;
}

function isChromeKey(key: string): boolean {
  return CHROME_KEYS.some((chrome) => key === chrome || key.startsWith(`${chrome}.`));
}

/** The section keys every screen has, in the first screen's page order. */
export function sharedSectionKeys(screens: ScrollScreen[]): string[] {
  const [first, ...rest] = screens;
  if (!first?.sections) return [];
  return first.sections
    .map((s) => s.id)
    .filter((key) => rest.every((screen) => screen.sections?.some((s) => s.id === key)));
}

function sectionTop(screen: ScrollScreen, key: string): number {
  return screen.sections?.find((s) => s.id === key)?.top ?? 0;
}

/** Travel between two stops in screen heights: the larger of the screens' moves. */
function stopDistance(screens: ScrollScreen[], a: number[], b: number[]): number {
  return Math.max(...screens.map((s, i) => Math.abs(b[i] - a[i]) / screenHeightPx(s)));
}

/**
 * The default stops after the top (quality bar §2.2): sections every page shares, minus the
 * header and footer, whose top every screen can reach. Each pick is the candidate farthest from
 * the stops chosen so far. Returned in page order.
 */
export function defaultSectionKeys(
  screens: ScrollScreen[],
  count = DEFAULT_SECTION_STOPS,
): string[] {
  const positions = (key: string) => screens.map((s) => sectionTop(s, key));
  const candidates = sharedSectionKeys(screens).filter((key) => {
    if (isChromeKey(key)) return false;
    const tops = positions(key);
    return tops.some((top) => top > 0) && screens.every((s, i) => tops[i] <= scrollablePx(s));
  });
  const chosen: { key: string; px: number[] }[] = [{ key: "", px: screens.map(() => 0) }];
  while (chosen.length <= count) {
    let best: string | undefined;
    let bestDistance = 0;
    for (const key of candidates) {
      if (chosen.some((c) => c.key === key)) continue;
      const px = positions(key);
      const distance = Math.min(...chosen.map((c) => stopDistance(screens, c.px, px)));
      if (distance > bestDistance) {
        best = key;
        bestDistance = distance;
      }
    }
    if (best === undefined) break;
    chosen.push({ key: best, px: positions(best) });
  }
  return chosen
    .slice(1)
    .sort((a, b) => a.px[0] - b.px[0])
    .map((c) => c.key);
}

export interface ResponsiveStops {
  /** Per stop, each screen's scroll position in image px. The first stop is the top. */
  px: number[][];
  /** Section keys of the stops after the top, or null for the proportional fallback. */
  sections: string[] | null;
}

/**
 * Keeps only stops that move forward: no screen goes back (quality bar §2.5) and at least one
 * moves. A page that can't scroll a section to its top already stops at its bottom.
 */
function forwardStops(stops: number[][]): number[][] {
  const kept = [stops[0]];
  for (const stop of stops.slice(1)) {
    const prev = kept[kept.length - 1];
    const forward = stop.every((px, i) => px >= prev[i]);
    const moves = stop.some((px, i) => px - prev[i] >= 1);
    if (forward && moves) kept.push(stop);
  }
  return kept;
}

/**
 * Where both screens stop. With section data on every screen, the top and then each section
 * (`spec.sections`, or the default picks) every page has, at the top of every screen. Otherwise
 * the same `spec.stops` fractions of each screen's scrollable range.
 */
export function resolveResponsiveStops(spec: ScrollSpec, screens: ScrollScreen[]): ResponsiveStops {
  const top = screens.map(() => 0);
  if (screens.every((s) => s.sections && s.sections.length > 0)) {
    const shared = new Set(sharedSectionKeys(screens));
    const keys = (spec.sections ?? defaultSectionKeys(screens)).filter((key) => shared.has(key));
    const keyed = keys.map((key) =>
      screens.map((s) => Math.min(sectionTop(s, key), scrollablePx(s))),
    );
    const px = forwardStops([top, ...keyed]);
    if (px.length > 1) {
      return { px, sections: keys.filter((key, i) => px.includes(keyed[i])) };
    }
  }
  const fractions = spec.stops.length > 0 ? spec.stops : [0, 1];
  const proportional = fractions.map((f) => screens.map((s) => f * scrollablePx(s)));
  return { px: forwardStops([top, ...proportional]), sections: null };
}

interface Timeline {
  px: number[][];
  hold: number;
  moves: number[];
  duration: number;
}

/**
 * Holds and moves: each move takes the time the screen that travels further needs at 0.9 screen
 * heights per second. The shot also covers the wrap crossfade's overlap. Fits in 30 s by leaving
 * out the last stops; if even two stops don't fit, the moves are shortened.
 */
function timeline(spec: ScrollSpec, screens: ScrollScreen[]): Timeline {
  const hold = Math.max(0, spec.hold);
  let px = resolveResponsiveStops(spec, screens).px;
  const movesOf = (stops: number[][]) =>
    stops.slice(1).map((stop, i) => stopDistance(screens, stops[i], stop) / SCREENS_PER_SECOND);
  const fixedTime = (stops: number[][]) => stops.length * hold + RESPONSIVE_WRAP_OVERLAP;
  const total = (stops: number[][]) =>
    fixedTime(stops) + movesOf(stops).reduce((a, b) => a + b, 0);
  while (px.length > 2 && total(px) > MAX_SHOT_DURATION) px = px.slice(0, -1);
  let moves = movesOf(px);
  const moveTime = moves.reduce((a, b) => a + b, 0);
  const room = MAX_SHOT_DURATION - fixedTime(px);
  if (moveTime > room && moveTime > 0) moves = moves.map((m) => (m * Math.max(0, room)) / moveTime);
  return { px, hold, moves, duration: fixedTime(px) + moves.reduce((a, b) => a + b, 0) };
}

/**
 * The shot length a responsive scroll needs: holds plus moves plus the wrap crossfade's overlap,
 * at most 30 s. A loop of it lasts holds plus moves.
 */
export function responsiveScrollDuration(spec: ScrollSpec, screens: ScrollScreen[]): number {
  return timeline(spec, screens).duration;
}

/** Each screen's scroll at shot time t, as a 0..1 fraction of its scrollable range. */
export function responsiveScrollAt(spec: ScrollSpec, screens: ScrollScreen[], t: number): number[] {
  const { px, hold, moves } = timeline(spec, screens);
  const toFractions = (stop: number[]) =>
    stop.map((p, i) => {
      const range = scrollablePx(screens[i]);
      return range > 0 ? Math.min(1, p / range) : 0;
    });
  let start = 0;
  for (let i = 0; i < px.length; i++) {
    start += hold;
    if (t < start || i === px.length - 1) return toFractions(px[i]);
    const move = moves[i];
    if (t < start + move) {
      const p = ease(spec.easing, (t - start) / move);
      return toFractions(px[i].map((from, s) => from + (px[i + 1][s] - from) * p));
    }
    start += move;
  }
  return toFractions(px[px.length - 1]);
}
