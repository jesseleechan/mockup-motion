import { describe, expect, it } from "vitest";
import { layoutAssetIds } from "../src/doc/assets";
import type { Layout } from "../src/doc/types";
import { convertDocToUserTemplate, fillUserTemplateSlots } from "../src/storage/user-templates";
import { BUILTIN_TEMPLATES, buildTemplatePreviewDoc } from "../src/templates";

/** The layout with every demo asset id `demo-…` renamed `new-demo-…`. */
function renamed(layout: Layout): Layout {
  return JSON.parse(JSON.stringify(layout).replace(/"(demo-[^"]+)"/g, '"new-$1"'));
}

describe("User templates", () => {
  it("keep every screen's screenshot of every built-in template in another project", () => {
    for (const template of BUILTIN_TEMPLATES) {
      const doc = buildTemplatePreviewDoc(template);
      const saved = convertDocToUserTemplate(doc, template.name);
      // The same screenshots under new asset ids, as another project holds them.
      const assets = doc.assets.map((a) => ({ ...a, id: `new-${a.id}` }));
      const filled = fillUserTemplateSlots(saved, assets, doc.aspect);

      const oldIds = new Set(doc.assets.map((a) => a.id));
      const newIds = new Set(assets.map((a) => a.id));
      const savedIds = saved.shots.flatMap((shot) => layoutAssetIds(shot.layout));
      expect(
        savedIds.filter((id) => oldIds.has(id)),
        `${template.id} saves an asset id`,
      ).toEqual([]);
      const [shot] = filled.shots;
      const screens = layoutAssetIds(shot.layout);
      expect(screens.length, template.id).toBeGreaterThan(0);
      expect(
        screens.filter((id) => !newIds.has(id)),
        `${template.id} screens without one of the project's screenshots`,
      ).toEqual([]);
      expect(shot.layout, template.id).toEqual(renamed(doc.shots[0].layout));
    }
  });
});
