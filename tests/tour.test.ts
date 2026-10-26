import { describe, expect, it } from "vitest";
import { createDoc } from "../src/doc/defaults";
import type { Aspect, AssetRef, Layout, ProjectDoc } from "../src/doc/types";
import { sanitizeDoc } from "../src/doc/validate";
import { showsCameraControls } from "../src/editor/inspector/shot/camera-visibility";
import { textureWidths } from "../src/engine/textures/sizing";
import {
  evaluate,
  fixedShotCamera,
  isSteppedLayout,
  type LayoutNode,
  minShotScreenshots,
  paceTargets,
  resolveSingleLayout,
  resolveTourLayout,
  schedule,
  type ScreenPane,
  sliderDuration,
  sliderStep,
  steppingPanes,
  tourGeometry,
} from "../src/motion";
import { aspectRatioValue } from "../src/motion/camera";
import { createEditorStore } from "../src/state/store";
import { convertDocToUserTemplate, fillUserTemplateSlots } from "../src/storage/user-templates";
import { demoAsset } from "../src/lab/demo-assets";
import {
  BUILTIN_TEMPLATES,
  buildTemplate,
  buildTemplatePreviewDoc,
  desktopSiteTourTemplate,
  missingRequiredSlots,
  mobileSiteTourTemplate,
  pairedTemplateId,
  templateNeeds,
  validateTemplateRequirements,
} from "../src/templates";
import { FLAT_TONES, templateTones } from "../src/templates/looks";

type TourLayout = Extract<Layout, { kind: "tour" }>;
type Role = "desktop" | "mobile";

const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];
const ROLES: Role[] = ["desktop", "mobile"];

