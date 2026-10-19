import type { ProjectDoc } from "../doc/types";
import { buildTemplatePreviewDoc } from "./demo-preview";
import { orbitTemplate } from "./orbit-template";

export const desktopOrbitTemplate = orbitTemplate({
  id: "desktop-orbit",
  name: "Desktop Orbit",
  description: "Desktop screens on a ring that turns the next one to the front.",
  role: "desktop",
});

export function previewDoc(): ProjectDoc {
  return buildTemplatePreviewDoc(desktopOrbitTemplate);
}
