import type { ProjectDoc } from "../doc/types";
import { buildTemplatePreviewDoc } from "./demo-preview";
import { sliderTemplate } from "./slider-template";

export const mobileStackTemplate = sliderTemplate({
  id: "mobile-stack",
  name: "Mobile Stack",
  description: "A deck of mobile screens. The front card slides away and the next moves forward.",
  role: "mobile",
  axis: "x",
  arrangement: "deck",
});

export function previewDoc(): ProjectDoc {
  return buildTemplatePreviewDoc(mobileStackTemplate);
}
