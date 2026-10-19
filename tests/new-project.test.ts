import { describe, expect, it } from "vitest";
import { createDoc, defaultStyle, newProjectDoc } from "../src/doc/defaults";
import { sanitizeDoc } from "../src/doc/validate";
import type { AssetRef } from "../src/doc/types";
import { createEditorStore } from "../src/state/store";
import { presetToneOf } from "../src/templates/looks";

function image(id: string, role: AssetRef["role"]): AssetRef {
  return { id, kind: "image", name: `${id}.png`, mime: "image/png", bytes: 1000, role };
}

function singleLayout(store: ReturnType<typeof createEditorStore>) {
  const layout = store.getState().doc.shots[0].layout;
  if (layout.kind !== "single") throw new Error(`Expected a single layout, got ${layout.kind}`);
  return layout;
}

describe("New project: the preset look", () => {
  it("starts on Ash with no shadow, grain or vignette, and a still browser shot", () => {
    const doc = newProjectDoc();
    expect(presetToneOf(doc.style)).toBe("light");
    expect([doc.style.shadow, doc.style.grain, doc.style.vignette]).toEqual(["none", 0, 0]);
    expect(doc.shots).toHaveLength(1);
    expect(doc.shots[0].layout).toEqual({ kind: "single", device: "browser", assetId: "" });
    expect(doc.shots[0].camera.preset).toBe("static");
    // The sanitizer keeps it, so a saved new project reloads with the same look.
    expect(sanitizeDoc(doc).doc.style).toEqual(doc.style);
  });

  it("is what the editor opens and what New project creates", () => {
    const store = createEditorStore();
    expect(store.getState().doc.style).toEqual(newProjectDoc().style);
    store.getState().loadDoc(createDoc());
    store.getState().newDoc();
    expect(store.getState().doc.style).toEqual(newProjectDoc().style);
  });

  it("leaves a saved project's look alone", () => {
    const saved = createDoc();
    expect(sanitizeDoc(saved).doc.style).toEqual(defaultStyle());
    const store = createEditorStore(saved);
    expect(store.getState().doc.style).toEqual(defaultStyle());
  });
});

describe("New project: the first screenshot fills the empty screen", () => {
  it("puts the first added screenshot on the browser", async () => {
    const store = createEditorStore();
    await store.getState().addAssets([image("home", "desktop"), image("about", "desktop")]);
    expect(singleLayout(store)).toEqual({ kind: "single", device: "browser", assetId: "home" });
  });

  it("turns the browser into a phone for a mobile screenshot", async () => {
    const store = createEditorStore();
    await store.getState().addAssets([image("home-mobile", "mobile")]);
    expect(singleLayout(store)).toEqual({
      kind: "single",
      device: "phone",
      assetId: "home-mobile",
    });
  });

  it("never replaces a screenshot already on screen", async () => {
    const store = createEditorStore();
    await store.getState().addAssets([image("home", "desktop")]);
    await store.getState().addAssets([image("about", "mobile")]);
    expect(singleLayout(store)).toEqual({ kind: "single", device: "browser", assetId: "home" });
  });
});
