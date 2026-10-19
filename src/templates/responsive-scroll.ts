import type { Layout, ProjectDoc, ScrollSpec, Style } from "../doc/types";
import { defaultShot, defaultStyle } from "../doc/defaults";
import { fixedShotDuration } from "../motion/layouts/duration";
import type { Template, TemplateBuildContext } from "./types";
import { loopWrapCrossfade, presetToneStyle } from "./looks";
import { buildTemplatePreviewDoc } from "./demo-preview";

/**
 * Responsive Scroll (docs/responsive-scroll-plan): the desktop and mobile captures of one page
 * scroll together and stop on the same sections. Flat cards on Ash or Onyx, still camera.
 */
export const responsiveScrollTemplate: Template = {
  id: "responsive-scroll",
  name: "Responsive Scroll",
  description:
    "The desktop and mobile versions of one page scroll together and pause on the same sections.",
  category: "both",
  slots: [
    {
      key: "desktop1",
      role: "desktop",
      required: true,
      prefer: "tall",
      label: "Desktop full page",
    },
    { key: "mobile1", role: "mobile", required: true, prefer: "tall", label: "Mobile full page" },
  ],
  samePage: ["desktop1", "mobile1"],
  defaultDuration: 10,
  toneSwitch: true,
  build: (ctx: TemplateBuildContext) => {
    const desktop = ctx.slots.desktop1;
    const mobile = ctx.slots.mobile1;

    const style: Style = {
      ...defaultStyle(),
      ...ctx.style,
      ...presetToneStyle("light"),
      shadow: "none",
      // A flat fill cannot band, so it needs no grain (quality bar §5, §6).
      grain: 0,
      vignette: 0,
    };

    const layout: Layout = {
      kind: "responsive",
      desktopId: desktop?.id ?? "",
      mobileId: mobile?.id ?? "",
    };
    // Sections unset: the default stops (top plus three shared sections, quality bar §2.2).
    // Without section data both screens use these fractions of their page (decision D5).
    const scroll: ScrollSpec = {
      enabled: true,
      stops: [0, 1 / 3, 2 / 3, 1],
      hold: 1,
      easing: "smooth",
    };
    const shot = defaultShot(layout);
    shot.scroll = scroll;
    const assets = [desktop, mobile].filter((a) => a !== undefined);
    shot.duration =
      fixedShotDuration(layout, scroll, assets) ?? responsiveScrollTemplate.defaultDuration;
    // A scroll can't reverse, so the loop crossfades back to the top (contracts.md §5).
    shot.transitionIn = loopWrapCrossfade();
    shot.camera = { preset: "static", intensity: 0, easing: "smooth", float: 0 };

    return { style, shots: [shot], loop: true };
  },
};

export function previewDoc(): ProjectDoc {
  return buildTemplatePreviewDoc(responsiveScrollTemplate);
}
