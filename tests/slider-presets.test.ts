import { describe, expect, it } from "vitest";
import { createDoc } from "../src/doc/defaults";
import type { Aspect, AssetRef, Layout, ProjectDoc } from "../src/doc/types";
import { sanitizeDoc } from "../src/doc/validate";
import {
  evaluate,
  resolveSliderLayout,
  schedule,
  SLIDER_MAX_SCREENSHOTS,
  sliderAssetIds,
  sliderDuration,
  sliderStepMax,
} from "../src/motion";
import { createEditorStore } from "../src/state/store";
import { convertDocToUserTemplate, fillUserTemplateSlots } from "../src/storage/user-templates";
import {
  BUILTIN_TEMPLATES,
  buildTemplate,
  desktopSliderTemplate,
  mobileSliderTemplate,
} from "../src/templates";

type SliderLayout = Extract<Layout, { kind: "slider" }>;

const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];

function screenshot(role: "mobile" | "desktop", i: number): AssetRef {
  return {
    id: `${role}-${i}`,
    kind: "image",
    name: `${role} ${i}`,
    mime: "image/png",
    bytes: 1,
    width: role === "mobile" ? 780 : 2880,
    height: role === "mobile" ? 1688 : 1800,
    role,
  };
}

function screenshots(role: "mobile" | "desktop", n: number): AssetRef[] {
  return Array.from({ length: n }, (_, i) => screenshot(role, i));
}

function slider(n: number, step = 2): SliderLayout {
  return {
    kind: "slider",
    assetIds: screenshots("mobile", n).map((a) => a.id),
    axis: "x",
    shape: "mobile",
    step,
  };
}

/** A one-shot slider document, as Mobile Slider builds it. */
function sliderDoc(n: number, step = 2): ProjectDoc {
  const assets = screenshots("mobile", Math.max(n, 20));
  const built = buildTemplate(mobileSliderTemplate, { aspect: "4:5", assets, name: "Test" });
  const doc: ProjectDoc = { ...createDoc(), aspect: "4:5", assets, ...built };
  const layout = doc.shots[0].layout as SliderLayout;
  layout.assetIds = assets.slice(0, n).map((a) => a.id);
  layout.step = step;
  doc.shots[0].duration = sliderDuration(layout);
  return doc;
}

const layoutOf = (doc: ProjectDoc): SliderLayout => doc.shots[0].layout as SliderLayout;

describe("Slider shots fit in 30 s (presets P03, decision of 8 October 2026)", () => {
  it("limits the step to min(4.0, 30 / N) in 0.1 s steps", () => {
    expect(sliderStepMax(4)).toBe(4);
    expect(sliderStepMax(15)).toBe(2);
    expect(sliderStepMax(18)).toBe(1.6);
    expect(sliderStepMax(19)).toBe(1.6);
    for (let n = 1; n <= 30; n++) {
      const shown = Math.min(n, SLIDER_MAX_SCREENSHOTS);
      expect(shown * sliderStepMax(n), `N = ${n}`).toBeLessThanOrEqual(30 + 1e-9);
    }
  });

  it("shows at most the first 18 screenshots and lasts 18 steps beyond that", () => {
    expect(SLIDER_MAX_SCREENSHOTS).toBe(18);
    expect(sliderAssetIds(slider(18))).toHaveLength(18);
    const nineteen = slider(19, 1.6);
    expect(sliderAssetIds(nineteen)).toEqual(nineteen.assetIds.slice(0, 18));
    expect(sliderDuration(nineteen)).toBeCloseTo(18 * 1.6, 9);
    expect(sliderDuration(slider(4, 4))).toBe(16);
    expect(sliderDuration(slider(15, 2))).toBe(30);

    // The 19th screenshot is never drawn.
    for (let t = 0; t < sliderDuration(nineteen); t += 0.25) {
      const nodes = resolveSliderLayout(nineteen, "4:5", [], t);
      expect(nodes.some((node) => node.assetId === "mobile-18")).toBe(false);
    }
  });

  it("sanitizeDoc limits the step to the screenshot count and sets the shot length", () => {
    const doc = sliderDoc(15, 2);
    layoutOf(doc).step = 4;
    doc.shots[0].duration = 12;
    const { doc: repaired } = sanitizeDoc(doc);
    expect(layoutOf(repaired).step).toBe(2);
    expect(repaired.shots[0].duration).toBe(30);

    const nineteen = sliderDoc(19, 1.6);
    nineteen.shots[0].duration = 30;
    const { doc: capped } = sanitizeDoc(nineteen);
    expect(layoutOf(capped).assetIds).toHaveLength(19);
    expect(capped.shots[0].duration).toBeCloseTo(28.8, 9);
  });
});

