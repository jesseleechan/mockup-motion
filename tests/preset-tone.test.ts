import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { createDoc } from "../src/doc/defaults";
import { sanitizeDoc } from "../src/doc/validate";
import type { ProjectDoc } from "../src/doc/types";
import { createEditorStore } from "../src/state/store";
import { loadProject, saveProject } from "../src/storage/projects";
import {
  BUILTIN_TEMPLATES,
  applyTemplate,
  buildTemplatePreviewDoc,
  demoAssetsForTemplate,
  getTemplateById,
} from "../src/templates";
import { presetToneOf, presetToneStyle, setPresetTone } from "../src/templates/looks";

const ASH = { kind: "solid", color: "#DFE1E3" };
const ONYX = { kind: "solid", color: "#141417" };
const TONE_TEMPLATES = ["desktop-slider", "mobile-slider", "frames", "mobile-frames"];

function presetDoc(id: string): ProjectDoc {
  const template = getTemplateById(id);
  if (!template) throw new Error(`Unknown template: ${id}`);
  return buildTemplatePreviewDoc(template);
}

describe("Preset tone: the Light / Dark background of the slider and Frames presets", () => {
  it("dark is a flat Onyx fill with light text and dark frames; light is Ash", () => {
    expect(presetToneStyle("dark")).toEqual({
      background: ONYX,
      textColor: "#F4F4F5",
      frameAppearance: "dark",
    });
    expect(presetToneStyle("light")).toEqual({
      background: ASH,
      textColor: "#18181B",
      frameAppearance: "light",
    });
  });

  it("reads the tone back from the background, and nothing from other backgrounds", () => {
    expect(presetToneOf({ background: { kind: "solid", color: "#141417" } })).toBe("dark");
    expect(presetToneOf({ background: { kind: "solid", color: "#dfe1e3" } })).toBe("light");
    expect(presetToneOf({ background: { kind: "solid", color: "#FFFFFF" } })).toBeUndefined();
    expect(presetToneOf(createDoc().style)).toBeUndefined();
  });

  it("only the four presets show the switch, and they still default to Ash", () => {
    const withSwitch = BUILTIN_TEMPLATES.filter((t) => t.toneSwitch).map((t) => t.id);
    expect(withSwitch.sort()).toEqual([...TONE_TEMPLATES].sort());
    for (const id of TONE_TEMPLATES) {
      const doc = presetDoc(id);
      expect(doc.style.background).toEqual(ASH);
      expect(presetToneOf(doc.style)).toBe("light");
    }
  });

  it("switching is one undo step and keeps grain, vignette and shadow", () => {
    const store = createEditorStore();
    store.getState().loadDoc(presetDoc("frames"));
    const before = store.getState().doc.style;
    const pastBefore = store.getState().past.length;

    store.getState().apply((draft) => setPresetTone(draft.style, "dark"), {
      label: "Use dark background",
    });
    const dark = store.getState().doc.style;
    expect(presetToneOf(dark)).toBe("dark");
    expect(dark.frameAppearance).toBe("dark");
    expect(dark.textColor).toBe("#F4F4F5");
    expect([dark.grain, dark.vignette, dark.shadow]).toEqual([0, 0, "none"]);
    expect(store.getState().past.length).toBe(pastBefore + 1);

    store.getState().undo();
    expect(store.getState().doc.style).toEqual(before);
    store.getState().redo();
    expect(presetToneOf(store.getState().doc.style)).toBe("dark");
  });

  it("re-applying a preset, or filling its slots, keeps a dark document dark", () => {
    const doc = presetDoc("frames");
    setPresetTone(doc.style, "dark");

    for (const id of TONE_TEMPLATES) {
      const template = getTemplateById(id)!;
      const result = applyTemplate(template, {
        ...doc,
        assets: demoAssetsForTemplate(id),
      });
      expect(result.style.background, id).toEqual(ONYX);
      expect(result.style.frameAppearance, id).toBe("dark");
      expect([result.style.grain, result.style.vignette], id).toEqual([0, 0]);
    }

    // A preset applied to a light document stays on Ash.
    const light = applyTemplate(getTemplateById("mobile-frames")!, presetDoc("frames"));
    expect(light.style.background).toEqual(ASH);
  });

  it("other templates keep their own background on a dark document", () => {
    const doc = presetDoc("desktop-slider");
    setPresetTone(doc.style, "dark");
    const result = applyTemplate(getTemplateById("scroll-story")!, doc);
    expect(presetToneOf(result.style)).not.toBe("dark");
  });

  it("dark survives sanitizeDoc and a save and load", async () => {
    const doc = presetDoc("mobile-slider");
    setPresetTone(doc.style, "dark");

    const { doc: sanitized } = sanitizeDoc(JSON.parse(JSON.stringify(doc)));
    expect(presetToneOf(sanitized.style)).toBe("dark");
    expect(sanitized.style.frameAppearance).toBe("dark");
    expect(sanitized.style.textColor).toBe("#F4F4F5");

    await saveProject(doc);
    const loaded = await loadProject(doc.id);
    expect(loaded && presetToneOf(loaded.style)).toBe("dark");
    expect(loaded?.style.frameAppearance).toBe("dark");
  });
});
