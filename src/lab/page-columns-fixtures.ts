import type { Aspect, ProjectDoc } from "../doc/types";
import { sanitizeDoc } from "../doc/validate";
import {
  buildTemplatePreviewDoc,
  desktopPageColumnsTemplate,
  mobilePageColumnsTemplate,
} from "../templates";
import { demoAssetId, demoAssetRef } from "./demo-assets";

const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];

/**
 * Page Columns' lab fixtures (docs/presets-2-plan, T3). The column count and the loop length
 * depend on the aspect, so each preset has a fixture per aspect, built as the editor builds it:
 * /lab?fixture=mobile-page-columns-4x5&aspect=4:5. The `desktop-page-columns` and
 * `mobile-page-columns` fixtures (LabPage registers every template) are built at 16:9.
 *
 * `page-columns-short`: Desktop Page Columns with Northwind's hero in the middle column. A page
 * shorter than its column shows whole on a shorter card and stays still (quality bar §4).
 */
function pageColumnsFixtures(): Record<string, ProjectDoc> {
  const out: Record<string, ProjectDoc> = {};
  for (const aspect of ASPECTS) {
    const tag = aspect.replace(":", "x");
    for (const template of [desktopPageColumnsTemplate, mobilePageColumnsTemplate]) {
      out[`${template.id}-${tag}`] = buildTemplatePreviewDoc(template, aspect);
    }
  }

  const preview = buildTemplatePreviewDoc(desktopPageColumnsTemplate, "16:9");
  const hero = demoAssetRef(demoAssetId("northwind", "desktop", "hero"));
  const full = (site: "aurelia" | "maison-oak") => demoAssetId(site, "desktop", "full");
  const [shot] = preview.shots;
  const short: ProjectDoc = {
    ...preview,
    name: "Page Columns (short page)",
    assets: [...preview.assets, hero],
    shots: [
      {
        ...shot,
        layout: {
          kind: "pageColumns",
          assetIds: [full("aurelia"), hero.id, full("maison-oak")],
          shape: "desktop",
        },
      },
    ],
  };
  // Sets the shot length from its pages, as the editor does.
  out["page-columns-short"] = sanitizeDoc(short).doc;
  return out;
}

export const PAGE_COLUMNS_FIXTURES: Record<string, ProjectDoc> = pageColumnsFixtures();
