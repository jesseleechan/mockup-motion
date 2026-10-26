import type { ProjectDoc } from "../doc/types";
import { buildTemplatePreviewDoc } from "./demo-preview";
import { tourTemplate } from "./tour-template";

export const mobileSiteTourTemplate = tourTemplate({
  id: "mobile-site-tour",
  name: "Mobile Site Tour",
  description: "Pages of one site on a phone. Every step slides in the next page.",
  role: "mobile",
});

export function previewDoc(): ProjectDoc {
  return buildTemplatePreviewDoc(mobileSiteTourTemplate);
}
