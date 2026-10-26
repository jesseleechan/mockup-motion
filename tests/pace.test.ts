import { describe, expect, it } from "vitest";
import { createDoc, defaultShot } from "../src/doc/defaults";
import type { Aspect, AssetRef, Layout, ProjectDoc, Shot } from "../src/doc/types";
import { sanitizeDoc } from "../src/doc/validate";
import { changeAspect } from "../src/editor/aspect";
import {
  applyPace,
  evaluate,
  framesDuration,
  isPacedShot,
  isSteppedLayout,
  nearestPace,
  paceLimited,
  paceTargets,
  resolveLayout,
  schedule,
  sliderStepMax,
  steppedCount,
  type Pace,
} from "../src/motion";
import { createEditorStore } from "../src/state/store";
import {
  BUILTIN_TEMPLATES,
  buildTemplatePreviewDoc,
  framesLayout,
  mobileFramesLayout,
} from "../src/templates";

// P5, one pace control (docs/polish-plan/inspectors.md; quality-bar §2.2, "Pace").

const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];
const PACES: Pace[] = ["calm", "default", "brisk"];
// Quality bar §2.5: a Frames lane moves at most 0.20 stage units per second.
const FRAMES_LIMIT = 0.2;

type FramesLayout = Extract<Layout, { kind: "rows" | "columns" }>;
type SliderLayout = Extract<Layout, { kind: "slider" }>;

const ids = (count: number) => Array.from({ length: count }, (_, i) => `a${i}`);

function image(id: string): AssetRef {
  return { id, kind: "image", name: id, mime: "image/png", bytes: 1, width: 1440, height: 900 };
}

/** A document holding one shot with `layout`, with every screenshot it lists in the library. */
function docWith(layout: Layout, aspect: Aspect, shot: Partial<Shot> = {}): ProjectDoc {
  const assetIds = "assetIds" in layout ? layout.assetIds : [];
  return {
    ...createDoc(),
    aspect,
    assets: assetIds.map(image),
    shots: [{ ...defaultShot(layout), ...shot }],
  };
}

const knobOf = (shot: Shot): number =>
  isSteppedLayout(shot.layout)
    ? shot.layout.step
    : shot.layout.kind === "responsive"
      ? (shot.scroll?.hold ?? NaN)
      : shot.duration;

const isFrames = (layout: Layout): layout is FramesLayout =>
  layout.kind === "rows" || layout.kind === "columns";

/** What the paced presets built before P5 (quality bar §2.2): today's Default timing. */
function todaysKnob(shot: Shot, aspect: Aspect): number {
  if (isSteppedLayout(shot.layout)) {
    return Math.min(2, sliderStepMax(steppedCount(shot.layout)));
  }
  if (isFrames(shot.layout)) return Math.max(15, framesDuration(shot.layout, aspect));
  return 1;
}

/** Calm and Brisk per the approved table: ×1.2 and ×0.8 on Default, rounded, then clamped. */
function expectedKnob(shot: Shot, aspect: Aspect, pace: Pace): number {
  const scale = { calm: 1.2, default: 1, brisk: 0.8 }[pace];
  const base = todaysKnob(shot, aspect);
  if (isSteppedLayout(shot.layout)) {
    const max = sliderStepMax(steppedCount(shot.layout));
    return Math.min(max, Math.max(1.6, Math.round(2 * scale * 10) / 10));
  }
  if (isFrames(shot.layout)) {
    const shortest = framesDuration(shot.layout, aspect);
    return Math.min(30, Math.max(shortest, Math.round(base * scale * 2) / 2));
  }
  return Math.round(scale * 10) / 10;
}

/** The loop's first and last frames match: frame(total) ≡ frame(0). */
function expectSeamless(doc: ProjectDoc, label: string) {
  const { total } = schedule(doc);
  expect(evaluate(doc, total), label).toEqual(evaluate(doc, 0));
}

