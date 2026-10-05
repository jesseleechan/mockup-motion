import { describe, it, expect } from "vitest";
import {
  imageRect,
  outputDimensions,
  motionProgress,
  contentProgress,
  canScroll,
} from "../src/rendering/geometry";
import { applyPreset, createProject, PRESETS } from "../src/presets/presets";
import { commit, undo, redo, type History } from "../src/editor/history";
import type { UploadedImage } from "../src/types";

const image: UploadedImage = {
  id: "website",
  name: "Long website.png",
  url: "",
  width: 1200,
  height: 6000,
  aspectRatio: 0.2,
  category: "desktop",
};

describe("geometry and output dimensions", () => {
  it("all output sizes use even dimensions and preserve the selected ratio", () => {
    for (const resolution of [720, 1080]) {
      for (const ratio of ["16:9", "9:16", "1:1", "4:5"] as const) {
        const { width, height } = outputDimensions(ratio, resolution);
        const [rw, rh] = ratio.split(":").map(Number);
        expect(width % 2).toBe(0);
        expect(height % 2).toBe(0);
        expect(Math.abs(width / height - rw / rh)).toBeLessThan(0.001);
      }
    }
  });

  it("cover fills short phone screenshots and clamps tall screenshot travel", () => {
    const short = imageRect(1600, 900, 320, 680, "cover", 0);
    expect(short.width).toBeGreaterThanOrEqual(320);
    expect(short.height).toBeGreaterThanOrEqual(680);
    const top = imageRect(1200, 6000, 600, 375, "cover", -2);
    const bottom = imageRect(1200, 6000, 600, 375, "cover", 2);
    expect(top.y === 0).toBe(true);
    expect(bottom.y + bottom.height).toBe(375);
    expect(bottom.width).toBe(600);
  });

  it("contain preserves the whole image and centers without changing its proportions", () => {
    const r = imageRect(1600, 900, 320, 680, "contain", 1);
    expect(r.width).toBe(320);
    expect(r.height).toBe(180);
    expect(r.y).toBe(250);
  });
});

describe("presets and composition", () => {
  it("every built-in preset keeps screenshot content still", () => {
    expect(PRESETS.length).toBe(8);
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(8);
    for (const p of PRESETS) {
      expect(p.composition.contentMotion.enabled).toBe(false);
    }
  });

  it("preset application preserves assets, assignments and output settings", () => {
    const project = createProject();
    project.images = [image];
    project.aspectRatio = "9:16";
    project.composition.assetIds.primary = image.id;
    project.exportSettings.fps = 60;
    const next = applyPreset(project, PRESETS[2]);
    expect(next.images).toBe(project.images);
    expect(next.aspectRatio).toBe("9:16");
    expect(next.composition.assetIds.primary).toBe(image.id);
    expect(next.exportSettings.fps).toBe(60);
    next.composition.motion.amount = 71;
    expect(PRESETS[2].composition.motion.amount).not.toBe(71);
  });

  it("loop transforms and scrolling return to the exact first pose at every duration", () => {
    for (const p of PRESETS) {
      const c = structuredClone(p.composition);
      c.contentMotion.enabled = true;
      expect(motionProgress(0, c)).toBe(motionProgress(c.motion.duration, c));
      expect(contentProgress(0, c)).toBe(contentProgress(c.motion.duration, c));
      expect(motionProgress(c.motion.duration / 2, c)).toBeGreaterThan(0);
    }
  });

  it("internal scrolling is available only for tall images in a single filled frame", () => {
    const c = createProject().composition;
    expect(canScroll(c, [image])).toBe(true);
    c.layout = "rows";
    expect(canScroll(c, [image])).toBe(false);
    c.layout = "hero";
    c.image.fit = "contain";
    expect(canScroll(c, [image])).toBe(false);
    c.image.fit = "cover";
    expect(canScroll(c, [{ ...image, aspectRatio: 1.8 }])).toBe(false);
    expect(canScroll(c, [])).toBe(false);
  });

  it("non-looping motion ends at its final pose and has bounded holds", () => {
    const c = createProject().composition;
    c.motion.loop = false;
    c.motion.hold = 1;
    expect(motionProgress(0, c)).toBe(0);
    expect(motionProgress(1, c)).toBe(0);
    expect(motionProgress(5, c)).toBe(1);
    expect(motionProgress(6, c)).toBe(1);
  });
});

describe("history undo and redo", () => {
  it("undo and redo restore documents, and new edits invalidate the redo branch", () => {
    let h: History<string> = { past: [], present: "original", future: [] };
    h = commit(h, "preset");
    h = commit(h, "adjustment");
    h = undo(h);
    expect(h.present).toBe("preset");
    h = redo(h);
    expect(h.present).toBe("adjustment");
    h = undo(h);
    h = commit(h, "different adjustment");
    expect(h.future).toEqual([]);
    expect(redo(h).present).toBe("different adjustment");
    expect(undo(h).present).toBe("preset");
  });

  it("history retains a bounded set of documents and ignores identical references", () => {
    let h: History<number> = { past: [], present: 0, future: [] };
    expect(commit(h, 0)).toBe(h);
    for (let n = 1; n <= 80; n++) h = commit(h, n);
    expect(h.past.length).toBe(60);
    expect(h.present).toBe(80);
  });
});