describe("Mobile Slider and Desktop Slider templates", () => {
  it("are built-in templates with the plan's ids, categories and slots", () => {
    const ids = BUILTIN_TEMPLATES.map((t) => t.id);
    expect(ids).toContain("mobile-slider");
    expect(ids).toContain("desktop-slider");
    expect(mobileSliderTemplate.category).toBe("mobile");
    expect(desktopSliderTemplate.category).toBe("portfolio");
    for (const [template, role] of [
      [mobileSliderTemplate, "mobile"],
      [desktopSliderTemplate, "desktop"],
    ] as const) {
      expect(template.slots.map((s) => [s.key, s.role, s.required])).toEqual(
        [1, 2, 3, 4, 5, 6].map((n) => [`${role}${n}`, role, n <= 3]),
      );
    }
  });

  it("build at every aspect with 3, 4 and 6 screenshots and loop natively", () => {
    for (const [template, role, axis] of [
      [mobileSliderTemplate, "mobile", "x"],
      [desktopSliderTemplate, "desktop", "y"],
    ] as const) {
      for (const aspect of ASPECTS) {
        for (const n of [3, 4, 6]) {
          const label = `${template.id} ${aspect} N=${n}`;
          const assets = screenshots(role, n);
          const built = buildTemplate(template, { aspect, assets, name: "Test" });
          const doc: ProjectDoc = { ...createDoc(), aspect, assets, ...built };
          expect(doc.shots, label).toHaveLength(1);
          const [shot] = doc.shots;
          expect(shot.layout, label).toEqual({
            kind: "slider",
            assetIds: assets.map((a) => a.id),
            axis,
            shape: role,
            step: 2,
          });
          expect(shot.duration, label).toBe(n * 2);
          expect(shot.transitionIn.kind, label).toBe("cut");
          expect(shot.camera, label).toMatchObject({ preset: "static", intensity: 0, float: 0 });
          expect(shot.entrance, label).toBe("none");
          expect(doc.loop, label).toBe(true);
          expect(doc.style, label).toMatchObject({
            background: { kind: "solid", color: "#DFE1E3" },
            shadow: "none",
            grain: 0,
            vignette: 0,
            frameAppearance: "light",
          });

          // No wrap crossfade: the schedule is the shot, and one layer shows up to the end.
          const { total } = schedule(doc);
          expect(total, label).toBe(shot.duration);
          expect(evaluate(doc, total - 1e-3).layers, label).toHaveLength(1);
          // Loop seam end to end: the frame at the loop point is the first frame.
          expect(evaluate(doc, total), label).toEqual(evaluate(doc, 0));
        }
      }
    }
  });

  it("never repeat a screenshot when fillSlots runs short", () => {
    const assets = screenshots("mobile", 3);
    const built = buildTemplate(mobileSliderTemplate, { aspect: "16:9", assets, name: "x" });
    const ids = (built.shots[0].layout as SliderLayout).assetIds;
    expect(ids).toEqual(["mobile-0", "mobile-1", "mobile-2"]);
  });
});

