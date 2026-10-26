import type { ProjectDoc } from "../doc/types";
import { buildTemplatePreviewDoc } from "./demo-preview";
import { pageColumnsTemplate } from "./page-columns-template";

export const mobilePageColumnsTemplate = pageColumnsTemplate({
  id: "mobile-page-columns",
  name: "Mobile Page Columns",
  description: "Full pages side by side, drifting slowly through their whole length.",
  role: "mobile",
  defaultDuration: 13.5,
});

export function previewDoc(): ProjectDoc {
  return buildTemplatePreviewDoc(mobilePageColumnsTemplate);
}
