import { describe, expect, it } from "vitest";
import { createDoc, defaultShot } from "../src/doc/defaults";
import type { Aspect, AssetRef, Layout, ProjectDoc } from "../src/doc/types";
import { sanitizeDoc } from "../src/doc/validate";
import { evaluate, framesDuration, schedule, sliderDuration } from "../src/motion";
import { fillUserTemplateSlots, type UserTemplate } from "../src/storage/user-templates";
import { framesLayout, mobileFramesLayout } from "../src/templates";

// Layouts cut on 19 October 2026 (docs/cuts-plan/README.md). A saved project keeps every shot:
// each one loads as the nearest preset look.

const image = (id: string, role: AssetRef["role"], width: number, height: number): AssetRef => ({
  id,
  kind: "image",
  name: id,
  mime: "image/png",
  bytes: 1,
  width,
  height,
  role,
});
const ASSETS = [
  image("d1", "desktop", 1440, 900),
  image("d2", "desktop", 1440, 900),
  image("d3", "desktop", 1440, 900),
  image("m1", "mobile", 390, 844),
  image("m2", "mobile", 390, 844),
  image("m3", "mobile", 390, 844),
  image("t1", "tablet", 1200, 1600),
];
const DESKTOPS = ["d1", "d2", "d3"];
const MOBILES = ["m1", "m2", "m3"];

/** A saved document whose only shot has `layout`, as JSON, so removed kinds type-check. */
function savedDoc(layout: Record<string, unknown>, aspect: Aspect = "16:9"): unknown {
  const shot = {
    ...defaultShot(),
    duration: 8,
    entrance: "rise",
    camera: { preset: "pushIn", intensity: 0.5, easing: "smooth", float: 0.2 },
    transitionIn: { kind: "fade", duration: 0.8, easing: "quintInOut" },
    layout,
  };
  return JSON.parse(JSON.stringify(createDoc({ aspect, assets: ASSETS, shots: [shot as never] })));
}

function load(layout: Record<string, unknown>, aspect: Aspect = "16:9"): ProjectDoc {
  const { doc } = sanitizeDoc(savedDoc(layout, aspect));
  expect(doc.shots).toHaveLength(1);
  return doc;
}

const STILL = { preset: "static", intensity: 0, float: 0 };

/** The shot draws one node per screen with a screenshot, and no node is empty. */
function expectDrawsScreens(doc: ProjectDoc, ids: string[]) {
  const layers = evaluate(doc, 1).layers;
  expect(layers).toHaveLength(1);
  const shown = new Set(layers[0].frame.nodes.map((node) => node.assetId));
  expect([...shown].sort()).toEqual([...ids].sort());
}

