import { describe, expect, it } from "vitest";
import { createDoc } from "../src/doc/defaults";
import type { Aspect, AssetRef, Layout, ProjectDoc } from "../src/doc/types";
import { sanitizeDoc } from "../src/doc/validate";
import { showsCameraControls } from "../src/editor/inspector/shot/camera-visibility";
import { screenLabelRequests } from "../src/engine/text/screen-labels";
import {
  compareEdge,
  compareGeometry,
  compareTiming,
  evaluate,
  fixedShotCamera,
  isPacedShot,
  type LayoutNode,
  paceLimited,
  paceTargets,
  PHONE_BORDER,
  resolveCompareLayout,
  resolveSingleLayout,
  schedule,
} from "../src/motion";
import { aspectRatioValue } from "../src/motion/camera";
import { createEditorStore } from "../src/state/store";
import { convertDocToUserTemplate, fillUserTemplateSlots } from "../src/storage/user-templates";
import {
  BUILTIN_TEMPLATES,
  buildTemplate,
  buildTemplatePreviewDoc,
  desktopBeforeAfterTemplate,
  fillSlots,
  missingRequiredSlots,
  mobileBeforeAfterTemplate,
  pairedTemplateId,
  templateNeeds,
  validateTemplateRequirements,
} from "../src/templates";
import { FLAT_TONES, templateTones } from "../src/templates/looks";

// Presets round two, T2: Desktop and Mobile Before & After (docs/presets-2-plan, D6–D8, D13–D15).

type CompareLayout = Extract<Layout, { kind: "compare" }>;
type Role = "desktop" | "mobile";

const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];
const ROLES: Role[] = ["desktop", "mobile"];
// Shot lengths per pace: Calm, Default and Brisk scale the 6.0 s loop, plus the 0.8 s wrap.
const DURATIONS = { calm: 8, default: 6.8, brisk: 5.6 } as const;

function shot(role: Role, name: string, size?: { width: number; height: number }): AssetRef {
  return {
    id: `${role}-${name}`,
    kind: "image",
    name: `${role} ${name}`,
    mime: "image/png",
    bytes: 1,
    width: size?.width ?? (role === "mobile" ? 780 : 2880),
    height: size?.height ?? (role === "mobile" ? 1688 : 1800),
    role,
  };
}

const designs = (role: Role) => [shot(role, "old"), shot(role, "new")];

function compare(role: Role): CompareLayout {
  return {
    kind: "compare",
    device: role === "mobile" ? "phone" : "browser",
    beforeId: `${role}-old`,
    afterId: `${role}-new`,
  };
}

function screenAt(role: Role, aspect: Aspect, t: number, duration = 6.8): LayoutNode {
  const nodes = resolveCompareLayout(compare(role), aspect, designs(role), t, duration);
  expect(nodes).toHaveLength(1);
  return nodes[0];
}

/** A one-shot Before & After document, as the template builds it. */
function compareDoc(role: Role, aspect: Aspect = "16:9", assets = designs(role)): ProjectDoc {
  const template = role === "mobile" ? mobileBeforeAfterTemplate : desktopBeforeAfterTemplate;
  const built = buildTemplate(template, { aspect, assets, name: "Test" });
  return { ...createDoc(), aspect, assets, ...built };
}

