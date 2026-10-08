import { describe, expect, it } from "vitest";
import { createEditorStore } from "../src/state/store";
import { useUIStore } from "../src/state/ui-store";
import {
  applyTemplate,
  demoAssetsToFill,
  getTemplateById,
  missingRequiredSlots,
  type Template,
} from "../src/templates";
import { demoAssetRef } from "../src/lab/demo-assets";
import type { AssetRef } from "../src/doc/types";
import { createDoc } from "../src/doc/defaults";
import { schedule } from "../src/motion";
import { demoContentTemplate } from "../src/editor/template-actions";

function template(id: string): Template {
  const t = getTemplateById(id);
  if (!t) throw new Error(`No template ${id}`);
  return t;
}

const userDesktop: AssetRef = {
  id: "user-desktop",
  kind: "image",
  name: "home.png",
  mime: "image/png",
  bytes: 1000,
  width: 1440,
  height: 900,
  role: "desktop",
};

describe("F06: template gallery state", () => {
  it("opens and closes from the UI store", () => {
    expect(useUIStore.getState().templateGalleryOpen).toBe(false);
    useUIStore.getState().openTemplateGallery();
    expect(useUIStore.getState().templateGalleryOpen).toBe(true);
    useUIStore.getState().closeTemplateGallery();
    expect(useUIStore.getState().templateGalleryOpen).toBe(false);
  });
});

describe("F06: missing required slots", () => {
  it("lists every required slot when there are no assets", () => {
    const missing = missingRequiredSlots(template("responsive-pair"), []);
    expect(missing.map((s) => s.key)).toEqual(["desktop1", "mobile1"]);
  });

  it("lists only the role that has no asset", () => {
    const missing = missingRequiredSlots(template("responsive-pair"), [userDesktop]);
    expect(missing.map((s) => s.key)).toEqual(["mobile1"]);
  });

  it("ignores optional slots", () => {
    // responsive-trio's tablet slot is optional; desktop and mobile fill the required ones.
    const assets = demoAssetsToFill(template("responsive-trio"), []);
    expect(missingRequiredSlots(template("responsive-trio"), assets)).toEqual([]);
  });
});

describe("F06: template-aware demo content", () => {
  it("fills every required slot of each built-in template from an empty project", () => {
    for (const id of [
      "desktop-slider",
      "mobile-slider",
      "frames",
      "quiet-hero",
      "responsive-pair",
      "phone-parade",
      "portfolio-rows",
      "launch-reel",
    ]) {
      const t = template(id);
      const demo = demoAssetsToFill(t, []);
      expect(demo.length, id).toBeGreaterThan(0);
      expect(missingRequiredSlots(t, demo), id).toEqual([]);
    }
  });

  it("keeps the user's own screenshot and adds demo content only for the empty role", () => {
    const demo = demoAssetsToFill(template("responsive-pair"), [userDesktop]);
    expect(demo.map((a) => a.role)).toEqual(["mobile"]);
  });

  it("adds nothing when the template is already filled", () => {
    const filled = [
      demoAssetRef("demo-aurelia-desktop-full"),
      demoAssetRef("demo-aurelia-mobile-hero"),
    ];
    expect(demoAssetsToFill(template("responsive-pair"), filled)).toEqual([]);
  });
});

describe("Presets D1: first-run default", () => {
  it("fills Desktop Slider on first run and keeps a project's own template", () => {
    expect(demoContentTemplate(createDoc()).id).toBe("desktop-slider");
    const doc = { ...createDoc(), templateId: "responsive-pair" };
    expect(demoContentTemplate(doc).id).toBe("responsive-pair");
  });

  it("builds a vertical slider of the demo desktop screenshots in one undo step", async () => {
    const store = createEditorStore();
    const empty = store.getState().doc;
    const pastBefore = store.getState().past.length;
    const template = demoContentTemplate(empty);
    const demo = demoAssetsToFill(template, empty.assets);
    await store
      .getState()
      .addAssetsAndApplyTemplate(demo, template.id, (doc) => applyTemplate(template, doc));

    const filled = store.getState().doc;
    expect(store.getState().past.length).toBe(pastBefore + 1);
    expect(filled.templateId).toBe("desktop-slider");
    expect(filled.assets.map((a) => a.id)).toEqual([
      "demo-northwind-desktop-hero",
      "demo-aurelia-desktop-hero",
      "demo-maison-oak-desktop-hero",
      "demo-field-notes-desktop-hero",
      "demo-studio-kova-desktop-hero",
    ]);
    expect(missingRequiredSlots(template, filled.assets)).toEqual([]);
    expect(filled.shots).toHaveLength(1);
    const layout = filled.shots[0].layout;
    if (layout.kind !== "slider") throw new Error(`Expected a slider layout, got ${layout.kind}`);
    expect(layout.axis).toBe("y");
    expect(layout.assetIds).toEqual(filled.assets.map((a) => a.id));
    expect(filled.loop).toBe(true);
    // Five screenshots at the 2.0 s default step (D4).
    expect(schedule(filled).total).toBeCloseTo(10, 9);

    store.getState().undo();
    expect(store.getState().doc).toBe(empty);
  });
});

describe("F06: add assets and apply a template in one undo step", () => {
  it("fills the slots from the added assets and undoes in one step", async () => {
    const store = createEditorStore();
    const pair = template("responsive-pair");
    store.getState().applyTemplateResult(applyTemplate(pair, store.getState().doc), pair.id);
    const afterApply = store.getState().doc;
    const pastBefore = store.getState().past.length;

    const demo = demoAssetsToFill(pair, afterApply.assets);
    await store
      .getState()
      .addAssetsAndApplyTemplate(demo, pair.id, (doc) => applyTemplate(pair, doc));

    const filled = store.getState().doc;
    expect(store.getState().past.length).toBe(pastBefore + 1);
    expect(filled.assets.map((a) => a.id)).toEqual(demo.map((a) => a.id));
    const layout = filled.shots[0].layout;
    expect(layout.kind).toBe("pair");
    if (layout.kind !== "pair") throw new Error("Expected a pair layout");
    expect(layout.desktopId).toBe(demo.find((a) => a.role === "desktop")?.id);
    expect(layout.mobileId).toBe(demo.find((a) => a.role === "mobile")?.id);

    store.getState().undo();
    expect(store.getState().doc).toBe(afterApply);
    expect(store.getState().doc.assets).toEqual([]);
  });

  it("keeps the brand style the template preserves", async () => {
    const store = createEditorStore();
    store.getState().apply((draft) => {
      draft.style.accent = "#FF5500";
      draft.style.textColor = "#112233";
    });
    const pair = template("responsive-pair");
    await store
      .getState()
      .addAssetsAndApplyTemplate(demoAssetsToFill(pair, []), pair.id, (doc) =>
        applyTemplate(pair, doc),
      );
    expect(store.getState().doc.style.accent).toBe("#FF5500");
    expect(store.getState().doc.style.textColor).toBe("#112233");
    expect(store.getState().doc.templateId).toBe("responsive-pair");
  });
});
