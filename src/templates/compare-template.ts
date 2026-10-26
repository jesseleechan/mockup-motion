import type { AssetRole, Layout, Style } from "../doc/types";
import { defaultShot, defaultStyle } from "../doc/defaults";
import { COMPARE_LOOP, compareDuration } from "../motion";
import type { SlotSpec, Template, TemplateBuildContext } from "./types";
import { loopWrapCrossfade, presetToneStyle } from "./looks";

type CompareLayout = Extract<Layout, { kind: "compare" }>;

interface CompareTemplateSpec {
  id: string;
  name: string;
  description: string;
  role: Extract<AssetRole, "mobile" | "desktop">;
}

/**
 * Desktop Before & After and Mobile Before & After (presets round two, D6–D8): an old and a new
 * design of one page in a browser or a phone. The new design sweeps across the old one, then
 * holds, and the loop crossfades back to the old one.
 */
export function compareTemplate(spec: CompareTemplateSpec): Template {
  // D8: two screenshots of one size; the first in Library order is the old design.
  const before: SlotSpec = {
    key: `${spec.role}1`,
    role: spec.role,
    required: true,
    prefer: "any",
    label: `Old ${spec.role} design`,
  };
  const after: SlotSpec = {
    key: `${spec.role}2`,
    role: spec.role,
    required: true,
    prefer: "any",
    label: `New ${spec.role} design`,
  };

  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    category: spec.role,
    slots: [before, after],
    // The loop the video lasts: the shot's 6.8 s less the wrap crossfade it overlaps.
    defaultDuration: COMPARE_LOOP,
    // Comparing a screenshot with itself shows nothing, so a missing one stays missing.
    distinct: true,
    build: (ctx: TemplateBuildContext) => {
      // Scroll Story's device look (soft shadow, standard chrome) on the flat Ash fill.
      const style: Style = {
        ...defaultStyle(),
        ...ctx.style,
        ...presetToneStyle("light"),
        shadow: "soft",
        browserChrome: "standard",
        // A flat fill cannot band, so it needs no grain (quality bar §5, §6).
        grain: 0,
        vignette: 0,
      };

      const layout: CompareLayout = {
        kind: "compare",
        device: spec.role === "mobile" ? "phone" : "browser",
        beforeId: ctx.slots[before.key]?.id ?? "",
        afterId: ctx.slots[after.key]?.id ?? "",
      };
      const shot = defaultShot(layout);
      shot.duration = compareDuration(COMPARE_LOOP);
      // The sweep never reverses, so the loop crossfades back to the old design (contracts §5).
      shot.transitionIn = loopWrapCrossfade();
      shot.camera = { preset: "static", intensity: 0, easing: "smooth" };

      return { style, shots: [shot], loop: true };
    },
  };
}