describe("Before & After timeline (D8)", () => {
  it("holds the old design 1.0 s, sweeps for 2.0 s on smooth, then holds the new one", () => {
    expect(compareTiming(6.8)).toEqual({ loop: 6, sweepStart: 1, sweepEnd: 3 });
    for (const t of [0, 0.5, 1]) expect(compareEdge(t, 6.8), `t=${t}`).toBe(0);
    // smooth is cubic-bezier(0.65, 0, 0.35, 1): symmetric, so half way through it is half way.
    expect(compareEdge(2, 6.8)).toBeCloseTo(0.5, 6);
    expect(compareEdge(1.5, 6.8)).toBeLessThan(0.25);
    for (const t of [3, 4, 5.2, 6, 6.8]) expect(compareEdge(t, 6.8), `t=${t}`).toBe(1);
  });

  it("scales the whole timeline with the pace, keeping the 0.8 s wrap crossfade", () => {
    const expected = {
      calm: [7.2, 1.2, 3.6],
      default: [6, 1, 3],
      brisk: [4.8, 0.8, 2.4],
    } as const;
    for (const [pace, duration] of Object.entries(DURATIONS)) {
      const { loop, sweepStart, sweepEnd } = compareTiming(duration);
      const [loopS, startS, endS] = expected[pace as keyof typeof expected];
      expect(loop, pace).toBeCloseTo(loopS, 12);
      expect(sweepStart, pace).toBeCloseTo(startS, 12);
      expect(sweepEnd, pace).toBeCloseTo(endS, 12);
    }
  });

  it("never reverses: the edge only moves right, and the divider shows only while it moves", () => {
    for (const duration of Object.values(DURATIONS)) {
      const { sweepStart, sweepEnd } = compareTiming(duration);
      let previous = screenAt("desktop", "16:9", 0, duration);
      // Every 5 ms, as i / 200 so the samples land on the phase boundaries exactly.
      for (let i = 1; i <= duration * 200; i++) {
        const t = i / 200;
        const node = screenAt("desktop", "16:9", t, duration);
        const label = `${duration} s at ${t.toFixed(3)}`;
        const [before, after] = node.panes!;
        expect(after.clip[1], label).toBeGreaterThanOrEqual(previous.panes![1].clip[1]);
        expect(before.clip[0], label).toBe(after.clip[1]);
        expect(node.divider!.x, label).toBe(after.clip[1]);
        if (t <= sweepStart || t >= sweepEnd) expect(node.divider!.opacity, label).toBe(0);
        // Fully drawn once it is clear of the screen's edges.
        if (node.divider!.x > 0.02 && node.divider!.x < 0.98) {
          expect(node.divider!.opacity, label).toBe(1);
        }
        previous = node;
      }
    }
  });

  it("loops by the wrap crossfade back to frame 0, at every pace", () => {
    for (const role of ROLES) {
      for (const [pace, duration] of Object.entries(DURATIONS)) {
        const doc = compareDoc(role);
        if (pace !== "default") doc.shots[0].pace = pace as "calm" | "brisk";
        doc.shots[0].duration = duration;
        const label = `${role} ${pace}`;
        const { total } = schedule(doc);
        expect(total, label).toBeCloseTo(duration - 0.8, 12);
        expect(evaluate(doc, total), label).toEqual(evaluate(doc, 0));
        const first = evaluate(doc, 0).layers[0].frame;
        // During the crossfade the outgoing layer holds the new design and the incoming layer
        // is frame 0: the old design, whole, with no divider.
        for (const t of [total - 0.7, total - 0.4, total - 1e-4]) {
          const layers = evaluate(doc, t).layers;
          expect(layers, `${label} at ${t}`).toHaveLength(2);
          const [outgoing, incoming] = layers;
          expect(outgoing.frame.nodes[0].panes![1].clip, `${label} at ${t}`).toEqual([0, 1]);
          expect(incoming.frame.nodes, `${label} at ${t}`).toEqual(first.nodes);
        }
        expect(evaluate(doc, total - 1e-4).layers[1].weight, label).toBeGreaterThan(0.999);
      }
    }
  });
});

describe("Before & After screen (contracts.md §4)", () => {
  it("draws both designs fit to the screen with complementary clips, each with its label", () => {
    for (const role of ROLES) {
      for (const t of [0, 1.4, 2, 2.6, 4]) {
        const node = screenAt(role, "4:5", t);
        const e = compareEdge(t, 6.8);
        const size = compareGeometry(compare(role), "4:5", designs(role)).labelSize;
        expect(node.panes, `${role} at ${t}`).toEqual([
          {
            assetId: `${role}-old`,
            offset: 0,
            clip: [e, 1],
            scroll: 0,
            label: { text: "Before", corner: "bottom-right", size },
          },
          {
            assetId: `${role}-new`,
            offset: 0,
            clip: [0, e],
            scroll: 0,
            label: { text: "After", corner: "bottom-left", size },
          },
        ]);
        // The node's screenshot is the design that covers most of the screen.
        expect(node.assetId, `${role} at ${t}`).toBe(e < 0.5 ? `${role}-old` : `${role}-new`);
        expect(node.id).toBe("compare:screen");
      }
    }
  });

  it("is an empty screen until it has its screenshots", () => {
    const empty = resolveCompareLayout(
      { kind: "compare", device: "browser", beforeId: "", afterId: "" },
      "16:9",
      [],
      2,
      6.8,
    )[0];
    expect(empty.assetId).toBeNull();
    expect(empty.panes!.map((pane) => pane.assetId)).toEqual([null, null]);
  });
});

