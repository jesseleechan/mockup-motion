import { describe, expect, it } from "vitest";
import type { Aspect, AssetRef, ProjectDoc } from "../src/doc/types";
import { createDoc } from "../src/doc/defaults";
import { aspectRatioValue } from "../src/motion/camera";
import { type LayoutNode, resolveLayout } from "../src/motion/layouts";
import { schedule } from "../src/motion/timeline";
import {
  buildTemplate,
  buildTemplatePreviewDoc,
  framesTemplate,
  mobileFramesTemplate,
} from "../src/templates";
import type { Template } from "../src/templates/types";

// Frames follow-up from the PF04 review: odd lanes show the screenshots in reverse order, so
// neighbouring lanes, which move in opposite directions, cross one card at a time instead of
// lining up as two copies of one lane twice per loop (quality-bar §4).
const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];
const COUNTS = [4, 5, 6];
// The 30 fps the exports render at.
const RATE = 30;
// The gallery poster is the frame at 35% of the loop (scripts/template-previews.ts).
const POSTER_FRACTION = 0.35;
// The demo sites whose mobile hero is a photograph rather than type on a flat fill.
const PHOTOGRAPHIC_HEROES = ["demo-aurelia-mobile-hero", "demo-maison-oak-mobile-hero"];

const screenshot = (role: "desktop" | "mobile", n: number): AssetRef => ({
  id: `${role[0]}${n}`,
  kind: "image",
  name: `${role} ${n}`,
  mime: "image/png",
  bytes: 100,
  width: role === "desktop" ? 1440 : 1170,
  height: role === "desktop" ? 900 : 2532,
  role,
});

interface Preset {
  name: string;
  template: Template;
  role: "desktop" | "mobile";
  axis: "x" | "y";
}

const PRESETS: Preset[] = [
  { name: "Desktop Frames", template: framesTemplate, role: "desktop", axis: "x" },
  { name: "Mobile Frames", template: mobileFramesTemplate, role: "mobile", axis: "y" },
];

function presetDoc(preset: Preset, aspect: Aspect, count: number): ProjectDoc {
  const assets = Array.from({ length: count }, (_, i) => screenshot(preset.role, i + 1));
  const built = buildTemplate(preset.template, { aspect, assets, name: preset.name });
  return { ...createDoc(), aspect, assets, ...built, templateId: preset.template.id };
}

const nodesAt = (doc: ProjectDoc, t: number) => {
  const shot = doc.shots[0];
  return resolveLayout(shot.layout, doc.aspect, doc.assets, t, shot.duration, shot.entrance);
};
const laneOf = (node: LayoutNode) => Number(node.id.match(/^(?:row|col)(\d+):/)![1]);
const along = (axis: Preset["axis"], node: LayoutNode) =>
  axis === "x" ? node.transform.x : node.transform.y;
const length = (axis: Preset["axis"], node: LayoutNode) =>
  axis === "x" ? node.width : node.height;
// A lane's window is the frame along the lane: a card is in view while any of it is.
const inView = (axis: Preset["axis"], aspect: Aspect, node: LayoutNode) =>
  Math.abs(along(axis, node)) - length(axis, node) / 2 <
  (axis === "x" ? aspectRatioValue(aspect) : 1) / 2;
const samples = (total: number) =>
  Array.from({ length: Math.round(total * RATE) + 1 }, (_, i) => i / RATE);

interface FacingPair {
  position: number;
  same: boolean;
}

/**
 * The cards in view of lane r and lane r + 1 that face each other: they overlap by more than
 * half a card along the lane. A card faces at most one card, because the pitch is longer than a
 * card.
 */
function facingPairs(preset: Preset, doc: ProjectDoc, t: number, lane: number): FacingPair[] {
  const visible = nodesAt(doc, t).filter((node) => inView(preset.axis, doc.aspect, node));
  const pairs: FacingPair[] = [];
  for (const a of visible.filter((node) => laneOf(node) === lane)) {
    for (const b of visible.filter((node) => laneOf(node) === lane + 1)) {
      const distance = Math.abs(along(preset.axis, a) - along(preset.axis, b));
      if (distance < length(preset.axis, a) / 2) {
        pairs.push({ position: along(preset.axis, a), same: a.assetId === b.assetId });
      }
    }
  }
  return pairs.sort((p, q) => p.position - q.position);
}

