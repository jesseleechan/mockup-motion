import { describe, expect, it } from "vitest";
import { collectAssetIds } from "../src/doc/assets";
import { createDoc, defaultShot } from "../src/doc/defaults";
import type { Aspect, AssetRef, Layout, ProjectDoc, TextLayer } from "../src/doc/types";
import { textureWidths } from "../src/engine/textures/sizing";
import { resolveLayout } from "../src/motion";
import { BUILTIN_TEMPLATES, buildTemplatePreviewDoc } from "../src/templates";

function image(id: string, width = 1440, height = 900): AssetRef {
  return { id, kind: "image", name: id, mime: "image/png", bytes: 1, width, height };
}

function docWith(layouts: Layout[], assets: AssetRef[] = []): ProjectDoc {
  return createDoc({ assets, shots: layouts.map((layout) => defaultShot(layout)) });
}

function textLayer(id: string, logoAssetId?: string): TextLayer {
  return {
    id,
    text: "Title",
    role: "title",
    font: "display",
    size: 6,
    anchor: "center",
    align: "center",
    color: "",
    animation: "none",
    delay: 0,
    logoAssetId,
  };
}

describe("F03: collectAssetIds", () => {
  const cases: { layout: Layout; ids: string[] }[] = [
    { layout: { kind: "single", device: "browser", assetId: "s" }, ids: ["s"] },
    {
      layout: { kind: "pair", desktopId: "pd", mobileId: "pm", arrangement: "overlap" },
      ids: ["pd", "pm"],
    },
    {
      layout: { kind: "trio", desktopId: "td", tabletId: "tt", mobileId: "tm" },
      ids: ["td", "tt", "tm"],
    },
    { layout: { kind: "trio", desktopId: "td", mobileId: "tm" }, ids: ["td", "tm"] },
    {
      layout: {
        kind: "rows",
        assetIds: ["r1", "r2", "r3"],
        rows: 2,
        device: "browser",
        tilt: 0,
        speed: 0.5,
      },
      ids: ["r1", "r2", "r3"],
    },
    {
      layout: { kind: "columns", assetIds: ["c1", "c2", "c3"], columns: 3, tilt: 0, speed: 0.5 },
      ids: ["c1", "c2", "c3"],
    },
    {
      layout: { kind: "wall", assetIds: ["w1", "w2", "w3"], columns: 3, speed: 0.5 },
      ids: ["w1", "w2", "w3"],
    },
    {
      layout: { kind: "stack", assetIds: ["k1", "k2", "k3"], device: "card", spread: 0.5 },
      ids: ["k1", "k2", "k3"],
    },
    { layout: { kind: "title" }, ids: [] },
  ];

  for (const { layout, ids } of cases) {
    it(`collects the ${layout.kind} layout's screens (${ids.length})`, () => {
      expect([...collectAssetIds(docWith([layout]))].sort()).toEqual([...ids].sort());
    });
  }

  it("skips empty slots", () => {
    const doc = docWith([{ kind: "single", device: "browser", assetId: "" }]);
    expect(collectAssetIds(doc).size).toBe(0);
  });

  it("collects ambient and image backgrounds from the doc style and shot overrides", () => {
    const doc = docWith([{ kind: "title" }, { kind: "title" }, { kind: "title" }]);
    doc.style.background = { kind: "ambient", assetId: "doc-ambient", blur: 0.5, dim: 0.2 };
    doc.shots[0].styleOverrides = {
      background: { kind: "image", assetId: "shot-image", dim: 0.1 },
    };
    doc.shots[1].styleOverrides = { background: { kind: "solid", color: "#808080" } };
    doc.shots[2].styleOverrides = {
      background: { kind: "ambient", assetId: "shot-ambient", blur: 0.5, dim: 0.2 },
    };
    expect([...collectAssetIds(doc)].sort()).toEqual(["doc-ambient", "shot-ambient", "shot-image"]);
  });

  it("collects text-layer logos and excludes audio", () => {
    const doc = docWith([{ kind: "title" }]);
    doc.shots[0].texts = [textLayer("t1", "logo-a"), textLayer("t2")];
    doc.audio = { assetId: "music", volume: 1, fadeIn: 0, fadeOut: 0, offset: 0 };
    expect([...collectAssetIds(doc)]).toEqual(["logo-a"]);
  });

  it("deduplicates ids shared across shots and slots", () => {
    const doc = docWith([
      { kind: "single", device: "browser", assetId: "a" },
      { kind: "pair", desktopId: "a", mobileId: "b", arrangement: "side" },
    ]);
    doc.style.background = { kind: "ambient", assetId: "a", blur: 0.5, dim: 0.2 };
    expect([...collectAssetIds(doc)].sort()).toEqual(["a", "b"]);
  });
});

