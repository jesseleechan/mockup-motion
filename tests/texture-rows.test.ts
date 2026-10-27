import { afterEach, describe, expect, it, vi } from "vitest";
import { collectAssetIds } from "../src/doc/assets";
import { createDoc, defaultShot } from "../src/doc/defaults";
import type { Aspect, AssetRef, Layout, ProjectDoc, ScrollSpec } from "../src/doc/types";
import { keptRows, ROWS_MARGIN, textureRows } from "../src/engine/textures/sizing";
import { keepTopRows } from "../src/engine/textures/top-rows";
import {
  evaluate,
  type LayoutNode,
  PHONE_BORDER,
  PHONE_SCREEN_ASPECT,
  schedule,
} from "../src/motion";
import { BUILTIN_TEMPLATES, buildTemplatePreviewDoc } from "../src/templates";

const SCROLL: ScrollSpec = { enabled: true, stops: [0, 1], hold: 1, easing: "smooth" };

function page(id: string, width: number, height: number): AssetRef {
  return { id, kind: "image", name: id, mime: "image/png", bytes: 1, width, height };
}
// The follow-up's full pages: a 1440 × 4000 desktop capture and a 780 px wide mobile one.
const desktopPage = (id: string) => page(id, 1440, 4000);
const mobilePage = (id: string) => page(id, 780, 11436);

function docWith(layouts: Layout[], assets: AssetRef[], scroll = false): ProjectDoc {
  const shots = layouts.map((layout) => {
    const shot = defaultShot(layout);
    if (scroll) shot.scroll = { ...SCROLL };
    return shot;
  });
  return createDoc({ assets, shots });
}

/** The rows of `asset` a texture keeps under `doc`. */
function kept(doc: ProjectDoc, asset: AssetRef): number {
  const rows = textureRows(doc).get(asset.id);
  expect(rows, asset.id).not.toBeUndefined();
  return keptRows(rows ?? null, asset.width!, asset.height!);
}

/** Kept rows are the first whole block of 64 at or past `rows`, so mip levels halve exactly. */
function expectBlockAbove(kept: number, rows: number) {
  expect(kept % 64).toBe(0);
  expect(kept).toBeGreaterThanOrEqual(rows);
  expect(kept).toBeLessThan(rows + 64);
}

/** A node's screen in screen widths, as the engine's devices build it (src/engine/devices). */
function screenHeightPerWidth(node: LayoutNode): number {
  if (node.device === "phone") {
    const screenWidth = node.width * (1 - 2 * PHONE_BORDER);
    return (node.height - 2 * PHONE_BORDER * node.width) / screenWidth;
  }
  // A card's screen is the card; a browser's is at most its window.
  return node.height / node.width;
}

