import type { AssetRef, Style } from "../doc/types";
import type { Template, TemplateBuildContext } from "./types";
import { fillSlots } from "./slots";
import { phoneParadeTemplate } from "./phone-parade";
import { portfolioRowsTemplate } from "./portfolio-rows";
import { isometricWallTemplate } from "./isometric-wall";
import { scrollStoryTemplate } from "./scroll-story";
import { mobileSliderTemplate } from "./mobile-slider";
import { desktopSliderTemplate } from "./desktop-slider";
import { framesTemplate } from "./frames";

/**
 * Gallery order. The presets lead (presets plan D1), and the first entry is also the first-run
 * default and the gallery's initial selection.
 */
export const BUILTIN_TEMPLATES: Template[] = [
  desktopSliderTemplate,
  mobileSliderTemplate,
  framesTemplate,
  phoneParadeTemplate,
  portfolioRowsTemplate,
  isometricWallTemplate,
  scrollStoryTemplate,
];

export function getTemplateById(id: string): Template | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.id === id);
}

/**
 * Builds the template output using the document's available assets and configuration.
 */
export function buildTemplate(
  t: Template,
  doc: {
    aspect: TemplateBuildContext["aspect"];
    assets: AssetRef[];
    name: string;
    style?: Style;
  },
) {
  const slots = fillSlots(t, doc.assets);
  return t.build({
    aspect: doc.aspect,
    slots,
    projectName: doc.name,
    style: doc.style,
  });
}