describe("Editing a slider keeps its loop seamless", () => {
  function storeWith(doc: ProjectDoc) {
    const store = createEditorStore(doc);
    return { store, shot: () => store.getState().doc.shots[0] };
  }

  it("a step change sets the duration to N × step, and undo restores both", () => {
    const { store, shot } = storeWith(sliderDoc(4));
    store.getState().apply((draft) => {
      (draft.shots[0].layout as SliderLayout).step = 3;
    });
    expect((shot().layout as SliderLayout).step).toBe(3);
    expect(shot().duration).toBe(12);
    store.getState().undo();
    expect((shot().layout as SliderLayout).step).toBe(2);
    expect(shot().duration).toBe(8);
  });

  it("keeps the camera still: a camera move is undone", () => {
    const { store, shot } = storeWith(sliderDoc(4));
    const still = shot().camera;
    expect(still).toEqual({ preset: "static", intensity: 0, easing: "smooth", float: 0 });
    store.getState().apply((draft) => {
      draft.shots[0].camera = { preset: "pushIn", intensity: 1, easing: "smooth", float: 0.5 };
    });
    expect(shot().camera).toEqual(still);
  });

  it("an edit that changes nothing stays a no-op on a still slider", () => {
    const { store } = storeWith(sliderDoc(4));
    const before = store.getState().doc;
    store.getState().apply((draft) => {
      draft.shots[0].transitionIn.kind = before.shots[0].transitionIn.kind;
    });
    expect(store.getState().doc).toBe(before);
    expect(store.getState().past).toHaveLength(0);
  });

  it("a loaded slider with a camera move gets a still camera", () => {
    const doc = sliderDoc(4);
    doc.shots[0].camera = {
      preset: "orbitLeft",
      intensity: 0.8,
      easing: "gentle",
      float: 0.3,
      progressRange: [0.2, 0.8],
    };
    const { doc: repaired } = sanitizeDoc(doc);
    expect(repaired.shots[0].camera).toEqual({
      preset: "static",
      intensity: 0,
      easing: "gentle",
      float: 0,
    });
    // Other layouts keep their camera.
    const single = createDoc();
    single.shots[0].camera = { preset: "pushIn", intensity: 1, easing: "smooth", float: 0.2 };
    expect(sanitizeDoc(single).doc.shots[0].camera).toEqual(single.shots[0].camera);
  });

  it("the duration can't be set by hand", () => {
    const { store, shot } = storeWith(sliderDoc(4));
    store.getState().setShotDuration(0, 5);
    expect(shot().duration).toBe(8);
    expect(store.getState().past).toHaveLength(0);
  });

  it("adding a screenshot adds one step; removing one takes it away", () => {
    const { store, shot } = storeWith(sliderDoc(4));
    store.getState().addAssetToShot(0, "mobile-9");
    expect((shot().layout as SliderLayout).assetIds).toEqual([
      "mobile-0",
      "mobile-1",
      "mobile-2",
      "mobile-3",
      "mobile-9",
    ]);
    expect(shot().duration).toBe(10);
    store.getState().addAssetToShot(0, "mobile-9");
    expect((shot().layout as SliderLayout).assetIds).toHaveLength(5);

    store.getState().removeAssetFromShot(0, "mobile-1");
    expect((shot().layout as SliderLayout).assetIds).not.toContain("mobile-1");
    expect(shot().duration).toBe(8);
  });

  it("removing a screenshot from the project takes it out of the slider", async () => {
    const { store, shot } = storeWith(sliderDoc(4));
    await store.getState().removeAsset("mobile-2");
    expect((shot().layout as SliderLayout).assetIds).toEqual(["mobile-0", "mobile-1", "mobile-3"]);
    expect(shot().duration).toBe(6);
  });

  it("a screenshot dropped on a card is added after that card's screenshot", () => {
    const { store, shot } = storeWith(sliderDoc(4));
    // The ring repeats the shown screenshots: node 5 shows screenshot 5 mod 4 = 1.
    store.getState().assignAssetToSlot(0, "slider:5", "mobile-9");
    expect((shot().layout as SliderLayout).assetIds).toEqual([
      "mobile-0",
      "mobile-1",
      "mobile-9",
      "mobile-2",
      "mobile-3",
    ]);
    expect(shot().duration).toBe(10);
  });

  it("more screenshots shorten a long step so the shot stays within 30 s", () => {
    const { store, shot } = storeWith(sliderDoc(7, 4));
    expect(shot().duration).toBe(28);
    store.getState().addAssetToShot(0, "mobile-12");
    expect((shot().layout as SliderLayout).step).toBe(3.7);
    expect(shot().duration).toBeCloseTo(29.6, 9);
  });

  it("past 18 screenshots the shot shows the first 18 at 1.6 s", () => {
    const { store, shot } = storeWith(sliderDoc(18, 1.6));
    store.getState().addAssetToShot(0, "mobile-19");
    expect((shot().layout as SliderLayout).assetIds).toHaveLength(19);
    expect((shot().layout as SliderLayout).step).toBe(1.6);
    expect(shot().duration).toBeCloseTo(28.8, 9);
  });
});

describe("User templates keep slider layouts", () => {
  it("save the screenshots as slots and restore them with their duration", () => {
    const doc = sliderDoc(4, 3);
    doc.assets = doc.assets.slice(0, 4);
    const template = convertDocToUserTemplate(doc, "Mine");
    const saved = template.shots[0].layout as SliderLayout;
    expect(saved.assetIds).toEqual([0, 1, 2, 3].map((i) => `slot:mobile:${i}`));

    const fresh = screenshots("desktop", 0).concat(
      ["a", "b", "c", "d", "e"].map((id) => ({ ...screenshot("mobile", 0), id })),
    );
    const restored = fillUserTemplateSlots(template, fresh);
    expect(restored.shots[0].layout).toMatchObject({ assetIds: ["a", "b", "c", "d"], step: 3 });
    expect(restored.shots[0].duration).toBe(12);

    // Fewer screenshots than slots: none repeats, and the shot gets shorter to match.
    const two = fillUserTemplateSlots(
      template,
      ["a", "b"].map((id) => ({ ...screenshot("mobile", 0), id })),
    );
    expect(two.shots[0].layout).toMatchObject({ assetIds: ["a", "b"] });
    expect(two.shots[0].duration).toBe(6);
  });
});
