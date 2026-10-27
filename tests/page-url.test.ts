import { describe, expect, it } from "vitest";
import { createDoc } from "../src/doc/defaults";
import type { AssetRef, ProjectDoc } from "../src/doc/types";
import { chromeUrlRequests } from "../src/engine/text/chrome-url";
import { capturePath, evaluate, pageUrl, type PillUrl, schedule, sliderStep } from "../src/motion";
import {
  buildTemplate,
  buildTemplatePreviewDoc,
  desktopSiteTourTemplate,
  mobileSiteTourTemplate,
  scrollStoryTemplate,
} from "../src/templates";

function page(i: number, captureUrl?: string): AssetRef {
  return {
    id: `page-${i}`,
    kind: "image",
    name: `page ${i}`,
    mime: "image/png",
    bytes: 1,
    width: 2880,
    height: 1800,
    role: "desktop",
    ...(captureUrl ? { meta: { page: captureUrl } } : {}),
  };
}

/** A Desktop Site Tour of these pages, as the template builds it, under `browserUrl`. */
function tourDoc(assets: AssetRef[], browserUrl = "acme.com", mobile = false): ProjectDoc {
  const template = mobile ? mobileSiteTourTemplate : desktopSiteTourTemplate;
  const built = buildTemplate(template, { aspect: "16:9", assets, name: "Tour" });
  const doc: ProjectDoc = { ...createDoc(), aspect: "16:9", assets, ...built };
  return { ...doc, style: { ...doc.style, browserUrl } };
}

/** The pill of the tour's browser at t. */
function pillAt(doc: ProjectDoc, t: number): PillUrl[] | undefined {
  const [layer] = evaluate(doc, t).layers;
  return layer.frame.nodes[0].urls;
}

/** The URL the pill shows at t: the one with any opacity, at most one. */
function shownAt(doc: ProjectDoc, t: number): PillUrl | undefined {
  const shown = (pillAt(doc, t) ?? []).filter((url) => url.opacity > 0);
  expect(shown.length, `t=${t}`).toBeLessThanOrEqual(1);
  return shown[0];
}

const CAPTURES = [
  "https://acme.com/",
  "https://acme.com/work/",
  "https://acme.com/about.html",
  "https://acme.com/journal/index.html",
];
const URLS = ["acme.com", "acme.com/work", "acme.com/about", "acme.com/journal"];

describe("The URL a Site Tour's pill shows for a page (presets round two, D4)", () => {
  it("takes the path a designer would show from the capture URL", () => {
    const cases: [string, string][] = [
      ["https://aurelia.studio/", ""],
      ["https://aurelia.studio", ""],
      ["https://aurelia.studio/index.html", ""],
      ["https://aurelia.studio/works.html", "/works"],
      ["http://localhost:5173/studio", "/studio"],
      ["https://acme.com/blog/index.htm", "/blog"],
      ["https://acme.com/work/project-a/", "/work/project-a"],
      ["https://acme.com/pricing?plan=pro#faq", "/pricing"],
      ["https://acme.com/?utm_source=x", ""],
      ["https://acme.com/myindex.html", "/myindex"],
    ];
    for (const [url, path] of cases) expect(capturePath(url), url).toBe(path);
  });

  it("keeps the document's domain, adds the page's path, and shows the home page as the domain", () => {
    const captured = (url: string) => ({ meta: { page: url } });
    expect(pageUrl("aurelia.studio", captured("https://aurelia.studio/"))).toBe("aurelia.studio");
    // The domain is the user's, not the capture's (a local dev server here).
    expect(pageUrl("aurelia.studio", captured("http://localhost:3000/studio.html"))).toBe(
      "aurelia.studio/studio",
    );
    // A path or scheme typed into the URL field: the scheme stays, the page's path replaces it.
    expect(pageUrl("https://acme.com/work", captured("https://acme.com/about/"))).toBe(
      "https://acme.com/about",
    );
    expect(pageUrl("acme.com/", captured("https://acme.com/"))).toBe("acme.com");
  });

  it("shows the document's URL for a page without a capture URL, and nothing without a URL", () => {
    expect(pageUrl("acme.com/work", undefined)).toBe("acme.com/work");
    expect(pageUrl("acme.com/work", { meta: { tall: true } })).toBe("acme.com/work");
    expect(pageUrl("", { meta: { page: "https://acme.com/about" } })).toBe("");
  });
});