describe("Pace on every built-in template", () => {
  const paced = BUILTIN_TEMPLATES.filter((t) =>
    isPacedShot(buildTemplatePreviewDoc(t, "16:9").shots[0]),
  );

  it("covers the sliders, stacks, orbits, Frames and Responsive Scroll, not Scroll Story", () => {
    for (const template of BUILTIN_TEMPLATES) {
      const shot = buildTemplatePreviewDoc(template, "16:9").shots[0];
      const expected = template.id.includes("scroll-story") ? false : true;
      expect(isPacedShot(shot), template.id).toBe(expected);
    }
  });

  it("Default is what every template builds today, and loading it changes nothing", () => {
    for (const template of BUILTIN_TEMPLATES) {
      for (const aspect of ASPECTS) {
        const doc = buildTemplatePreviewDoc(template, aspect);
        const label = `${template.id} ${aspect}`;
        const [shot] = doc.shots;
        expect(shot.pace, label).toBeUndefined();
        if (isPacedShot(shot)) {
          expect(knobOf(shot), label).toBeCloseTo(todaysKnob(shot, aspect), 9);
          expect(paceTargets(shot, aspect)?.default, label).toBeCloseTo(knobOf(shot), 9);
        }
        // sanitizeDoc and the store keep the template's timing exactly.
        expect(sanitizeDoc(doc).doc.shots, label).toEqual(doc.shots);
        expect(createEditorStore(doc).getState().doc.shots, label).toEqual(doc.shots);
      }
    }
  });

  it("Calm and Brisk follow the table, stay in their limits and loop seamlessly", () => {
    for (const template of paced) {
      for (const aspect of ASPECTS) {
        const doc = buildTemplatePreviewDoc(template, aspect);
        for (const pace of PACES) {
          const label = `${template.id} ${aspect} ${pace}`;
          const shot = applyPace(doc.shots[0], pace, aspect, doc.assets);
          expect(knobOf(shot), label).toBeCloseTo(expectedKnob(shot, aspect, pace), 9);
          expect(shot.duration, label).toBeLessThanOrEqual(30);
          if (isSteppedLayout(shot.layout)) {
            expect(shot.duration, label).toBeCloseTo(
              steppedCount(shot.layout) * shot.layout.step,
              9,
            );
          }
          if (isFrames(shot.layout)) {
            expect(shot.duration, label).toBeGreaterThanOrEqual(
              framesDuration(shot.layout, aspect),
            );
          }
          expectSeamless({ ...doc, shots: [shot] }, label);
        }
      }
    }
  });
});

