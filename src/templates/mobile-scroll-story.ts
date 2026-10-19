import type { ProjectDoc } from "../doc/types";
import { buildTemplatePreviewDoc } from "./demo-preview";
import { scrollStoryTemplate } from "./scroll-story-template";

export const mobileScrollStoryTemplate = scrollStoryTemplate({
  id: "mobile-scroll-story",
  name: "Mobile Scroll Story",
  description:
    "Reads the entire mobile page section by section on a phone, with smooth scrolling and comfortable pauses.",
  role: "mobile",
  label: "Full page mobile screenshot",
});

export function previewDoc(): ProjectDoc {
  return buildTemplatePreviewDoc(mobileScrollStoryTemplate);
}
