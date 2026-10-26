import type { ProjectDoc } from "../doc/types";
import { buildTemplatePreviewDoc } from "./demo-preview";
import { tourTemplate } from "./tour-template";

export const desktopSiteTourTemplate = tourTemplate({
  id: "desktop-site-tour",
  name: "Desktop Site Tour",
  description: "Pages of one site in a browser. Every step slides in the next page.",
  role: "desktop",
});

export function previewDoc(): ProjectDoc {
  return buildTemplatePreviewDoc(desktopSiteTourTemplate);
}