describe("The pill cross-fades each page's URL in step with the slide (quality bar §4)", () => {
  const doc = tourDoc(CAPTURES.map((url, i) => page(i, url)));
  const step = 2;
  const N = CAPTURES.length;

  it("shows the current page's URL at rest and fades to the next one's during the step", () => {
    // Every frame lists every page's URL once, in page order.
    for (let t = 0; t < N * step; t += 0.1) {
      expect(pillAt(doc, t)?.map((url) => url.text)).toEqual(URLS);
    }
    for (let k = 0; k < N; k++) {
      const [current, next] = [URLS[k], URLS[(k + 1) % N]];
      expect(shownAt(doc, k * step), `start of step ${k}`).toEqual({ text: current, opacity: 1 });
      // The move takes 1.85 s; the hold shows the next page's URL alone.
      expect(shownAt(doc, k * step + 1.9), `hold ${k}`).toEqual({ text: next, opacity: 1 });
      for (const local of [0.2, 0.4, 0.6, 1.0]) {
        const t = k * step + local;
        const { p } = sliderStep(t, step);
        const urls = pillAt(doc, t)!;
        const opacity = (text: string) => urls.find((url) => url.text === text)!.opacity;
        // The leaving URL fades out over the first half of the eased progress, the arriving one
        // in over the second half, as the slider's window fade does.
        expect(opacity(current), `step ${k} at ${local}`).toBeCloseTo(Math.max(0, 1 - 2 * p), 9);
        expect(opacity(next), `step ${k} at ${local}`).toBeCloseTo(Math.max(0, 2 * p - 1), 9);
        for (const other of URLS.filter((text) => text !== current && text !== next)) {
          expect(opacity(other)).toBe(0);
        }
      }
    }
  });

  it("loops: frame(0) equals frame(total)", () => {
    const { total } = schedule(doc);
    expect(total).toBe(N * step);
    expect(pillAt(doc, total)).toEqual(pillAt(doc, 0));
    expect(pillAt(doc, 0)?.[0]).toEqual({ text: "acme.com", opacity: 1 });
  });

  it("never reverses: a step only fades its leaving URL out and its arriving one in", () => {
    let previous = pillAt(doc, 0)!;
    for (let t = 0.005; t < N * step; t += 0.005) {
      const k = Math.floor(t / step);
      const current = pillAt(doc, t)!;
      const leaving = URLS[k % N];
      const arriving = URLS[(k + 1) % N];
      current.forEach((url, i) => {
        const before = previous[i].opacity;
        const label = `${url.text} at t=${t.toFixed(3)}`;
        // A step boundary hands the arriving URL (at 1) over as the next step's leaving one.
        if (url.text === leaving) expect(url.opacity, label).toBeLessThanOrEqual(before + 1e-12);
        else if (url.text === arriving) expect(url.opacity, label).toBeGreaterThanOrEqual(before);
        else expect(url.opacity, label).toBe(0);
      });
      previous = current;
    }
  });

  it("doesn't fade between pages with the same URL", () => {
    // Uploaded screenshots have no capture URL, so each shows the document's URL.
    const uploads = tourDoc([page(0), page(1), page(2)], "acme.com");
    for (let t = 0; t < 6; t += 0.05) {
      const urls = pillAt(uploads, t)!;
      expect(urls.map((url) => url.text)).toEqual(["acme.com"]);
      expect(urls[0].opacity, `t=${t}`).toBeCloseTo(1, 9);
    }
  });

  it("is a desktop Site Tour's alone, and an empty URL shows nothing", () => {
    expect(pillAt(tourDoc([page(0, CAPTURES[0])], ""), 0)).toEqual([]);
    // The phone has no URL bar.
    expect(pillAt(tourDoc([page(0, CAPTURES[0])], "acme.com", true), 0)).toBeUndefined();
    // Every other template keeps the document's one URL.
    const assets = [page(0, CAPTURES[1])];
    const story = buildTemplate(scrollStoryTemplate, { aspect: "16:9", assets, name: "Story" });
    const storyDoc: ProjectDoc = { ...createDoc(), aspect: "16:9", assets, ...story };
    expect(storyDoc.shots[0].layout.kind).toBe("single");
    expect(pillAt(storyDoc, 1)).toBeUndefined();
  });

  it("rasterizes every page's URL up front, for the preview and the export", () => {
    const texts = chromeUrlRequests(doc).map((request) => request.line.text);
    expect(texts).toEqual(URLS);
  });

  it("shows the demo's pages under the demo site's domain", () => {
    const demo = buildTemplatePreviewDoc(desktopSiteTourTemplate);
    const urls = ["", "/studio", "/works", "/journal"].map((path) => `aurelia.studio${path}`);
    expect(pillAt(demo, 0)?.map((url) => url.text)).toEqual(urls);
    expect(shownAt(demo, 0)?.text).toBe(urls[0]);
    for (let k = 0; k < urls.length; k++) {
      expect(shownAt(demo, k * step + 1.9)?.text, `hold ${k}`).toBe(urls[(k + 1) % urls.length]);
    }
  });
});
