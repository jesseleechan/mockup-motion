import type { AssetRole, Layout, Style } from "../doc/types";
import { defaultShot, defaultStyle } from "../doc/defaults";
import { sliderDuration } from "../motion";
import type { SlotSpec, Template, TemplateBuildContext } from "./types";
import { presetToneStyle } from "./looks";

type TourLayout = Extract<Layout, { kind: "tour" }>;

// Quality bar §2.2: the slider's 2.0 s per page.
const TOUR_STEP = 2;
// Presets round two, D5: 3–6 pages of one size, the first 3 required.
const REQUIRED_SLOTS = 3;
const SLOT_COUNT = 6;
// The gallery badge: the four demo pages its preview and demo content use.
const DEMO_PAGES = 4;

interface TourTemplateSpec {
  id: string;
  name: string;
  description: string;
  role: Extract<AssetRole, "mobile" | "desktop">;
}

/**
 * Desktop Site Tour and Mobile Site Tour (presets round two, D3–D5): the pages of one site in a
 * browser or a phone, one shot that loops natively.
 */
export function tourTemplate(spec: TourTemplateSpec): Template {
  const label = spec.role === "mobile" ? "Mobile" : "Desktop";
  const slots: SlotSpec[] = Array.from({ length: SLOT_COUNT }, (_, i) => ({
    key: `${spec.role}${i + 1}`,
    role: spec.role,
    required: i < REQUIRED_SLOTS,
    // A full page shows its top, so a hero or a full page both work.
    prefer: "any",
    label: `${label} page ${i + 1}`,
  }));

  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    category: spec.role,
    slots,
    defaultDuration: DEMO_PAGES * TOUR_STEP,
    build: (ctx: TemplateBuildContext) => {
      // fillSlots reuses an asset when a slot has no distinct one; a tour shows each page once.
      const assetIds = [
        ...new Set(
          slots.map((slot) => ctx.slots[slot.key]?.id).filter((id): id is string => Boolean(id)),
        ),
      ];

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

      const layout: TourLayout = {
        kind: "tour",
        device: spec.role === "mobile" ? "phone" : "browser",
        assetIds,
        step: TOUR_STEP,
      };
      const shot = defaultShot(layout);
      shot.duration = sliderDuration(layout);
      // After N steps the first page is back, so the loop is native.
      shot.transitionIn = { kind: "cut", duration: 0, easing: "quintInOut" };
      shot.camera = { preset: "static", intensity: 0, easing: "smooth" };

      return { style, shots: [shot], loop: true };
    },
  };
}
