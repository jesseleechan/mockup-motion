import { describe, expect, it } from "vitest";
import type { ProjectDoc } from "../src/doc/types";
import { frameEffectsFor } from "../src/editor/inspector/frame-effects";
import { buildTemplatePreviewDoc, getTemplateById } from "../src/templates";

function presetDoc(id: string): ProjectDoc {
  const template = getTemplateById(id);
  if (!template) throw new Error(`Unknown template: ${id}`);
  return buildTemplatePreviewDoc(template);
}

describe("Frame and effects shows only what applies", () => {
  it("a flat preset with cards shows none of the browser, grain or vignette controls", () => {
    expect(frameEffectsFor(presetDoc("desktop-slider"))).toEqual({
      browserChrome: false,
      browserUrl: false,
      grain: false,
      vignette: false,
    });
  });

  it("Scroll Story's browser on a Fog gradient shows the chrome, URL, grain and vignette", () => {
    expect(frameEffectsFor(presetDoc("scroll-story"))).toEqual({
      browserChrome: true,
      browserUrl: true,
      grain: true,
      vignette: true,
    });
  });

  it("the URL hides with the chrome, and a phone has no browser controls", () => {
    const doc = presetDoc("scroll-story");
    doc.style.browserChrome = "none";
    expect(frameEffectsFor(doc)).toMatchObject({ browserChrome: true, browserUrl: false });
    expect(frameEffectsFor(presetDoc("mobile-scroll-story"))).toMatchObject({
      browserChrome: false,
      browserUrl: false,
    });
  });

  it("on a flat fill, a grain or vignette already above 0 keeps its control to turn it off", () => {
    const doc = presetDoc("frames");
    doc.style.grain = 0.2;
    expect(frameEffectsFor(doc)).toMatchObject({ grain: true, vignette: false });
    doc.style.grain = 0;
    doc.style.vignette = 0.1;
    expect(frameEffectsFor(doc)).toMatchObject({ grain: false, vignette: true });
  });
});
