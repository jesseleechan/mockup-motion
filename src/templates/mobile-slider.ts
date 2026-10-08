import type { ProjectDoc } from "../doc/types";
import { buildTemplatePreviewDoc } from "./demo-preview";
import { sliderTemplate } from "./slider-template";

export const mobileSliderTemplate = sliderTemplate({
  id: "mobile-slider",
  name: "Mobile Slider",
  description: "A horizontal carousel of mobile screens that steps from one to the next.",
  category: "mobile",
  role: "mobile",
  axis: "x",
});

export function previewDoc(): ProjectDoc {
  return buildTemplatePreviewDoc(mobileSliderTemplate);
}