describe("Pace values", () => {
  const frames = (
    make: (aspect: Aspect, assetIds: string[]) => FramesLayout,
    aspect: Aspect,
    count: number,
  ) => paceTargets(defaultShot(make(aspect, ids(count))), aspect);

  it("Frames: ×1.2 and ×0.8 on Default in 0.5 s steps, never past the speed limit or 30 s", () => {
    // Four screenshots: Default is the 15 s reference loop.
    expect(frames(framesLayout, "4:5", 4)).toEqual({ calm: 18, default: 15, brisk: 12 });
    // At 16:9 four desktop cards already need 15 s: Brisk equals Default.
    expect(frames(framesLayout, "16:9", 4)).toEqual({ calm: 18, default: 15, brisk: 15 });
    expect(frames(mobileFramesLayout, "9:16", 4)).toEqual({ calm: 18, default: 15, brisk: 12 });
    // Six: Default is the speed limit, so Brisk can't be faster.
    expect(frames(framesLayout, "16:9", 6)).toEqual({ calm: 27, default: 22.5, brisk: 22.5 });
    expect(frames(mobileFramesLayout, "16:9", 6)).toEqual({
      calm: 23.5,
      default: 19.5,
      brisk: 19.5,
    });
    // Ten phones at 4:5 need the whole 30 s: no pace can differ.
    expect(frames(mobileFramesLayout, "4:5", 10)).toEqual({ calm: 30, default: 30, brisk: 30 });

    for (const make of [framesLayout, mobileFramesLayout]) {
      for (const aspect of ASPECTS) {
        for (const count of [4, 6, 10]) {
          const layout = make(aspect, ids(count));
          const targets = paceTargets(defaultShot(layout), aspect);
          for (const pace of PACES) {
            const duration = targets?.[pace] ?? NaN;
            expect(duration).toBeLessThanOrEqual(30);
            // Lanes move one asset period per loop (contracts.md §5); measure the speed.
            const nodes = (t: number) =>
              resolveLayout(layout, aspect, [], t, duration).map((n) =>
                isFrames(layout) && layout.kind === "rows" ? n.transform.x : n.transform.y,
              );
            const a = nodes(1);
            const b = nodes(2);
            const speed = Math.max(...a.map((v, i) => Math.abs(b[i] - v)).filter((d) => d < 0.5));
            expect(speed).toBeLessThanOrEqual(FRAMES_LIMIT + 1e-9);
          }
        }
      }
    }
  });

  it("sliders: 1.6, 2.0 and 2.4 s per step until 30 s runs out", () => {
    const slider = (count: number) =>
      paceTargets(
        defaultShot({ kind: "slider", assetIds: ids(count), axis: "x", shape: "mobile", step: 2 }),
        "4:5",
      );
    expect(slider(6)).toEqual({ calm: 2.4, default: 2, brisk: 1.6 });
    expect(slider(13)).toEqual({ calm: 2.3, default: 2, brisk: 1.6 });
    expect(slider(15)).toEqual({ calm: 2, default: 2, brisk: 1.6 });
    expect(slider(18)).toEqual({ calm: 1.6, default: 1.6, brisk: 1.6 });
  });

  it("an orbit's step counts only the 6 screenshots it shows", () => {
    const orbit = defaultShot({ kind: "orbit", assetIds: ids(10), shape: "mobile", step: 2 });
    expect(paceTargets(orbit, "4:5")).toEqual({ calm: 2.4, default: 2, brisk: 1.6 });
    const shot = applyPace(orbit, "calm", "4:5", []);
    expect(shot.duration).toBeCloseTo(6 * 2.4, 9);
  });

  it("Responsive Scroll holds 0.8, 1.0 and 1.2 s and lasts its holds plus moves", () => {
    const doc = buildTemplatePreviewDoc(
      BUILTIN_TEMPLATES.find((t) => t.id === "responsive-scroll") ?? BUILTIN_TEMPLATES[0],
      "16:9",
    );
    const [shot] = doc.shots;
    expect(paceTargets(shot, "16:9")).toEqual({ calm: 1.2, default: 1, brisk: 0.8 });
    const calm = applyPace(shot, "calm", "16:9", doc.assets);
    const brisk = applyPace(shot, "brisk", "16:9", doc.assets);
    expect(calm.duration).toBeGreaterThan(shot.duration);
    expect(brisk.duration).toBeLessThan(shot.duration);
    expect(calm.duration).toBeLessThanOrEqual(30);
  });

  it("disables a pace a limit makes equal to Default, with its reason", () => {
    const slider = (count: number) =>
      defaultShot({ kind: "slider", assetIds: ids(count), axis: "x", shape: "mobile", step: 2 });
    expect(paceLimited(slider(6), "4:5")).toEqual({});
    expect(paceLimited(slider(15), "4:5")).toEqual({ calm: "No room in 30 s" });
    expect(paceLimited(slider(18), "4:5")).toEqual({
      calm: "No room in 30 s",
      brisk: "Already at the speed limit",
    });
    expect(paceLimited(defaultShot(framesLayout("16:9", ids(6))), "16:9")).toEqual({
      brisk: "Already at the speed limit",
    });
  });
});

describe("Saved projects take the nearest pace once", () => {
  const slider = (step: number): Layout => ({
    kind: "slider",
    assetIds: ids(4),
    axis: "x",
    shape: "mobile",
    step,
  });
  const loaded = (layout: Layout, aspect: Aspect, shot: Partial<Shot> = {}) =>
    sanitizeDoc(docWith(layout, aspect, shot)).doc.shots[0];

  it("maps a saved step to Brisk, Default or Calm; ties go to Default", () => {
    expect(loaded(slider(1.7), "4:5")).toMatchObject({ pace: "brisk", layout: { step: 1.6 } });
    expect(loaded(slider(2.2), "4:5").pace).toBeUndefined();
    expect(loaded(slider(2.2), "4:5").layout).toMatchObject({ step: 2 });
    expect(loaded(slider(3.5), "4:5")).toMatchObject({ pace: "calm", layout: { step: 2.4 } });
    expect(nearestPace(defaultShot(slider(1.8)), "4:5")).toBe("default");
  });

  it("maps saved 20 s and 30 s Frames loops to Calm", () => {
    for (const duration of [20, 30]) {
      const shot = loaded(framesLayout("4:5", ids(4)), "4:5", { duration });
      expect(shot.pace, String(duration)).toBe("calm");
      expect(shot.duration, String(duration)).toBe(18);
    }
    expect(loaded(framesLayout("4:5", ids(4)), "4:5", { duration: 15 }).pace).toBeUndefined();
  });

  it("maps a saved 0.6 s Responsive Scroll hold to Brisk", () => {
    const layout: Layout = { kind: "responsive", desktopId: "a0", mobileId: "a1" };
    const doc = docWith(layout, "16:9", {
      scroll: { enabled: true, stops: [0, 1], hold: 0.6, easing: "smooth" },
    });
    doc.assets = [image("a0"), image("a1")];
    const shot = sanitizeDoc(doc).doc.shots[0];
    expect(shot.pace).toBe("brisk");
    expect(shot.scroll?.hold).toBe(0.8);
  });

  it("keeps a stored pace, and a Default shot stays Default when a screenshot is removed", async () => {
    expect(loaded(slider(2), "4:5", { pace: "calm" })).toMatchObject({
      pace: "calm",
      layout: { step: 2.4 },
    });
    // Eighteen at 1.6 s is Default (and Brisk); taking one out of the library lifts the clamp.
    const doc = docWith({ ...slider(1.6), assetIds: ids(18) } as SliderLayout, "4:5");
    const store = createEditorStore(doc);
    await store.getState().removeAsset("a17");
    const shot = store.getState().doc.shots[0];
    expect(shot.pace).toBeUndefined();
    expect(shot.layout).toMatchObject({ step: 1.7 });
  });
});

