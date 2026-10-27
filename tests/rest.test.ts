import { describe, expect, it } from "vitest";
import { createDoc } from "../src/doc/defaults";
import type { AssetRef, ProjectDoc } from "../src/doc/types";
import { evaluate, holdsStill, schedule } from "../src/motion";
import {
  buildTemplate,
  desktopSiteTourTemplate,
  framesTemplate,
  scrollStoryTemplate,
  type Template,
} from "../src/templates";

function page(i: number, height: number): AssetRef {
  return {
    id: `page-${i}`,
    kind: "image",
    name: `page ${i}`,
    mime: "image/png",
    bytes: 1,
    width: 2880,
    height,
    role: "desktop",
  };
}

function templateDoc(template: Template, assets: AssetRef[]): ProjectDoc {
  const built = buildTemplate(template, { aspect: "16:9", assets, name: template.name });
  return { ...createDoc(), aspect: "16:9", assets, ...built };
}

/** holdsStill at the start, a third of the way, two thirds and the last instant of the doc. */
function stillAcross(doc: ProjectDoc): boolean[] {
  const { total } = schedule(doc);
  return [0, total / 3, (2 * total) / 3, total].map((t) => {
    const [layer] = evaluate(doc, t).layers;
    return holdsStill(doc, layer.frame);
  });
}

describe("holdsStill: when the URL pill's text snaps to whole pixels (quality bar §3.2)", () => {
  it("holds for a Site Tour, whose browser and camera never move", () => {
    const doc = templateDoc(
      desktopSiteTourTemplate,
      [1, 2, 3].map((i) => page(i, 1800)),
    );
    expect(stillAcross(doc)).toEqual([true, true, true, true]);
  });

  it("never holds while the camera moves: Scroll Story's push-in", () => {
    const doc = templateDoc(scrollStoryTemplate, [page(1, 9000)]);
    expect(doc.shots[0].camera.preset).toBe("pushIn");
    expect(stillAcross(doc)).toEqual([false, false, false, false]);
  });

  it("never holds while the devices move: Frames' lanes", () => {
    const doc = templateDoc(
      framesTemplate,
      [1, 2, 3, 4, 5, 6].map((i) => page(i, 1800)),
    );
    expect(doc.shots[0].camera.preset).toBe("static");
    expect(stillAcross(doc)).toEqual([false, false, false, false]);
  });
});