describe("textureRows: the rows of a screenshot a texture keeps", () => {
  const ids = ["p1", "p2", "p3", "p4", "p5", "p6"];
  const desktops = ids.map(desktopPage);
  const mobiles = ids.map((id) => mobilePage(`m-${id}`));
  const mobileIds = mobiles.map((a) => a.id);

  // Every layout that shows the top of its screenshots, with full pages.
  const topOnly: [string, Layout, AssetRef[]][] = [
    ["Site Tour", { kind: "tour", device: "browser", assetIds: ids, step: 2 }, desktops],
    ["Mobile Site Tour", { kind: "tour", device: "phone", assetIds: mobileIds, step: 2 }, mobiles],
    ["Slider", { kind: "slider", assetIds: ids, axis: "x", shape: "desktop", step: 2 }, desktops],
    [
      "Stack",
      { kind: "slider", assetIds: ids, axis: "y", shape: "desktop", step: 2, arrangement: "deck" },
      desktops,
    ],
    ["Orbit", { kind: "orbit", assetIds: ids, shape: "desktop", step: 2 }, desktops],
    [
      "Frames",
      { kind: "rows", assetIds: ids, rows: 2, device: "card", tilt: 0, travel: "period" },
      desktops,
    ],
    [
      "Mobile Frames",
      { kind: "columns", assetIds: mobileIds, columns: 3, tilt: 0, travel: "period" },
      mobiles,
    ],
    [
      "Before & After",
      { kind: "compare", device: "browser", beforeId: "p1", afterId: "p2" },
      desktops.slice(0, 2),
    ],
    [
      "Responsive Tour",
      { kind: "responsive-tour", desktopIds: ids, mobileIds, step: 2 },
      [...desktops, ...mobiles],
    ],
  ];

  it("keeps about a screen of each page on every layout that never scrolls, scroll on or off", () => {
    for (const scroll of [false, true]) {
      for (const [name, layout, assets] of topOnly) {
        const doc = docWith([layout], assets, scroll);
        for (const asset of assets) {
          const rows = kept(doc, asset);
          // More than an exact fit on the screen, far less than the page.
          expect(rows, `${name} ${asset.id}`).toBeGreaterThan(asset.width! * 0.6);
          expect(rows, `${name} ${asset.id}`).toBeLessThan(asset.height! / 3);
        }
      }
    }
  });

  it("keeps a Site Tour of six 1440 × 4000 pages to a browser screen plus the margin", () => {
    const doc = docWith([topOnly[0][1]], desktops);
    const [screen] = evaluate(doc, 0).layers[0].frame.nodes;
    // The screen shows the top 1440 / 1.6 rows of each page; its window bounds it.
    const windowRows = 1440 * screenHeightPerWidth(screen);
    expect(windowRows).toBeGreaterThan(1440 / 1.6);
    const rows = windowRows * (1 + ROWS_MARGIN);
    for (const asset of desktops) expectBlockAbove(kept(doc, asset), rows);
  });

  it("keeps the whole page where a shot scrolls it", () => {
    const single: Layout = { kind: "single", device: "browser", assetId: "p1" };
    const phone: Layout = { kind: "single", device: "phone", assetId: "m-p1" };
    const responsive: Layout = { kind: "responsive", desktopId: "p1", mobileId: "m-p1" };
    const columns: Layout = { kind: "pageColumns", assetIds: ["p1", "p2"], shape: "desktop" };
    const assets = [...desktops, ...mobiles];

    for (const layout of [single, phone, responsive]) {
      const scrolled = docWith([layout], assets, true);
      const still = docWith([layout], assets, false);
      for (const id of collectAssetIds(scrolled)) {
        expect(textureRows(scrolled).get(id), `${layout.kind} ${id} scrolled`).toBeNull();
        expect(textureRows(still).get(id), `${layout.kind} ${id} still`).toBeGreaterThan(0);
      }
    }
    // Page Columns always scrolls its pages.
    for (const scroll of [false, true]) {
      const doc = docWith([columns], assets, scroll);
      expect([...textureRows(doc).values()]).toEqual([null, null]);
    }
  });

  it("keeps the whole page when any shot scrolls it, and else the rows of its tallest screen", () => {
    const tour: Layout = { kind: "tour", device: "browser", assetIds: ["p1", "p2", "p3"], step: 2 };
    const story = defaultShot({ kind: "single", device: "browser", assetId: "p1" });
    story.scroll = { ...SCROLL };
    const mixed = createDoc({ assets: desktops, shots: [defaultShot(tour), story] });
    expect(textureRows(mixed).get("p1")).toBeNull();
    expect(kept(mixed, desktops[1])).toBe(kept(docWith([tour], desktops), desktops[1]));

    // The same pages in a browser tour and on a phone keep the phone's taller screen.
    const phoneTour: Layout = { ...tour, device: "phone" };
    const both = docWith([tour, phoneTour], desktops);
    const phoneOnly = docWith([phoneTour], desktops);
    expect(kept(both, desktops[0])).toBe(kept(phoneOnly, desktops[0]));
    expect(kept(both, desktops[0])).toBeGreaterThan(kept(docWith([tour], desktops), desktops[0]));
  });

  it("keeps a page no taller than its screen whole, so its bottom row is its own", () => {
    const short = ["s1", "s2", "s3"].map((id) => page(id, 1440, 900));
    const tour: Layout = { kind: "tour", device: "browser", assetIds: ["s1", "s2", "s3"], step: 2 };
    expect([...textureRows(docWith([tour], short)).values()]).toEqual([null, null, null]);
  });

  it("keeps a phone screen's height of a tall mobile page", () => {
    const doc = docWith([topOnly[1][1]], mobiles);
    // A phone screen is 0.4615 as wide as it is tall: 780 px of width shows 1690 rows.
    const screen = 780 / PHONE_SCREEN_ASPECT;
    expectBlockAbove(kept(doc, mobiles[0]), screen * (1 + ROWS_MARGIN));
  });

  it("never keeps fewer rows than a frame of any template shows", () => {
    const aspects: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];
    for (const template of BUILTIN_TEMPLATES) {
      for (const aspect of aspects) {
        for (const full of [false, true]) {
          for (const toggleScroll of [false, true]) {
            const doc = buildTemplatePreviewDoc(template, aspect);
            if (full) {
              doc.assets = doc.assets.map((a) =>
                (a.width ?? 0) < 1000 ? mobilePage(a.id) : desktopPage(a.id),
              );
            }
            if (toggleScroll) {
              for (const shot of doc.shots) {
                shot.scroll = shot.scroll?.enabled ? undefined : { ...SCROLL };
              }
            }
            const label = `${template.id} ${aspect} full=${full} toggled=${toggleScroll}`;
            const rows = textureRows(doc);
            expect([...rows.keys()].sort(), label).toEqual([...collectAssetIds(doc)].sort());

            const { total } = schedule(doc);
            for (let i = 0; i <= 24; i++) {
              for (const { frame } of evaluate(doc, (total * i) / 24).layers) {
                for (const node of frame.nodes) {
                  const shown = node.panes ?? [node];
                  for (const { assetId, scroll } of shown) {
                    const held = assetId ? rows.get(assetId) : null;
                    if (held === null || held === undefined) continue;
                    expect(scroll, `${label} ${assetId} scrolls`).toBe(0);
                    const needed = screenHeightPerWidth(node) * (1 + ROWS_MARGIN);
                    expect(held, `${label} ${assetId}`).toBeGreaterThanOrEqual(needed - 1e-9);
                  }
                }
              }
            }
          }
        }
      }
    }
  });
});

describe("keepTopRows: a provider's decode cut to the rows kept", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function bitmap(width: number, height: number) {
    return { width, height, close: vi.fn() } as unknown as ImageBitmap & {
      close: ReturnType<typeof vi.fn>;
    };
  }

  it("copies the top rows and closes the whole decode, or returns a short one as it is", async () => {
    const crops: number[][] = [];
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async (_source: ImageBitmap, x: number, y: number, w: number, h: number) => {
        crops.push([x, y, w, h]);
        return bitmap(w, h);
      }),
    );
    const tall = bitmap(1440, 4000);
    // 1440 × 0.75 = 1080 rows, kept in blocks of 64.
    const top = await keepTopRows(tall, 0.75);
    expect(crops).toEqual([[0, 0, 1440, 1088]]);
    expect(top.bitmap.height).toBe(1088);
    expect(top.held).toBe(0.75);
    expect(tall.close).toHaveBeenCalledTimes(1);

    const short = bitmap(1440, 900);
    expect(await keepTopRows(short, 0.75)).toEqual({ bitmap: short, held: null });
    expect(await keepTopRows(tall, null)).toEqual({ bitmap: tall, held: null });
    expect(short.close).not.toHaveBeenCalled();
    expect(crops.length).toBe(1);
  });
});