function forEachMoment(
  check: (preset: Preset, doc: ProjectDoc, t: number, lane: number, label: string) => void,
) {
  for (const preset of PRESETS) {
    for (const aspect of ASPECTS) {
      for (const count of COUNTS) {
        const doc = presetDoc(preset, aspect, count);
        const lanes = new Set(nodesAt(doc, 0).map(laneOf)).size;
        for (const t of samples(doc.shots[0].duration)) {
          for (let lane = 0; lane + 1 < lanes; lane++) {
            const label = `${preset.name} ${aspect} N=${count} t=${t.toFixed(3)} lanes ${lane}/${lane + 1}`;
            check(preset, doc, t, lane, label);
          }
        }
      }
    }
  }
}

describe("Frames lane order (PF04 review follow-up)", () => {
  it("shows different screenshots in neighbouring lanes as they pass each other", () => {
    // Before the change, every facing pair in view matched while neighbouring lanes passed.
    const failures: string[] = [];
    forEachMoment((preset, doc, t, lane, label) => {
      const pairs = facingPairs(preset, doc, t, lane);
      if (pairs.length >= 2 && pairs.every((pair) => pair.same)) failures.push(label);
    });
    expect(failures.slice(0, 10), `${failures.length} whole-lane matches`).toEqual([]);
  });

  it("crosses neighbouring lanes one card at a time: facing pairs side by side never both match", () => {
    const failures: string[] = [];
    forEachMoment((preset, doc, t, lane, label) => {
      const pairs = facingPairs(preset, doc, t, lane);
      pairs.slice(1).forEach((pair, i) => {
        if (pair.same && pairs[i].same) failures.push(`${label} at ${pair.position.toFixed(3)}`);
      });
    });
    expect(failures.slice(0, 10), `${failures.length} side-by-side matches`).toEqual([]);
  });

  it("reverses the screenshot order on odd lanes and keeps it on even lanes", () => {
    for (const preset of PRESETS) {
      for (const aspect of ASPECTS) {
        const doc = presetDoc(preset, aspect, 5);
        const nodes = nodesAt(doc, 0);
        const lanes = new Set(nodes.map(laneOf));
        for (const lane of lanes) {
          const indices = nodes
            .filter((node) => laneOf(node) === lane)
            .sort((a, b) => along(preset.axis, a) - along(preset.axis, b))
            .map((node) => Number(node.assetId!.slice(1)) - 1);
          // Along +x or +y, consecutive cards step through the 5 screenshots by +1 on even
          // lanes and by -1 (4) on odd ones.
          const steps = new Set(indices.slice(1).map((v, i) => (v - indices[i] + 5) % 5));
          expect([...steps], `${preset.name} ${aspect} lane ${lane}`).toEqual([
            lane % 2 === 0 ? 1 : 4,
          ]);
        }
      }
    }
  });
});

describe("Mobile Frames gallery poster (PF04 review follow-up)", () => {
  const doc = buildTemplatePreviewDoc(mobileFramesTemplate, "16:9");
  const poster = POSTER_FRACTION * schedule(doc).total;
  const visible = nodesAt(doc, poster).filter((node) => inView("y", doc.aspect, node));

  it("shows each demo site in at most two columns", () => {
    const columns = new Map<string, Set<number>>();
    for (const node of visible) {
      columns.set(node.assetId!, (columns.get(node.assetId!) ?? new Set()).add(laneOf(node)));
    }
    const spread = Object.fromEntries([...columns].map(([id, lanes]) => [id, lanes.size]));
    expect(Math.max(...Object.values(spread)), JSON.stringify(spread)).toBeLessThanOrEqual(2);
  });

  it("keeps a photographic hero fully in view", () => {
    const whole = visible.filter(
      (node) =>
        Math.abs(node.transform.y) + node.height / 2 <= 0.5 &&
        PHOTOGRAPHIC_HEROES.includes(node.assetId!),
    );
    expect(whole.length).toBeGreaterThan(0);
  });
});
