import type { ProjectDoc } from "../doc/types";
import { buildTemplatePreviewDoc } from "./demo-preview";
import { pageColumnsTemplate } from "./page-columns-template";

export const desktopPageColumnsTemplate = pageColumnsTemplate({
  id: "desktop-page-columns",
  name: "Desktop Page Columns",
  description: "Full pages side by side, drifting slowly through their whole length.",
  role: "desktop",
  defaultDuration: 12,
});

export function previewDoc(): ProjectDoc {
  return buildTemplatePreviewDoc(desktopPageColumnsTemplate);
}
