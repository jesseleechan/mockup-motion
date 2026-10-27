/**
 * Which desktop and mobile captures show the same page (decision D4): Responsive Scroll's pair and
 * each page of a Responsive Tour (presets round two, D12). Pure: no DOM.
 */
import type { AssetRef } from "./types";

/** What pairing reads of a screenshot: its file name and its capture's URL. */
export type PageCapture = Pick<AssetRef, "name" | "meta">;

/**
 * A capture's page name from its file name: without the extension, `-full`, and the size suffix
 * `npm run capture` adds, so `site-desktop-1440-full.png` and `site-mobile-390@2x-full.png` are
 * both `site`.
 */
export function capturePageName(fileName: string): string {
  return fileName
    .replace(/\.[^./]+$/, "")
    .replace(/-full$/, "")
    .replace(/-(desktop|mobile)(-\d+(@\d+x)?)?$/, "");
}

/**
 * The keys that say two captures show one page, strongest first: the capture's URL
 * (`meta.page`), then the page name in its file name. Undefined when a capture has none.
 */
export const PAGE_KEYS: readonly ((capture: PageCapture) => string | undefined)[] = [
  (capture) => capture.meta?.page || undefined,
  (capture) => capturePageName(capture.name) || undefined,
];

/** Whether two captures show one page by `key`. */
export function samePageBy(
  key: (typeof PAGE_KEYS)[number],
  a: PageCapture,
  b: PageCapture,
): boolean {
  const page = key(a);
  return page !== undefined && page === key(b);
}

/**
 * The mobile capture for each desktop capture, in the desktops' order: first the mobile capture of
 * its page by URL, then by file name, each mobile at most once. A desktop without one takes the
 * first mobile no desktop matched, in order, so screenshots without page data pair by order.
 * Undefined when the mobiles run out.
 */
export function pairByPage<T extends PageCapture>(
  desktops: readonly T[],
  mobiles: readonly T[],
): (T | undefined)[] {
  const pairs: (T | undefined)[] = desktops.map(() => undefined);
  const taken = new Set<T>();
  for (const key of PAGE_KEYS) {
    desktops.forEach((desktop, i) => {
      if (pairs[i]) return;
      const mobile = mobiles.find((m) => !taken.has(m) && samePageBy(key, desktop, m));
      if (!mobile) return;
      pairs[i] = mobile;
      taken.add(mobile);
    });
  }
  const rest = mobiles.filter((m) => !taken.has(m));
  return pairs.map((pair) => pair ?? rest.shift());
}
