import type { AssetRef, Style } from "../doc/types";
import type { Template, TemplateBuildContext } from "./types";
import { fillSlots } from "./slots";
import { scrollStoryTemplate } from "./scroll-story";
import { mobileSliderTemplate } from "./mobile-slider";
import { desktopSliderTemplate } from "./desktop-slider";
import { framesTemplate } from "./frames";
import { mobileFramesTemplate } from "./mobile-frames";
import { desktopStackTemplate } from "./desktop-stack";
import { mobileStackTemplate } from "./mobile-stack";
import { desktopOrbitTemplate } from "./desktop-orbit";
import { mobileOrbitTemplate } from "./mobile-orbit";
import { desktopSiteTourTemplate } from "./desktop-site-tour";
import { mobileSiteTourTemplate } from "./mobile-site-tour";
import { mobileScrollStoryTemplate } from "./mobile-scroll-story";
import { responsiveScrollTemplate } from "./responsive-scroll";

/**
 * Gallery order (Frames plan D12, stack plan D5, orbit plan, presets round two D15): the Slider,
 * Frames, Stack, Orbit and Site Tour pairs, then the Scroll Story pair, each desktop first, then
 * Responsive Scroll. The first entry is also the first-run default and the gallery's initial
 * selection.
 */
export const BUILTIN_TEMPLATES: Template[] = [
  desktopSliderTemplate,
  mobileSliderTemplate,
  framesTemplate,
  mobileFramesTemplate,
  desktopStackTemplate,
  mobileStackTemplate,
  desktopOrbitTemplate,
  mobileOrbitTemplate,
  desktopSiteTourTemplate,
  mobileSiteTourTemplate,
  scrollStoryTemplate,
  mobileScrollStoryTemplate,
  responsiveScrollTemplate,
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
