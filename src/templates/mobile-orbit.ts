import type { ProjectDoc } from "../doc/types";
import { buildTemplatePreviewDoc } from "./demo-preview";
import { orbitTemplate } from "./orbit-template";

export const mobileOrbitTemplate = orbitTemplate({
  id: "mobile-orbit",
  name: "Mobile Orbit",
  description: "Mobile screens on a ring that turns the next one to the front.",
  role: "mobile",
});

export function previewDoc(): ProjectDoc {
  return buildTemplatePreviewDoc(mobileOrbitTemplate);
}
