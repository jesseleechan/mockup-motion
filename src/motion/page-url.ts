import type { AssetRef, Layout } from "../doc/types";
import { paneShare } from "./layouts/tour";
import type { LayoutNode, PillUrl } from "./layouts/types";

// A capture URL's scheme and host: "https://aurelia.studio", "http://localhost:3591".
const ORIGIN = /^[a-z][a-z\d+.-]*:\/\/[^/?#]*/i;
// The part of a browserUrl before its path, as the user typed it: "aurelia.studio",
// "https://aurelia.studio", "localhost:3000".
const SITE = /^(?:[a-z][a-z\d+.-]*:\/\/)?[^/?#\s]*/i;

/**
 * The path a designer would show for a page, from its capture URL (`AssetRef.meta.page`): no
 * scheme or host, query or fragment, `index.html`, `.html` or trailing slash; "" is the home page.
 * `https://aurelia.studio/works.html` gives "/works", `http://localhost:5173/blog/index.html`
 * "/blog" and `https://aurelia.studio/` "".
 */
export function capturePath(captureUrl: string): string {
  const path = captureUrl
    .trim()
    .replace(ORIGIN, "")
    .replace(/[?#].*$/, "")
    .replace(/(^|\/)index\.html?$/i, "$1")
    .replace(/\.html?$/i, "")
    .replace(/\/+$/, "");
  if (!path) return "";
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * The URL a Site Tour's pill shows for a page (presets round two, D4): the document's
 * `browserUrl` up to its path, which keeps the domain the user chose, plus the page's path from
 * its capture, so the home page shows just the domain. A page without a capture URL (an uploaded
 * screenshot) shows `browserUrl` as it is, and an empty `browserUrl` hides the text.
 */
export function pageUrl(browserUrl: string, asset?: Pick<AssetRef, "meta">): string {
  const page = asset?.meta?.page;
  const site = browserUrl.trim().match(SITE)?.[0] ?? "";
  if (!page || !site) return browserUrl;
  return site + capturePath(page);
}

/**
 * The URL pill of a Site Tour's browser at this frame (quality bar §4): each page's URL
 * (`pageUrl`) once, in page order, with its opacity. A URL's share is how much of the screen its
 * pages cover, and it shows at max(0, 2 × share − 1). So as the next page slides in, the leaving
 * page's URL fades out over the first half of the step's eased progress and the arriving page's
 * fades in over the second half, as the slider's window fade does: two URLs never show at once,
 * and two pages with the same URL never fade. Every frame lists the same URLs in the same order.
 * Undefined for every other node, whose pill shows `browserUrl`; an empty `browserUrl` lists none.
 */
export function pillUrls(
  layout: Layout,
  node: LayoutNode,
  browserUrl: string,
  assets: readonly AssetRef[],
): PillUrl[] | undefined {
  if (layout.kind !== "tour" || node.device !== "browser" || !node.panes) return undefined;
  const shares = new Map<string, number>();
  for (const pane of node.panes) {
    const asset = pane.assetId ? assets.find((a) => a.id === pane.assetId) : undefined;
    const text = pageUrl(browserUrl, asset);
    shares.set(text, (shares.get(text) ?? 0) + paneShare(pane));
  }
  return [...shares]
    .filter(([text]) => text !== "")
    .map(([text, share]) => ({ text, opacity: Math.min(1, Math.max(0, 2 * share - 1)) }));
}