describe("Before & After geometry (quality bar §4)", () => {
  it("is Scroll Story's single browser or phone at every aspect, centred and still", () => {
    for (const role of ROLES) {
      const device = role === "mobile" ? "phone" : "browser";
      for (const aspect of ASPECTS) {
        const label = `${role} ${aspect}`;
        const first = screenAt(role, aspect, 0);
        const [single] = resolveSingleLayout(
          { kind: "single", device, assetId: `${role}-new` },
          aspect,
          designs(role),
        );
        for (const t of [0, 2, 4.5]) {
          const node = screenAt(role, aspect, t);
          expect([node.device, node.width, node.height, node.screenAspect], label).toEqual([
            single.device,
            single.width,
            single.height,
            single.screenAspect,
          ]);
          expect(node.transform).toEqual(first.transform);
          expect(node.transform).toEqual({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 });
        }
        const W = aspectRatioValue(aspect);
        const margin = 0.07 * Math.min(W, 1);
        expect((W - first.width) / 2, label).toBeGreaterThanOrEqual(margin - 1e-12);
        expect((1 - first.height) / 2, label).toBeGreaterThanOrEqual(margin - 1e-12);
      }
    }
  });

  it("sizes the labels and the divider per device: legible on a small screen", () => {
    // The browser's label text and divider in stage units (frame heights) per aspect: 1.75% and
    // 0.4% of its screen's width, at least 1.85% and 0.35% of the frame height.
    const BROWSER: Record<Aspect, [label: number, divider: number]> = {
      "16:9": [0.0175 * 0.68 * (16 / 9), 0.004 * 0.68 * (16 / 9)],
      "4:3": [0.0185, 0.004 * 0.68 * (4 / 3)],
      "1:1": [0.0185, 0.0035],
      "4:5": [0.0185, 0.0035],
      "9:16": [0.0185, 0.0035],
    };
    for (const aspect of ASPECTS) {
      const browser = compareGeometry(compare("desktop"), aspect, designs("desktop"));
      expect(browser.screenWidth, aspect).toBe(screenAt("desktop", aspect, 0).width);
      expect(browser.labelSize, aspect).toBeCloseTo(BROWSER[aspect][0], 12);
      expect(browser.dividerWidth, aspect).toBeCloseTo(BROWSER[aspect][1], 12);
      const phone = compareGeometry(compare("mobile"), aspect, designs("mobile"));
      expect(phone.screenWidth, aspect).toBeCloseTo(0.74 * 0.481 * (1 - 2 * PHONE_BORDER), 3);
      expect([phone.labelSize, phone.dividerWidth], aspect).toEqual([0.0185, 0.0035]);
    }
  });

  it("gives the browser the new design's screen aspect; both are fit to its width", () => {
    const wide = shot("desktop", "new", { width: 1920, height: 1000 });
    const layout = compare("desktop");
    expect(compareGeometry(layout, "16:9", [shot("desktop", "old"), wide]).screenAspect).toBe(1.92);
    // Without a new design, the old one sets it.
    const oldOnly = { ...layout, afterId: "" };
    expect(compareGeometry(oldOnly, "16:9", [{ ...wide, id: "desktop-old" }]).screenAspect).toBe(
      1.92,
    );
    expect(compareGeometry(compare("mobile"), "16:9", []).screenAspect).toBe(0.4615);
  });
});