describe("F03: texture sizing", () => {
  const opts = { outputWidthPx: 1920, supersample: 1 };

  it("sizes every collected asset and nothing else", () => {
    for (const template of BUILTIN_TEMPLATES) {
      const doc = buildTemplatePreviewDoc(template);
      expect([...textureWidths(doc, opts).keys()].sort(), template.id).toEqual(
        [...collectAssetIds(doc)].sort(),
      );
    }
  });

  it("gives a single browser 1.5x its on-screen width at the closest camera, rounded up to 256", () => {
    const doc = docWith(
      [{ kind: "single", device: "browser", assetId: "hero" }],
      [image("hero", 2880, 1800)],
    );
    doc.shots[0].camera = { preset: "static", intensity: 0, easing: "smooth", float: 0 };
    // single browser at 16:9 spans 68% of the frame width (quality-bar §4)
    const expected = Math.ceil((0.68 * 1920 * 1.5) / 256) * 256;
    expect(textureWidths(doc, opts).get("hero")).toBe(expected);
  });

  it("sizes for the closest camera distance in the shot", () => {
    const doc = docWith(
      [{ kind: "single", device: "browser", assetId: "hero" }],
      [image("hero", 8000, 5000)],
    );
    const wide = { outputWidthPx: 4000, supersample: 1 };
    doc.shots[0].camera = { preset: "static", intensity: 0, easing: "smooth", float: 0 };
    expect(textureWidths(doc, wide).get("hero")).toBe(Math.ceil((0.68 * 4000 * 1.5) / 256) * 256);
    // pushIn ends at distance 0.98 (quality-bar §2.3), so the screen grows by 1/0.98.
    doc.shots[0].camera = { preset: "pushIn", intensity: 1, easing: "smooth", float: 0 };
    expect(textureWidths(doc, wide).get("hero")).toBe(
      Math.ceil((0.68 * 4000 * 1.5) / 0.98 / 256) * 256,
    );
  });

  it("uses 2x for master quality and scales with supersample", () => {
    const doc = docWith(
      [{ kind: "single", device: "browser", assetId: "hero" }],
      [image("hero", 10000, 6000)],
    );
    doc.shots[0].camera = { preset: "static", intensity: 0, easing: "smooth", float: 0 };
    const web = textureWidths(doc, { ...opts, quality: "web" }).get("hero")!;
    const master = textureWidths(doc, { ...opts, quality: "master" }).get("hero")!;
    const supersampled = textureWidths(doc, { ...opts, supersample: 2 }).get("hero")!;
    expect(web).toBe(Math.ceil((0.68 * 1920 * 1.5) / 256) * 256);
    expect(master).toBe(Math.ceil((0.68 * 1920 * 2) / 256) * 256);
    expect(supersampled).toBe(Math.ceil((0.68 * 1920 * 2 * 1.5) / 256) * 256);
  });

  it("gives small wall tiles less than a full-frame width, never below 256", () => {
    const ids = ["w1", "w2", "w3", "w4", "w5"];
    const doc = docWith(
      [{ kind: "wall", assetIds: ids, columns: 5, speed: 0.5 }],
      ids.map((id) => image(id, 2880, 1800)),
    );
    const widths = textureWidths(doc, { outputWidthPx: 640, supersample: 1 });
    for (const id of ids) {
      const width = widths.get(id)!;
      expect(width).toBeGreaterThanOrEqual(256);
      expect(width % 256).toBe(0);
      expect(width).toBeLessThan(640 * 1.5);
    }
  });

  it("clamps to the asset's real width", () => {
    const doc = docWith(
      [{ kind: "pair", desktopId: "d", mobileId: "m", arrangement: "overlap" }],
      [image("d", 1000, 625), image("m", 780, 1688)],
    );
    const widths = textureWidths(doc, { outputWidthPx: 3840, supersample: 2 });
    expect(widths.get("d")).toBe(1000);
    expect(widths.get("m")).toBe(780);
  });
});

describe("F03: device keys rely on time-independent layout nodes", () => {
  const aspects: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];

  it("every template keeps node ids, devices and sizes fixed across each shot", () => {
    for (const template of BUILTIN_TEMPLATES) {
      for (const aspect of aspects) {
        const doc = buildTemplatePreviewDoc(template);
        for (const shot of doc.shots) {
          const signature = (t: number) =>
            resolveLayout(shot.layout, aspect, doc.assets, t, shot.duration, shot.entrance)
              .map((n) => `${n.id}|${n.device}|${n.width.toFixed(5)}|${n.height.toFixed(5)}`)
              .sort();
          const atStart = signature(0);
          for (const fraction of [0.1, 0.5, 0.9, 1]) {
            expect(signature(fraction * shot.duration), `${template.id} ${aspect}`).toEqual(
              atStart,
            );
          }
        }
      }
    }
  });
});
