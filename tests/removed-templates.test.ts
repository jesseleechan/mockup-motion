import { describe, expect, it } from "vitest";
import type { Aspect, ProjectDoc } from "../src/doc/types";
import { sanitizeDoc } from "../src/doc/validate";
import {
  currentTemplate,
  demoContentTemplate,
  unfilledSlots,
} from "../src/editor/template-actions";
import { layoutFixture } from "../src/lab/layout-fixtures";
import { evaluate } from "../src/motion/evaluate";
import { schedule } from "../src/motion/timeline";
import { BUILTIN_TEMPLATES } from "../src/templates";

/**
 * Phone Parade, Portfolio Rows and Isometric Wall were removed (Frames plan PF01), but saved
 * projects still name them. Their layouts stay in the engine, so those projects keep opening,
 * rendering and exporting. Each lab fixture is that template's document, built the same way.
 */
const REMOVED: { templateId: string; fixture: string; kind: string }[] = [
  { templateId: "phone-parade", fixture: "columns-phone-tilted", kind: "columns" },
  { templateId: "portfolio-rows", fixture: "rows-browser-tilted", kind: "rows" },
  { templateId: "isometric-wall", fixture: "wall-isometric", kind: "wall" },
];
const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];

/** The document as IndexedDB returned it: plain JSON naming the removed template. */
function savedDoc(templateId: string, fixture: string, aspect: Aspect): ProjectDoc {
  const doc: ProjectDoc = { ...layoutFixture(fixture, aspect), templateId };
  return JSON.parse(JSON.stringify(doc)) as ProjectDoc;
}

describe("PF01: saved projects of removed templates", () => {
  it("no built-in template has a removed id", () => {
    for (const { templateId } of REMOVED) {
      expect(BUILTIN_TEMPLATES.map((t) => t.id)).not.toContain(templateId);
    }
  });

  // The composition each template chose per aspect: rows 3 and columns 2 at 9:16 and 4:5.
  it("each fixture keeps its template's composition at every aspect", () => {
    for (const aspect of ASPECTS) {
      const portrait = aspect === "9:16" || aspect === "4:5";
      const rows = layoutFixture("rows-browser-tilted", aspect).shots[0].layout;
      const columns = layoutFixture("columns-phone-tilted", aspect).shots[0].layout;
      const wall = layoutFixture("wall-isometric", aspect).shots[0].layout;
      expect(rows, aspect).toMatchObject({ kind: "rows", rows: portrait ? 3 : 2, tilt: 8 });
      expect(columns, aspect).toMatchObject({
        kind: "columns",
        columns: portrait ? 2 : 3,
        tilt: 12,
      });
      expect(wall, aspect).toMatchObject({ kind: "wall", columns: 4 });
    }
  });

  for (const { templateId, fixture, kind } of REMOVED) {
    for (const aspect of ASPECTS) {
      it(`${templateId} at ${aspect} sanitizes cleanly and shows an asset on every screen`, () => {
        const { doc, warnings } = sanitizeDoc(savedDoc(templateId, fixture, aspect));
        expect(warnings).toEqual([]);
        expect(doc.templateId).toBe(templateId);
        expect(doc.shots).toHaveLength(1);
        expect(doc.shots[0].layout.kind).toBe(kind);

        const assetIds = new Set(doc.assets.map((asset) => asset.id));
        const { total } = schedule(doc);
        expect(total).toBeGreaterThan(0);
        for (const t of [0, total]) {
          const layers = evaluate(doc, t).layers;
          expect(layers.length, `layers at t = ${t}`).toBeGreaterThanOrEqual(1);
          for (const layer of layers) {
            expect(layer.frame.nodes.length, `screens at t = ${t}`).toBeGreaterThan(3);
            for (const node of layer.frame.nodes) {
              expect(assetIds.has(node.assetId ?? ""), `${node.id} at t = ${t}`).toBe(true);
            }
          }
        }
      });
    }

    it(`${templateId} has no template, so the gallery and demo content start on the first one`, () => {
      const doc = sanitizeDoc(savedDoc(templateId, fixture, "16:9")).doc;
      // TemplateGalleryModal selects currentTemplate(doc) ?? BUILTIN_TEMPLATES[0].
      expect(currentTemplate(doc)).toBeUndefined();
      expect(demoContentTemplate(doc)).toBe(BUILTIN_TEMPLATES[0]);
      // No fill overlay asks for screenshots of a template that no longer exists.
      expect(unfilledSlots(doc)).toEqual([]);
    });
  }
});
