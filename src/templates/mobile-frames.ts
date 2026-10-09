import type { ProjectDoc } from "../doc/types";
import { buildTemplatePreviewDoc } from "./demo-preview";
import { framesTemplate } from "./frames-template";

export { mobileFramesLayout } from "./frames-template";

/** Desktop Frames turned 90°: columns of portrait cards (Frames plan D3, quality bar §4). */
export const mobileFramesTemplate = framesTemplate({
  id: "mobile-frames",
  name: "Mobile Frames",
  description: "Columns of mobile screens that glide up and down in alternating directions.",
  role: "mobile",
});

export function previewDoc(): ProjectDoc {
  return buildTemplatePreviewDoc(mobileFramesTemplate);
}
