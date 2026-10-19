import type { ProjectDoc } from "../doc/types";
import { buildTemplatePreviewDoc } from "./demo-preview";
import { scrollStoryTemplate as scrollStory } from "./scroll-story-template";

export const scrollStoryTemplate = scrollStory({
  id: "scroll-story",
  name: "Desktop Scroll Story",
  description:
    "Reads the entire webpage section by section with smooth scrolling and comfortable pauses.",
  role: "desktop",
  label: "Full page screenshot",
});

export function previewDoc(): ProjectDoc {
  return buildTemplatePreviewDoc(scrollStoryTemplate);
}