describe("Desktop Before & After and Mobile Before & After templates", () => {
  it("are a built-in pair after the Site Tour pair, with two required slots", () => {
    const ids = BUILTIN_TEMPLATES.map((t) => t.id);
    expect(ids.indexOf("desktop-before-after")).toBe(ids.indexOf("mobile-site-tour") + 1);
    expect(ids.indexOf("mobile-before-after")).toBe(ids.indexOf("desktop-before-after") + 1);
    expect(pairedTemplateId("desktop-before-after")).toBe("mobile-before-after");
    expect(pairedTemplateId("mobile-before-after")).toBe("desktop-before-after");
    for (const [template, role] of [
      [desktopBeforeAfterTemplate, "desktop"],
      [mobileBeforeAfterTemplate, "mobile"],
    ] as const) {
      expect(template.name).toBe(
        role === "mobile" ? "Mobile Before & After" : "Desktop Before & After",
      );
      expect(template.description).toBe("The new design sweeps across the old one, then holds.");
      expect(template.category).toBe(role);
      expect(templateTones(template)).toEqual(FLAT_TONES);
      expect(template.slots.map((s) => [s.key, s.role, s.required, s.label])).toEqual([
        [`${role}1`, role, true, `Old ${role} design`],
        [`${role}2`, role, true, `New ${role} design`],
      ]);
      expect(templateNeeds(template)).toBe(`Needs 2 ${role} screenshots`);
    }
  });

  it("take the first screenshot in Library order as the old design", () => {
    const assets = [shot("desktop", "a"), shot("desktop", "b"), shot("desktop", "c")];
    const filled = fillSlots(desktopBeforeAfterTemplate, assets);
    expect([filled.desktop1?.id, filled.desktop2?.id]).toEqual(["desktop-a", "desktop-b"]);
    const layout = compareDoc("desktop", "16:9", assets).shots[0].layout;
    expect(layout).toEqual({
      kind: "compare",
      device: "browser",
      beforeId: "desktop-a",
      afterId: "desktop-b",
    });
  });

  it("report each missing design, and never compare a screenshot with itself", () => {
    for (const [template, role] of [
      [desktopBeforeAfterTemplate, "desktop"],
      [mobileBeforeAfterTemplate, "mobile"],
    ] as const) {
      const other = role === "mobile" ? "desktop" : "mobile";
      const missing = (assets: AssetRef[]) =>
        missingRequiredSlots(template, assets).map((s) => s.label);
      expect(missing([])).toEqual([`Old ${role} design`, `New ${role} design`]);
      expect(missing(designs(other))).toEqual([`Old ${role} design`, `New ${role} design`]);
      // One screenshot is the old design; the new one is still missing, not the same one again.
      expect(missing([shot(role, "old")])).toEqual([`New ${role} design`]);
      expect(missing(designs(role))).toEqual([]);
      expect(validateTemplateRequirements(template, [shot(role, "old")])).toEqual({
        valid: false,
        reason: `Needs 2 ${role} screenshots`,
      });
      expect(validateTemplateRequirements(template, designs(role))).toEqual({ valid: true });
      const one = compareDoc(role, "16:9", [shot(role, "old")]).shots[0].layout;
      expect(one).toMatchObject({ beforeId: `${role}-old`, afterId: "" });
    }
  });

  it("build a still, crossfading 6.0 s loop on Ash with Scroll Story's soft shadow", () => {
    for (const role of ROLES) {
      for (const aspect of ASPECTS) {
        const label = `${role} ${aspect}`;
        const doc = compareDoc(role, aspect);
        const [built] = doc.shots;
        expect(built.layout, label).toEqual(compare(role));
        expect(built.duration, label).toBe(6.8);
        expect(built.pace, label).toBeUndefined();
        expect(built.transitionIn, label).toEqual({
          kind: "fade",
          duration: 0.8,
          easing: "quintInOut",
        });
        expect(built.camera, label).toEqual({ preset: "static", intensity: 0, easing: "smooth" });
        expect(doc.loop, label).toBe(true);
        expect(schedule(doc).total, label).toBeCloseTo(6, 12);
        expect(doc.style, label).toMatchObject({
          background: { kind: "solid", color: "#DFE1E3" },
          frameAppearance: "light",
          browserChrome: "standard",
          shadow: "soft",
          grain: 0,
          vignette: 0,
        });
      }
    }
  });

  it("show Aurelia's earlier home page, then today's, as demo content (D14)", () => {
    for (const role of ROLES) {
      const doc = buildTemplatePreviewDoc(
        role === "mobile" ? mobileBeforeAfterTemplate : desktopBeforeAfterTemplate,
      );
      expect(doc.shots[0].layout).toMatchObject({
        beforeId: `demo-aurelia-home-before-${role}-hero`,
        afterId: `demo-aurelia-${role}-hero`,
      });
      expect(doc.style.browserUrl).toBe("aurelia.studio");
    }
  });

  it("set the labels in white Inter Medium, rasterized for the largest label", () => {
    const doc = compareDoc("desktop");
    const size = compareGeometry(compare("desktop"), "16:9", designs("desktop")).labelSize;
    expect(screenLabelRequests(doc).map((request) => request.line)).toEqual([
      {
        id: "screen-label:Before",
        text: "Before",
        size: size * 200,
        color: "#FFFFFF",
        weight: 500,
      },
      { id: "screen-label:After", text: "After", size: size * 200, color: "#FFFFFF", weight: 500 },
    ]);
    // Only Before & After's screens carry labels.
    const tour = buildTemplatePreviewDoc(
      BUILTIN_TEMPLATES.find((t) => t.id === "desktop-site-tour")!,
    );
    expect(screenLabelRequests(tour)).toEqual([]);
  });
});

