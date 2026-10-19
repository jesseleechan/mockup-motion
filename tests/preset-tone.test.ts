import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { createDoc } from "../src/doc/defaults";
import { sanitizeDoc } from "../src/doc/validate";
import type { Background, ProjectDoc } from "../src/doc/types";
import { createEditorStore } from "../src/state/store";
import { loadProject, saveProject } from "../src/storage/projects";
import {
  applyTemplate,
  buildTemplatePreviewDoc,
  demoAssetsForTemplate,
  getTemplateById,
} from "../src/templates";
import {
  backgroundChoice,
  backgroundKey,
  customBackgroundStyle,
  presetToneOf,
  presetToneStyle,
  setPresetTone,
  templateTones,
  toneFillStyle,
} from "../src/templates/looks";

const ASH: Background = { kind: "solid", color: "#DFE1E3" };
const ONYX: Background = { kind: "solid", color: "#141417" };
const TONE_TEMPLATES = [
  "desktop-slider",
  "mobile-slider",
  "frames",
  "mobile-frames",
  "desktop-orbit",
  "mobile-orbit",
];

function presetDoc(id: string): ProjectDoc {
  const template = getTemplateById(id);
  if (!template) throw new Error(`Unknown template: ${id}`);
  return buildTemplatePreviewDoc(template);
}

const FOG: Background = {
  kind: "gradient",
  stops: ["#EEF1F4", "#D9DFE6"],
  angle: 315,
  angleConvention: "css",
};
const GRAPHITE = {
  kind: "gradient",
  stops: ["#141417", "#2A2A30"],
  angle: 305,
  angleConvention: "css",
};

describe("Preset tone: the Light / Dark background of every preset", () => {
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

  it("the flat presets use Ash and Onyx and still default to Ash", () => {
    for (const id of TONE_TEMPLATES) {
      expect(templateTones(getTemplateById(id)), id).toEqual({ light: "ash", dark: "onyx" });
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

  it("Scroll Story's fills are Fog and Graphite, read back from the gradient", () => {
    const tones = templateTones(getTemplateById("scroll-story"));
    expect(tones).toEqual({ light: "fog", dark: "graphite" });
    const doc = presetDoc("scroll-story");
    expect(doc.style.background).toEqual(FOG);
    expect(presetToneOf(doc.style, tones)).toBe("light");
    // The same gradient at another angle is a different fill.
    expect(presetToneOf({ background: { ...FOG, angle: 90 } }, tones)).toBeUndefined();
    expect(presetToneOf(doc.style)).toBeUndefined();
  });

  it("a dark document takes each preset's own dark fill when it is applied", () => {
    const doc = presetDoc("desktop-slider");
    setPresetTone(doc.style, "dark");
    const story = applyTemplate(getTemplateById("scroll-story")!, doc);
    expect(story.style.background).toEqual(GRAPHITE);
    expect(story.style.frameAppearance).toBe("dark");

    // And back: Scroll Story's Graphite becomes the slider's Onyx.
    const slider = applyTemplate(getTemplateById("desktop-slider")!, {
      ...doc,
      style: story.style,
    });
    expect(slider.style.background).toEqual(ONYX);
  });

  it("a custom colour is flat, and a dark one takes the white card hairline", () => {
    expect(customBackgroundStyle("#2B3A55")).toEqual({
      background: { kind: "solid", color: "#2B3A55" },
      frameAppearance: "dark",
    });
    expect(customBackgroundStyle("#F3E9DC")).toEqual({
      background: { kind: "solid", color: "#F3E9DC" },
      frameAppearance: "light",
    });
    // Mid grey sits either side of the OKLCH L 0.5 line.
    expect(customBackgroundStyle("#5E5E5E").frameAppearance).toBe("dark");
    expect(customBackgroundStyle("#7A7A7A").frameAppearance).toBe("light");
    // A custom colour that happens to equal a fill reads as that tone.
    expect(presetToneOf(customBackgroundStyle("#141417"))).toBe("dark");
  });

  it("the control sets only the fill and frame look, never the text colour", () => {
    const tones = templateTones(getTemplateById("scroll-story"));
    expect(Object.keys(toneFillStyle("dark", tones)).sort()).toEqual([
      "background",
      "frameAppearance",
    ]);
    expect(toneFillStyle("dark", tones)).toEqual({ background: GRAPHITE, frameAppearance: "dark" });
  });

  it("Custom stays selected only while the document shows the background it was opened on", () => {
    const tones = templateTones(getTemplateById("frames"));
    const ash = { background: ASH };
    const onyx = { background: ONYX };
    // Nothing open: the document decides.
    expect(backgroundChoice(ash, tones, null)).toBe("light");
    expect(backgroundChoice(onyx, tones, null)).toBe("dark");
    expect(backgroundChoice({ background: { kind: "solid", color: "#2B3A55" } }, tones, null)).toBe(
      "custom",
    );
    // Custom opened on Ash, before a colour is picked.
    const openOnAsh = backgroundKey(ASH);
    expect(backgroundChoice(ash, tones, openOnAsh)).toBe("custom");
    // An undo, redo or template change moves the document to Onyx: the document decides again.
    expect(backgroundChoice(onyx, tones, openOnAsh)).toBe("dark");
    // The key ignores letter case, as the tone read-out does.
    expect(backgroundKey({ kind: "solid", color: "#dfe1e3" })).toBe(openOnAsh);
  });

  it("a document on a dark custom colour takes the preset's Dark when one is applied", () => {
    const doc = presetDoc("frames");
    Object.assign(doc.style, customBackgroundStyle("#2B3A55"));
    const result = applyTemplate(getTemplateById("mobile-frames")!, {
      ...doc,
      assets: demoAssetsForTemplate("mobile-frames"),
    });
    expect(result.style.background).toEqual(ONYX);
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