describe("Saved projects with removed layouts", () => {
  it("loads a pair as a single browser with the desktop capture", () => {
    for (const arrangement of ["overlap", "side"]) {
      const doc = load({ kind: "pair", desktopId: "d1", mobileId: "m1", arrangement });
      expect(doc.shots[0].layout).toEqual({ kind: "single", device: "browser", assetId: "d1" });
      // A single browser keeps the shot's own camera, entrance and wrap.
      expect(doc.shots[0].camera.preset).toBe("pushIn");
      expect(doc.shots[0].transitionIn.kind).toBe("fade");
      expectDrawsScreens(doc, ["d1"]);
    }
  });

  it("loads a trio as a single browser with the desktop capture", () => {
    const doc = load({ kind: "trio", desktopId: "d2", tabletId: "t1", mobileId: "m1" });
    expect(doc.shots[0].layout).toEqual({ kind: "single", device: "browser", assetId: "d2" });
    expectDrawsScreens(doc, ["d2"]);
  });

  it("loads the tilted stack as the Desktop Stack deck", () => {
    const doc = load({ kind: "stack", assetIds: DESKTOPS, device: "browser", spread: 0.3 });
    const shot = doc.shots[0];
    const deck: Layout = {
      kind: "slider",
      assetIds: DESKTOPS,
      axis: "y",
      shape: "desktop",
      step: 2,
      arrangement: "deck",
    };
    expect(shot.layout).toEqual(deck);
    expect(shot.duration).toBe(sliderDuration(deck));
    expect(shot.camera).toMatchObject(STILL);
    expect(shot.transitionIn.kind).toBe("cut");
    expect(schedule(doc).total).toBe(6);
  });

  it("keeps a long stack within 30 s", () => {
    const ids = Array.from({ length: 18 }, (_, i) => `x${i}`);
    const doc = sanitizeDoc({
      ...(savedDoc({ kind: "stack", assetIds: ids, device: "card", spread: 0.5 }) as object),
      assets: ids.map((id) => image(id, "desktop", 1440, 900)),
    }).doc;
    expect(doc.shots[0].duration).toBeLessThanOrEqual(30);
  });

  it("loads a wall and tilted rows as Desktop Frames at the document's aspect", () => {
    const saved = [
      { kind: "wall", assetIds: DESKTOPS, columns: 4, speed: 0.2 },
      { kind: "rows", assetIds: DESKTOPS, rows: 2, device: "browser", tilt: 12, speed: 0.35 },
      // `travel: "steps"` is the same tilted marquee as no travel.
      {
        kind: "rows",
        assetIds: DESKTOPS,
        rows: 1,
        device: "card",
        tilt: 8,
        speed: 1,
        travel: "steps",
      },
    ];
    for (const aspect of ["16:9", "9:16"] as Aspect[]) {
      for (const layout of saved) {
        const label = `${layout.kind} ${aspect}`;
        const doc = load(layout, aspect);
        const shot = doc.shots[0];
        const frames = framesLayout(aspect, DESKTOPS);
        expect(shot.layout, label).toEqual(frames);
        expect(shot.duration, label).toBe(Math.max(15, framesDuration(frames, aspect)));
        expect(shot.camera, label).toMatchObject(STILL);
        expect(shot.transitionIn.kind, label).toBe("cut");
        expect(evaluate(doc, schedule(doc).total), label).toEqual(evaluate(doc, 0));
      }
    }
  });

  it("loads tilted phone columns as Mobile Frames", () => {
    for (const travel of [undefined, "steps"]) {
      const doc = load(
        { kind: "columns", assetIds: MOBILES, columns: 3, tilt: 12, speed: 0.4, travel },
        "4:5",
      );
      const frames = mobileFramesLayout("4:5", MOBILES);
      expect(doc.shots[0].layout).toEqual(frames);
      expect(doc.shots[0].duration).toBe(Math.max(15, framesDuration(frames, "4:5")));
      expect(doc.shots[0].camera).toMatchObject(STILL);
    }
  });

  it("keeps a Frames shot as it was", () => {
    const frames = framesLayout("16:9", DESKTOPS);
    const doc = load(frames as unknown as Record<string, unknown>);
    expect(doc.shots[0].layout).toEqual(frames);
    // Not a removed layout, so the saved camera and length stay.
    expect(doc.shots[0].camera.preset).toBe("pushIn");
    expect(doc.shots[0].duration).toBe(8);
  });

  it("loads a laptop or a tablet as a browser", () => {
    for (const device of ["laptop", "tablet"]) {
      const doc = load({ kind: "single", device, assetId: "d1" });
      expect(doc.shots[0].layout).toEqual({ kind: "single", device: "browser", assetId: "d1" });
      expectDrawsScreens(doc, ["d1"]);
    }
  });

  it("drops missing screenshots from a mapped layout with a warning", () => {
    const { doc, warnings } = sanitizeDoc(
      savedDoc({ kind: "wall", assetIds: ["d1", "gone"], columns: 3, speed: 0.2 }),
    );
    expect(doc.shots[0].layout).toMatchObject({ kind: "rows", assetIds: ["d1"] });
    expect(warnings.join(" ")).toContain("gone");
  });
});

