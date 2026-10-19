import type { ProjectDoc } from "../doc/types";
import { buildTemplatePreviewDoc } from "./demo-preview";
import { sliderTemplate } from "./slider-template";

export const desktopStackTemplate = sliderTemplate({
  id: "desktop-stack",
  name: "Desktop Stack",
  description: "A deck of desktop screens. The front card lifts away and the next moves forward.",
  role: "desktop",
  axis: "y",
  arrangement: "deck",
});

export function previewDoc(): ProjectDoc {
  return buildTemplatePreviewDoc(desktopStackTemplate);
}
