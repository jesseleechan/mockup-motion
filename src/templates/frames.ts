import type { ProjectDoc } from "../doc/types";
import { buildTemplatePreviewDoc } from "./demo-preview";
import { framesTemplate as framesTemplateFor } from "./frames-template";

export { framesLayout } from "./frames-template";

// The id stays `frames`, so saved projects, the gallery preview files and the frames-* baselines
// keep working; only the card text says "Desktop Frames" (Frames plan D4).
export const framesTemplate = framesTemplateFor({
  id: "frames",
  name: "Desktop Frames",
  description: "Rows of desktop screens that glide past in alternating directions.",
  category: "portfolio",
  role: "desktop",
});

export function previewDoc(): ProjectDoc {
  return buildTemplatePreviewDoc(framesTemplate);
}
