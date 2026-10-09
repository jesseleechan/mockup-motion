import { describe, expect, it } from "vitest";
import type { Shot } from "../src/doc/types";
import * as labels from "../src/editor/labels";

const LABEL_MAPS = Object.entries(labels).filter(
  (entry): entry is [string, Record<string, string>] =>
    entry[0].endsWith("_LABELS") && typeof entry[1] === "object",
);

// Brand names keep their capitals mid-label.
const PROPER_NOUNS = new Set(["LinkedIn", "X", "Dribbble", "Instagram"]);

function shot(layout: Shot["layout"], preset: Shot["camera"]["preset"]): Shot {
  return {
    id: "s1",
    duration: 4,
    layout,
    camera: { preset, intensity: 1, easing: "smooth", float: 0 },
    entrance: "none",
    texts: [],
    transitionIn: { kind: "cut", duration: 0, easing: "smooth" },
  };
}

describe("editor labels (F08)", () => {
  it("covers every map the UI uses", () => {
    expect(LABEL_MAPS.map(([name]) => name).sort()).toEqual([
      "ANCHOR_LABELS",
      "ASSET_ROLE_LABELS",
      "BROWSER_CHROME_LABELS",
      "CAMERA_LABELS",
      "DESTINATION_LABELS",
      "DEVICE_FINISH_LABELS",
      "DEVICE_LABELS",
      "EASING_LABELS",
      "ENTRANCE_LABELS",
      "LAYOUT_LABELS",
      "SHADOW_LABELS",
      "TEXT_ANIMATION_LABELS",
      "TEXT_ROLE_LABELS",
      "TRANSITION_LABELS",
    ]);
  });

  it.each(LABEL_MAPS)("%s are short sentence-case words, never the raw id", (_name, map) => {
    for (const [id, label] of Object.entries(map)) {
      expect(label, id).toMatch(/^[A-Z0-9]/);
      for (const [index, word] of label.split(" ").entries()) {
        if (PROPER_NOUNS.has(word)) continue;
        // camelCase ("pushIn") is an id, not a label.
        expect(word, `${id}: "${label}"`).not.toMatch(/[a-z][A-Z]/);
        if (index > 0) expect(word, `${id}: "${label}"`).not.toMatch(/^[A-Z][a-z]/);
      }
      // Inspector controls are about 160 px wide.
      expect(label.length, id).toBeLessThanOrEqual(18);
    }
  });

  it("orders every camera preset exactly once", () => {
    expect([...labels.CAMERA_PRESET_ORDER].sort()).toEqual(
      Object.keys(labels.CAMERA_LABELS).sort(),
    );
  });

  it("describes a shot by device or layout, and camera move", () => {
    expect(
      labels.shotSummary(shot({ kind: "single", device: "browser", assetId: "a" }, "pushIn")),
    ).toBe("Browser · Push in");
    expect(
      labels.shotSummary(
        shot({ kind: "pair", desktopId: "a", mobileId: "b", arrangement: "overlap" }, "isoDrift"),
      ),
    ).toBe("Responsive pair · Isometric drift");
    expect(labels.shotSummary(shot({ kind: "title" }, "heroTilt"))).toBe("Title card");
  });

  it("names the Frames presets' shots after the presets (Frames plan D3, D4)", () => {
    const ids = ["a", "b", "c", "d"];
    const mobile = { kind: "columns" as const, assetIds: ids, columns: 3 as const, tilt: 0 };
    expect(
      labels.shotSummary(
        shot({ ...mobile, speed: 0.35, device: "card", travel: "period" }, "static"),
      ),
    ).toBe("Mobile frames · Static");
    // Phone Parade's tilted phones keep the layout's own name.
    expect(labels.shotSummary(shot({ ...mobile, tilt: 12, speed: 0.4 }, "static"))).toBe(
      "Phone columns · Static",
    );
    const desktop = {
      kind: "rows" as const,
      assetIds: ids,
      rows: 3 as const,
      device: "card" as const,
      tilt: 0,
      speed: 0.35,
    };
    expect(labels.shotSummary(shot({ ...desktop, travel: "period" }, "static"))).toBe(
      "Desktop frames · Static",
    );
    expect(labels.shotSummary(shot({ ...desktop, device: "browser", tilt: 8 }, "static"))).toBe(
      "Marquee rows · Static",
    );
  });

  it("builds select options in the given order", () => {
    expect(labels.optionsFor(labels.SHADOW_LABELS, ["soft", "none"])).toEqual([
      { value: "soft", label: "Soft" },
      { value: "none", label: "None" },
    ]);
  });
});
