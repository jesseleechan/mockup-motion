import type { ProjectDoc } from "../doc/types";
import { buildTemplatePreviewDoc } from "./demo-preview";
import { sliderTemplate } from "./slider-template";

export const desktopSliderTemplate = sliderTemplate({
  id: "desktop-slider",
  name: "Desktop Slider",
  description: "A vertical carousel of desktop screens that steps up from one to the next.",
  category: "portfolio",
  role: "desktop",
  axis: "y",
});

export function previewDoc(): ProjectDoc {
  return buildTemplatePreviewDoc(desktopSliderTemplate);
}
