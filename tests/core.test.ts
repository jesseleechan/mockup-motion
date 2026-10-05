import test from "node:test";
import assert from "node:assert/strict";
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
test("all output sizes use even dimensions and preserve the selected ratio", () => {
  for (const resolution of [720, 1080])
    for (const ratio of ["16:9", "9:16", "1:1", "4:5"] as const) {
      const { width, height } = outputDimensions(ratio, resolution);
      const [rw, rh] = ratio.split(":").map(Number);
      assert.equal(width % 2, 0);
      assert.equal(height % 2, 0);
      assert.ok(Math.abs(width / height - rw / rh) < 0.001);
    }
});
test("cover fills short phone screenshots and clamps tall screenshot travel", () => {
  const short = imageRect(1600, 900, 320, 680, "cover", 0);
  assert.ok(short.width >= 320);
  assert.ok(short.height >= 680);
  const top = imageRect(1200, 6000, 600, 375, "cover", -2),
    bottom = imageRect(1200, 6000, 600, 375, "cover", 2);
  assert.ok(top.y === 0);
  assert.equal(bottom.y + bottom.height, 375);
  assert.equal(bottom.width, 600);
});
test("contain preserves the whole image and centers without changing its proportions", () => {
  const r = imageRect(1600, 900, 320, 680, "contain", 1);
  assert.equal(r.width, 320);
  assert.equal(r.height, 180);
  assert.equal(r.y, 250);
});
test("every built-in preset keeps screenshot content still", () => {
  assert.equal(PRESETS.length, 8);
  assert.equal(new Set(PRESETS.map((p) => p.id)).size, 8);
  for (const p of PRESETS)
    assert.equal(p.composition.contentMotion.enabled, false);
});
test("preset application preserves assets, assignments and output settings", () => {
  const project = createProject();
  project.images = [image];
  project.aspectRatio = "9:16";
  project.composition.assetIds.primary = image.id;
  project.exportSettings.fps = 60;
  const next = applyPreset(project, PRESETS[2]);
  assert.equal(next.images, project.images);
  assert.equal(next.aspectRatio, "9:16");
  assert.equal(next.composition.assetIds.primary, image.id);
  assert.equal(next.exportSettings.fps, 60);
  next.composition.motion.amount = 71;
  assert.notEqual(PRESETS[2].composition.motion.amount, 71);
});
test("loop transforms and scrolling return to the exact first pose at every duration", () => {
  for (const p of PRESETS) {
    const c = structuredClone(p.composition);
    c.contentMotion.enabled = true;
    assert.equal(motionProgress(0, c), motionProgress(c.motion.duration, c));
    assert.equal(contentProgress(0, c), contentProgress(c.motion.duration, c));
    assert.ok(motionProgress(c.motion.duration / 2, c) > 0);
  }
});
test("internal scrolling is available only for tall images in a single filled frame", () => {
  const c = createProject().composition;
  assert.equal(canScroll(c, [image]), true);
  c.layout = "rows";
  assert.equal(canScroll(c, [image]), false);
  c.layout = "hero";
  c.image.fit = "contain";
  assert.equal(canScroll(c, [image]), false);
  c.image.fit = "cover";
  assert.equal(canScroll(c, [{ ...image, aspectRatio: 1.8 }]), false);
  assert.equal(canScroll(c, []), false);
});
test("non-looping motion ends at its final pose and has bounded holds", () => {
  const c = createProject().composition;
  c.motion.loop = false;
  c.motion.hold = 1;
  assert.equal(motionProgress(0, c), 0);
  assert.equal(motionProgress(1, c), 0);
  assert.equal(motionProgress(5, c), 1);
  assert.equal(motionProgress(6, c), 1);
});
test("undo and redo restore documents, and new edits invalidate the redo branch", () => {
  let h: History<string> = { past: [], present: "original", future: [] };
  h = commit(h, "preset");
  h = commit(h, "adjustment");
  h = undo(h);
  assert.equal(h.present, "preset");
  h = redo(h);
  assert.equal(h.present, "adjustment");
  h = undo(h);
  h = commit(h, "different adjustment");
  assert.deepEqual(h.future, []);
  assert.equal(redo(h).present, "different adjustment");
  assert.equal(undo(h).present, "preset");
});
test("history retains a bounded set of documents and ignores identical references", () => {
  let h: History<number> = { past: [], present: 0, future: [] };
  assert.equal(commit(h, 0), h);
  for (let n = 1; n <= 80; n++) h = commit(h, n);
  assert.equal(h.past.length, 60);
  assert.equal(h.present, 80);
});