describe("Saved user templates with removed layouts", () => {
  const template = (layout: Record<string, unknown>): UserTemplate => {
    const doc = savedDoc(layout) as ProjectDoc;
    return {
      id: "user-1",
      name: "Saved",
      description: "",
      style: doc.style,
      shots: doc.shots,
      loop: true,
      createdAt: 1,
    };
  };

  it("fills a saved pair's slots and maps it to a browser", () => {
    const filled = fillUserTemplateSlots(
      template({
        kind: "pair",
        desktopId: "slot:desktop:0",
        mobileId: "slot:mobile:0",
        arrangement: "overlap",
      }),
      ASSETS,
      "16:9",
    );
    expect(filled.shots[0].layout).toEqual({ kind: "single", device: "browser", assetId: "d1" });
  });

  it("fills a saved wall's slots and maps it to Desktop Frames at the document's aspect", () => {
    const filled = fillUserTemplateSlots(
      template({
        kind: "wall",
        assetIds: ["slot:desktop:0", "slot:desktop:1", "slot:desktop:2"],
        columns: 4,
        speed: 0.2,
      }),
      ASSETS,
      "9:16",
    );
    expect(filled.shots[0].layout).toEqual(framesLayout("9:16", DESKTOPS));
    expect(filled.shots[0].camera).toMatchObject(STILL);
  });

  it("fills a saved stack's slots and maps it to the Desktop Stack deck", () => {
    const filled = fillUserTemplateSlots(
      template({
        kind: "stack",
        assetIds: ["slot:desktop:0", "slot:desktop:1"],
        device: "browser",
        spread: 0.3,
      }),
      ASSETS,
      "16:9",
    );
    expect(filled.shots[0].layout).toMatchObject({
      kind: "slider",
      arrangement: "deck",
      assetIds: ["d1", "d2"],
    });
    expect(filled.shots[0].duration).toBe(4);
  });
});

describe("Saved multi-shot reels", () => {
  const shot = (id: string, kind: string, duration = 4) => ({
    ...defaultShot({ kind: "single", device: "browser", assetId: "d1" }),
    id,
    duration,
    transitionIn: { kind, duration: 0.8, easing: "quintInOut", direction: "left" },
  });

  it("keeps the first shot and drops the others", () => {
    const saved = JSON.parse(
      JSON.stringify(
        createDoc({
          assets: ASSETS,
          shots: [shot("s0", "fade", 3), shot("s1", "push"), shot("s2", "cut")] as never,
        }),
      ),
    );
    const { doc, warnings } = sanitizeDoc(saved);
    expect(doc.shots.map((s) => s.id)).toEqual(["s0"]);
    expect(doc.shots[0].duration).toBe(3);
    expect(warnings.join(" ")).toContain("first of 3 shots");
  });

  it("plays a saved blur, push, zoom or wipe wrap as a fade", () => {
    for (const kind of ["blur", "push", "zoom", "wipe", "fade"]) {
      const saved = JSON.parse(
        JSON.stringify(createDoc({ assets: ASSETS, shots: [shot("s0", kind)] as never })),
      );
      const { doc } = sanitizeDoc(saved);
      expect(doc.shots[0].transitionIn, kind).toEqual({
        kind: "fade",
        duration: 0.8,
        easing: "quintInOut",
      });
      doc.loop = true;
      expect(schedule(doc).total, kind).toBeCloseTo(3.2);
    }
    const cut = sanitizeDoc(
      JSON.parse(
        JSON.stringify(createDoc({ assets: ASSETS, shots: [shot("s0", "cut")] as never })),
      ),
    ).doc;
    expect(cut.shots[0].transitionIn.kind).toBe("cut");
  });

  it("drops a saved entrance", () => {
    const saved = JSON.parse(
      JSON.stringify(createDoc({ assets: ASSETS, shots: [shot("s0", "cut")] as never })),
    );
    saved.shots[0].entrance = "rise";
    const { doc } = sanitizeDoc(saved);
    expect("entrance" in doc.shots[0]).toBe(false);
    expect(evaluate(doc, 0).layers[0].frame.nodes[0].opacity).toBe(1);
  });
});
