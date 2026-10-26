/**
 * The phone device, measured from a current iPhone Pro seen from the front (quality-bar §3.3,
 * owner decision of 18 October 2026: the phone looks like an iPhone). Fractions, so every size
 * scales with the device. Body 71.9 x 150.0 mm, 6.3" display, 402 x 874 pt.
 */

/** Screen width / height. 0.4615 is the 1179 x 2556 px iPhone screen; the Pro's is 0.460. */
export const PHONE_SCREEN_ASPECT = 0.4615;

/** Everything around the screen, seen from the front: 2.65 mm of 71.9 mm, as a fraction of body width. */
export const PHONE_BORDER = 0.037;

/** The metal frame visible from the front, inside PHONE_BORDER; the rest is black glass. */
export const PHONE_FRAME = 0.012;

/** Screen corner radius as a fraction of screen width (62 pt of 402 pt). */
export const PHONE_SCREEN_RADIUS = 0.154;

/** Body width / height, from the screen aspect and a uniform border. 71.9 / 150.0 = 0.479. */
export const PHONE_BODY_ASPECT =
  PHONE_SCREEN_ASPECT / (1 - 2 * PHONE_BORDER + 2 * PHONE_BORDER * PHONE_SCREEN_ASPECT);

/** Body depth as a fraction of body height (8.75 mm of 150 mm). */
export const PHONE_DEPTH = 0.0583;

/** Dynamic Island, as fractions of screen width: 126 x 37 pt, 11 pt below the screen top. */
export const PHONE_ISLAND = { width: 0.313, height: 0.092, top: 0.027 } as const;

/**
 * The status bar: the top 62 pt of the 874 pt screen. A screenshot without its own status bar
 * starts below it, and the bar shows the time and the signal, Wi-Fi and battery icons on the
 * page's top colour. A screenshot with a status bar fills the whole screen.
 */
export const PHONE_STATUS_BAR = 62 / 874;

/**
 * The home indicator's area: the bottom 34 pt of the 874 pt screen, where iOS keeps content
 * clear of the indicator. The engine draws no indicator; overlays at the bottom of the screen
 * (Before & After's labels) stay above this area.
 */
export const PHONE_HOME_INDICATOR_AREA = 34 / 874;

/** The status bar in points: the screen is 402 pt wide. */
export const PHONE_SCREEN_POINTS = { width: 402, statusBar: 62 } as const;

/**
 * The part of the phone screen a page scrolls in: below the status bar unless the screenshot
 * has its own.
 */
export function phoneViewportFraction(hasStatusBar: boolean | undefined): number {
  return hasStatusBar ? 1 : 1 - PHONE_STATUS_BAR;
}
