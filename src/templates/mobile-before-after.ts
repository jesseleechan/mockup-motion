import type { ProjectDoc } from "../doc/types";
import { compareTemplate } from "./compare-template";
import { buildTemplatePreviewDoc } from "./demo-preview";

export const mobileBeforeAfterTemplate = compareTemplate({
  id: "mobile-before-after",
  name: "Mobile Before & After",
  description: "The new design sweeps across the old one, then holds.",
  role: "mobile",
});

export function previewDoc(): ProjectDoc {
  return buildTemplatePreviewDoc(mobileBeforeAfterTemplate);
}
