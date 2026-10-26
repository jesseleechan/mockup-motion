import type { ProjectDoc } from "../doc/types";
import { compareTemplate } from "./compare-template";
import { buildTemplatePreviewDoc } from "./demo-preview";

export const desktopBeforeAfterTemplate = compareTemplate({
  id: "desktop-before-after",
  name: "Desktop Before & After",
  description: "The new design sweeps across the old one, then holds.",
  role: "desktop",
});

export function previewDoc(): ProjectDoc {
  return buildTemplatePreviewDoc(desktopBeforeAfterTemplate);
}