describe("A Before & After shot in the editor", () => {
  it("follows the pace, keeps a still camera and shows no Camera section", () => {
    const layout = compare("desktop");
    expect(isPacedShot({ layout })).toBe(true);
    expect(paceTargets({ layout }, "16:9")).toEqual(DURATIONS);
    expect(paceLimited({ layout }, "9:16")).toEqual({});
    const camera = { preset: "pushIn", intensity: 1, easing: "smooth" } as const;
    expect(fixedShotCamera(layout, camera)).toEqual({
      preset: "static",
      intensity: 0,
      easing: "smooth",
    });
    expect(showsCameraControls({ layout, camera })).toBe(false);
  });

  it("changes pace, swaps the designs in one undo step and undoes camera edits", () => {
    const doc = compareDoc("mobile");
    doc.assets.push(shot("mobile", "other"));
    const store = createEditorStore(doc);
    const current = () => store.getState().doc.shots[0];
    store.getState().setShotPace(0, "brisk");
    expect(current().duration).toBeCloseTo(5.6, 12);
    store.getState().setShotPace(0, "calm");
    expect(current().duration).toBe(8);

    const steps = store.getState().past.length;
    store.getState().swapBeforeAfter(0);
    expect(current().layout).toMatchObject({ beforeId: "mobile-new", afterId: "mobile-old" });
    expect(store.getState().past.length).toBe(steps + 1);
    store.getState().undo();
    expect(current().layout).toMatchObject({ beforeId: "mobile-old", afterId: "mobile-new" });

    store.getState().apply((draft) => {
      draft.shots[0].camera = { preset: "pushIn", intensity: 1, easing: "smooth" };
    });
    expect(current().camera.preset).toBe("static");
    // A screenshot dropped on the screen becomes the new design.
    store.getState().assignAssetToSlot(0, "compare:screen", "mobile-other");
    expect(current().layout).toMatchObject({ beforeId: "mobile-old", afterId: "mobile-other" });
    expect(current().duration).toBe(8);
  });
});

describe("Saved Before & After projects", () => {
  it("round-trip through JSON and sanitizeDoc unchanged", () => {
    for (const role of ROLES) {
      const doc = compareDoc(role, "4:5");
      doc.shots[0].pace = "calm";
      doc.shots[0].duration = 8;
      const saved = JSON.parse(JSON.stringify(doc)) as ProjectDoc;
      const { doc: loaded, warnings } = sanitizeDoc(saved);
      expect(warnings, role).toEqual([]);
      expect(loaded.shots, role).toEqual(doc.shots);
      expect(evaluate(loaded, 2.7), role).toEqual(evaluate(doc, 2.7));
    }
  });

  it("load a damaged one as a browser of the screenshots that exist, timed by its pace", () => {
    const doc = compareDoc("desktop");
    const raw = JSON.parse(JSON.stringify(doc));
    raw.shots[0].layout.device = "laptop";
    raw.shots[0].layout.afterId = "missing";
    raw.shots[0].duration = 9;
    raw.shots[0].camera = { preset: "pushIn", intensity: 1, easing: "smooth" };
    const { doc: loaded } = sanitizeDoc(raw);
    const [loadedShot] = loaded.shots;
    expect(loadedShot.layout).toEqual({ ...compare("desktop"), afterId: "" });
    // A saved 9 s shot takes the nearest pace, Calm: an 8.0 s shot, a 7.2 s loop.
    expect(loadedShot.pace).toBe("calm");
    expect(loadedShot.duration).toBe(8);
    expect(loadedShot.camera.preset).toBe("static");
  });

  it("keep the comparison in a user template", () => {
    const doc = compareDoc("mobile");
    const template = convertDocToUserTemplate(doc, "Mine");
    const assets = designs("mobile").map((a) => ({ ...a, id: `new-${a.id}` }));
    const filled = fillUserTemplateSlots(template, assets, "16:9");
    expect(filled.shots[0].layout).toEqual({
      ...compare("mobile"),
      beforeId: "new-mobile-old",
      afterId: "new-mobile-new",
    });
    expect(filled.shots[0].duration).toBe(6.8);
  });
});