function page(role: Role, i: number): AssetRef {
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

function pages(role: Role, n: number): AssetRef[] {
  return Array.from({ length: n }, (_, i) => page(role, i));
}

function tour(role: Role, n: number, step = 2): TourLayout {
  const device = role === "mobile" ? "phone" : "browser";
  return { kind: "tour", device, assetIds: pages(role, n).map((a) => a.id), step };
}

function screenAt(layout: TourLayout, aspect: Aspect, t: number): LayoutNode {
  const role: Role = layout.device === "phone" ? "mobile" : "desktop";
  const nodes = resolveTourLayout(layout, aspect, pages(role, 8), t);
  expect(nodes).toHaveLength(1);
  return nodes[0];
}

/** A one-shot tour document, as the template builds it. */
function tourDoc(role: Role, n: number, aspect: Aspect = "16:9"): ProjectDoc {
  const template = role === "mobile" ? mobileSiteTourTemplate : desktopSiteTourTemplate;
  const assets = pages(role, n);
  const built = buildTemplate(template, { aspect, assets, name: "Test" });
  return { ...createDoc(), aspect, assets, ...built };
}

/** The part of the screen a pane draws on, [left, right] in screen widths. */
function band(pane: ScreenPane): [number, number] {
  return [Math.max(0, pane.clip[0], pane.offset), Math.min(1, pane.clip[1], pane.offset + 1)];
}

const visible = (panes: ScreenPane[]) => panes.filter((pane) => band(pane)[1] > band(pane)[0]);

describe("Site Tour motion (presets round two, D3)", () => {
  it("each step slides the next page in from the right as the current one leaves left", () => {
    const N = 4;
    const layout = tour("desktop", N);
    for (let k = 0; k < N; k++) {
      const [current, next] = [`desktop-${k}`, `desktop-${(k + 1) % N}`];
      for (const local of [0.05, 0.4, 0.925, 1.5]) {
        const t = k * 2 + local;
        const { p } = sliderStep(t, 2);
        const panes = screenAt(layout, "16:9", t).panes!;
        const shown = visible(panes);
        // Two pages, edge to edge, clipped to the screen; nothing else draws.
        expect(
          shown.map((pane) => pane.assetId),
          `step ${k} at ${local}`,
        ).toEqual(k === N - 1 ? [next, current] : [current, next]);
        const leaving = panes.find((pane) => pane.assetId === current)!;
        const arriving = panes.find((pane) => pane.assetId === next)!;
        expect(leaving.offset).toBeCloseTo(-p, 12);
        expect(arriving.offset).toBeCloseTo(1 - p, 12);
        expect(band(leaving)[1]).toBe(band(arriving)[0]);
        for (const pane of panes) expect(pane.clip).toEqual([0, 1]);
      }
      // The move takes 1.85 s on `slide`, then the next page holds, alone and whole.
      for (const local of [1.85, 1.99]) {
        const shown = visible(screenAt(layout, "16:9", k * 2 + local).panes!);
        expect(shown, `hold ${k} at ${local}`).toEqual([
          { assetId: next, offset: 0, clip: [0, 1], scroll: 0 },
        ]);
      }
    }
  });

  it("never reverses: every page only moves left, one step at a time", () => {
    for (const n of [2, 3, 4, 6]) {
      const layout = tour("mobile", n);
      const total = sliderDuration(layout);
      let previous = screenAt(layout, "4:5", 0).panes!;
      for (let t = 0.01; t < total; t += 0.01) {
        const panes = screenAt(layout, "4:5", t).panes!;
        panes.forEach((pane, i) => {
          // A page only moves left, except when it goes from the left edge, where less than a
          // thousandth of the screen still shows it, to wait just past the right one.
          const before = previous[i].offset;
          const [left, right] = band(previous[i]);
          const wrapped = before < 0 && right - left < 1e-3 && pane.offset === 1;
          expect(pane.offset <= before + 1e-12 || wrapped, `N=${n} t=${t.toFixed(2)}`).toBe(true);
        });
        previous = panes;
      }
    }
  });

  it("loops natively: frame(N × step) is frame(0), and the last hold already shows page 1", () => {
    for (const role of ROLES) {
      for (const aspect of ASPECTS) {
        for (const n of [1, 2, 3, 4, 6]) {
          for (const step of [1.6, 2, 2.4]) {
            const label = `${role} ${aspect} N=${n} step ${step}`;
            const layout = tour(role, n, step);
            const total = sliderDuration(layout);
            expect(total, label).toBeCloseTo(n * step, 12);
            const first = screenAt(layout, aspect, 0);
            expect(screenAt(layout, aspect, total), label).toEqual(first);
            // A step longer than the 1.85 s move ends on a hold that is already frame 0. (Brisk's
            // 1.6 s step moves for the whole step, as the slider's does.)
            if (step > 1.85) expect(screenAt(layout, aspect, total - 1e-4), label).toEqual(first);
          }
        }
      }
    }
  });

  it("keeps the device still and lists every page in every frame", () => {
    const layout = tour("desktop", 5);
    const first = screenAt(layout, "1:1", 0);
    for (let t = 0; t < 10; t += 0.25) {
      const node = screenAt(layout, "1:1", t);
      expect(node.id).toBe("tour:screen");
      expect(node.transform).toEqual({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 });
      expect([node.width, node.height, node.opacity]).toEqual([first.width, first.height, 1]);
      expect(node.panes!.map((pane) => pane.assetId)).toEqual(layout.assetIds);
      // A full page shows its top.
      for (const pane of node.panes!) expect(pane.scroll).toBe(0);
      // The node's screenshot is the page that covers most of the screen.
      const { p } = sliderStep(t, 2);
      const k = Math.floor(t / 2);
      expect(node.assetId, `t=${t}`).toBe(`desktop-${(p < 0.5 ? k : k + 1) % 5}`);
    }
  });

  it("holds a single page, and shows an empty screen without one", () => {
    expect(steppingPanes(["a"], 2, 0.9)).toEqual([
      { assetId: "a", offset: 0, clip: [0, 1], scroll: 0 },
    ]);
    const empty = resolveTourLayout(tour("desktop", 0), "16:9", [], 0.9)[0];
    expect([empty.assetId, empty.panes]).toEqual([
      null,
      [{ assetId: null, offset: 0, clip: [0, 1], scroll: 0 }],
    ]);
  });
});

describe("Site Tour geometry (quality bar §4)", () => {
  it("is Scroll Story's single browser or phone at every aspect, centred", () => {
    for (const role of ROLES) {
      const device = role === "mobile" ? "phone" : "browser";
      for (const aspect of ASPECTS) {
        const label = `${role} ${aspect}`;
        const node = screenAt(tour(role, 4), aspect, 0.9);
        const [single] = resolveSingleLayout(
          { kind: "single", device, assetId: `${role}-0` },
          aspect,
          [page(role, 0)],
        );
        expect([node.device, node.width, node.height, node.screenAspect], label).toEqual([
          single.device,
          single.width,
          single.height,
          single.screenAspect,
        ]);
        const W = aspectRatioValue(aspect);
        if (role === "mobile") {
          expect(node.height, label).toBe(0.74);
        } else {
          const wide = aspect === "16:9" || aspect === "4:3";
          expect(node.width / W, label).toBeCloseTo(wide ? 0.68 : 0.86, 12);
        }
        // The safe margin (7% of the shortest frame side) holds around the device.
        const margin = 0.07 * Math.min(W, 1);
        expect((W - node.width) / 2, label).toBeGreaterThanOrEqual(margin - 1e-12);
        expect((1 - node.height) / 2, label).toBeGreaterThanOrEqual(margin - 1e-12);
      }
    }
  });

  it("gives the browser the first page's screen aspect; every page is fit to its width", () => {
    const wide: AssetRef = { ...page("desktop", 0), width: 1920, height: 1000 };
    const layout = tour("desktop", 3);
    const g = tourGeometry(layout, "16:9", [wide, page("desktop", 1), page("desktop", 2)]);
    expect(g.screenAspect).toBe(1.92);
    expect(tourGeometry(tour("mobile", 3), "16:9", []).screenAspect).toBe(0.4615);
  });

  it("decodes every page at the screen's width", () => {
    const doc = tourDoc("desktop", 4);
    const widths = textureWidths(doc, { outputWidthPx: 1920, supersample: 1 });
    expect([...widths.keys()].sort()).toEqual(doc.assets.map((a) => a.id).sort());
    // 0.68 of a 1920 px frame, times the 1.5 oversample, in 256 px steps.
    expect(new Set(widths.values())).toEqual(new Set([2048]));
  });
});

describe("Desktop Site Tour and Mobile Site Tour templates", () => {
  it("are a built-in pair after the Orbit pair, with 6 slots and the first 3 required", () => {
    const ids = BUILTIN_TEMPLATES.map((t) => t.id);
    expect(ids.indexOf("desktop-site-tour")).toBe(ids.indexOf("mobile-orbit") + 1);
    expect(ids.indexOf("mobile-site-tour")).toBe(ids.indexOf("desktop-site-tour") + 1);
    expect(pairedTemplateId("desktop-site-tour")).toBe("mobile-site-tour");
    expect(pairedTemplateId("mobile-site-tour")).toBe("desktop-site-tour");
    for (const [template, role] of [
      [desktopSiteTourTemplate, "desktop"],
      [mobileSiteTourTemplate, "mobile"],
    ] as const) {
      expect(template.category).toBe(role);
      expect(templateTones(template)).toEqual(FLAT_TONES);
      expect(template.slots.map((s) => [s.key, s.role, s.required, s.prefer])).toEqual(
        [1, 2, 3, 4, 5, 6].map((n) => [`${role}${n}`, role, n <= 3, "any"]),
      );
      expect(templateNeeds(template)).toBe(`Needs 3+ ${role} screenshots`);
      expect(validateTemplateRequirements(template, pages(role, 2))).toEqual({
        valid: false,
        reason: `Needs 3+ ${role} screenshots`,
      });
      expect(validateTemplateRequirements(template, pages(role, 3))).toEqual({ valid: true });
      // With no screenshot of its size, demo content fills the three required slots.
      const other = role === "mobile" ? "desktop" : "mobile";
      expect(missingRequiredSlots(template, pages(other, 4)).map((s) => s.key)).toEqual(
        [1, 2, 3].map((n) => `${role}${n}`),
      );
    }
  });

  it("build a still, natively looping tour on Ash with Scroll Story's soft shadow", () => {
    for (const role of ROLES) {
      for (const aspect of ASPECTS) {
        for (const n of [3, 4, 6]) {
          const label = `${role} ${aspect} N=${n}`;
          const doc = tourDoc(role, n, aspect);
          const [shot] = doc.shots;
          expect(shot.layout, label).toEqual({
            kind: "tour",
            device: role === "mobile" ? "phone" : "browser",
            assetIds: doc.assets.map((a) => a.id),
            step: 2,
          });
          expect(shot.duration, label).toBe(n * 2);
          expect(shot.transitionIn.kind, label).toBe("cut");
          expect(shot.camera, label).toEqual({ preset: "static", intensity: 0, easing: "smooth" });
          expect(doc.loop, label).toBe(true);
          expect(doc.style, label).toMatchObject({
            background: { kind: "solid", color: "#DFE1E3" },
            frameAppearance: "light",
            browserChrome: "standard",
            shadow: "soft",
            grain: 0,
            vignette: 0,
          });
          const { total } = schedule(doc);
          expect(total, label).toBe(shot.duration);
          expect(evaluate(doc, total), label).toEqual(evaluate(doc, 0));
        }
      }
    }
  });

  it("show each page once when fillSlots runs short", () => {
    const assets = pages("mobile", 3);
    const built = buildTemplate(mobileSiteTourTemplate, { aspect: "9:16", assets, name: "x" });
    expect((built.shots[0].layout as TourLayout).assetIds).toEqual(assets.map((a) => a.id));
  });

  it("preview the pages of one demo site in its nav order, under its domain", () => {
    for (const template of [desktopSiteTourTemplate, mobileSiteTourTemplate]) {
      const doc = buildTemplatePreviewDoc(template);
      const ids = (doc.shots[0].layout as TourLayout).assetIds;
      const shown = ids.map((id) => demoAsset(id));
      expect(
        shown.map((a) => [a.site, a.page, a.role]),
        template.id,
      ).toEqual(
        ["home", "studio", "works", "journal"].map((page) => ["aurelia", page, template.category]),
      );
      // One site, so the URL pill shows its domain (D4).
      expect(doc.style.browserUrl, template.id).toBe("aurelia.studio");
    }
  });
});

describe("A Site Tour is a stepped shot", () => {
  it("lasts N × step on the pace's step, with a still camera and no Camera section", () => {
    const layout = tour("desktop", 5);
    expect(isSteppedLayout(layout)).toBe(true);
    expect(minShotScreenshots(layout)).toBe(3);
    expect(paceTargets({ layout }, "16:9")).toEqual({ calm: 2.4, default: 2, brisk: 1.6 });
    const camera = { preset: "pushIn", intensity: 1, easing: "smooth" } as const;
    expect(fixedShotCamera(layout, camera)).toEqual({
      preset: "static",
      intensity: 0,
      easing: "smooth",
    });
    expect(showsCameraControls({ layout, camera })).toBe(false);
  });

  it("keeps N × step through pace changes, added pages and camera edits", () => {
    const doc = tourDoc("desktop", 4);
    doc.assets.push(page("desktop", 9));
    const store = createEditorStore(doc);
    const shot = () => store.getState().doc.shots[0];
    store.getState().setShotPace(0, "brisk");
    expect([(shot().layout as TourLayout).step, shot().duration]).toEqual([1.6, 6.4]);
    store.getState().apply((draft) => {
      draft.shots[0].camera.preset = "pushIn";
      draft.shots[0].camera.intensity = 1;
    });
    expect(shot().camera.preset).toBe("static");
    // A screenshot dropped on the screen joins the end of the tour.
    store.getState().assignAssetToSlot(0, "tour:screen", "desktop-9");
    expect((shot().layout as TourLayout).assetIds).toEqual([
      "desktop-0",
      "desktop-1",
      "desktop-2",
      "desktop-3",
      "desktop-9",
    ]);
    expect(shot().duration).toBe(8);
    store.getState().removeAssetFromShot(0, "desktop-9");
    store.getState().removeAssetFromShot(0, "desktop-3");
    // Three pages are the minimum.
    store.getState().removeAssetFromShot(0, "desktop-2");
    expect((shot().layout as TourLayout).assetIds).toHaveLength(3);
    expect(shot().duration).toBeCloseTo(4.8, 12);
  });
});

describe("Saved Site Tours", () => {
  it("round-trip through JSON and sanitizeDoc unchanged", () => {
    for (const role of ROLES) {
      const doc = tourDoc(role, 5, "4:5");
      doc.shots[0].pace = "calm";
      doc.shots[0].layout = { ...(doc.shots[0].layout as TourLayout), step: 2.4 };
      doc.shots[0].duration = 12;
      const saved = JSON.parse(JSON.stringify(doc)) as ProjectDoc;
      const { doc: loaded, warnings } = sanitizeDoc(saved);
      expect(warnings, role).toEqual([]);
      expect(loaded.shots, role).toEqual(doc.shots);
      expect(evaluate(loaded, 3.3), role).toEqual(evaluate(doc, 3.3));
    }
  });

  it("load a damaged tour as a browser tour of the pages that exist, timed by its pace", () => {
    const doc = tourDoc("desktop", 4);
    const raw = JSON.parse(JSON.stringify(doc));
    raw.shots[0].layout.device = "laptop";
    raw.shots[0].layout.assetIds.push("missing");
    raw.shots[0].layout.step = 9;
    raw.shots[0].duration = 3;
    raw.shots[0].camera = { preset: "pushIn", intensity: 1, easing: "smooth" };
    const { doc: loaded } = sanitizeDoc(raw);
    const [shot] = loaded.shots;
    // A saved 9 s step takes the nearest pace, Calm: 2.4 s per page.
    expect(shot.layout).toEqual({ ...doc.shots[0].layout, step: 2.4 });
    expect(shot.pace).toBe("calm");
    expect(shot.duration).toBeCloseTo(9.6, 12);
    expect(shot.camera.preset).toBe("static");
  });

  it("keep the tour in a user template", () => {
    const doc = tourDoc("mobile", 4);
    const template = convertDocToUserTemplate(doc, "Mine");
    const assets = pages("mobile", 4).map((a) => ({ ...a, id: `new-${a.id}` }));
    const filled = fillUserTemplateSlots(template, assets, "16:9");
    expect(filled.shots[0].layout).toEqual({
      ...doc.shots[0].layout,
      assetIds: assets.map((a) => a.id),
    });
    expect(filled.shots[0].duration).toBe(8);
  });
});