describe("A pace choice survives the limits it meets", () => {
  it("a Brisk Frames shot stays Brisk through 4:5 → 16:9 → 4:5", () => {
    const store = createEditorStore(docWith(framesLayout("4:5", ids(4)), "4:5", { duration: 15 }));
    const shot = () => store.getState().doc.shots[0];
    store.getState().setShotPace(0, "brisk");
    expect(shot().duration).toBe(12);
    store.getState().apply((draft) => changeAspect(draft, "16:9"));
    // At 16:9 four cards need 15 s: Brisk meets the speed limit.
    expect(shot()).toMatchObject({ pace: "brisk", duration: 15 });
    store.getState().apply((draft) => changeAspect(draft, "4:5"));
    expect(shot()).toMatchObject({ pace: "brisk", duration: 12 });
  });

  it("a Brisk choice on an 18-screenshot slider survives removing screenshots", () => {
    const layout: SliderLayout = {
      kind: "slider",
      assetIds: ids(18),
      axis: "x",
      shape: "mobile",
      step: 1.6,
    };
    const store = createEditorStore(docWith(layout, "4:5"));
    const shot = () => store.getState().doc.shots[0];
    store.getState().setShotPace(0, "brisk");
    for (const id of ids(18).slice(6)) store.getState().removeAssetFromShot(0, id);
    expect(shot().pace).toBe("brisk");
    expect(shot().layout).toMatchObject({ step: 1.6 });
    expect(shot().duration).toBeCloseTo(6 * 1.6, 9);
  });

  it("a Calm slider meets the 30 s limit and comes back when screenshots go", () => {
    const layout: SliderLayout = {
      kind: "slider",
      assetIds: ids(12),
      axis: "x",
      shape: "mobile",
      step: 2,
    };
    const doc = docWith(layout, "4:5");
    doc.assets = ids(15).map(image);
    const store = createEditorStore(doc);
    const shot = () => store.getState().doc.shots[0];
    store.getState().setShotPace(0, "calm");
    expect(shot().layout).toMatchObject({ step: 2.4 });
    for (const id of ["a12", "a13", "a14"]) store.getState().addAssetToShot(0, id);
    expect(shot().layout).toMatchObject({ step: 2 });
    for (const id of ["a12", "a13", "a14"]) store.getState().removeAssetFromShot(0, id);
    expect(shot()).toMatchObject({ pace: "calm", layout: { step: 2.4 } });
  });

  it("a pace change is one undo step that restores the step and the length", () => {
    const store = createEditorStore(docWith(framesLayout("4:5", ids(4)), "4:5", { duration: 15 }));
    const before = store.getState().doc;
    store.getState().setShotPace(0, "calm");
    expect(store.getState().doc.shots[0]).toMatchObject({ pace: "calm", duration: 18 });
    expect(store.getState().past).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().doc).toBe(before);
    // Choosing the current pace again records nothing.
    store.getState().setShotPace(0, "default");
    expect(store.getState().past).toHaveLength(0);
  });
});
