import type { AssetRole, Layout, Style } from "../doc/types";
import { defaultShot, defaultStyle } from "../doc/defaults";
import { sliderDuration } from "../motion";
import type { SlotSpec, Template, TemplateBuildContext } from "./types";
import { paletteBackground, paletteTextColor } from "./looks";

type SliderLayout = Extract<Layout, { kind: "slider" }>;

// Quality bar §2.2: 2.0 s per screenshot, as in the reference (D4).
const SLIDER_STEP = 2;
// D6: sliders need 3 screenshots and work best with 4–6.
const REQUIRED_SLOTS = 3;
const SLOT_COUNT = 6;

interface SliderTemplateSpec {
  id: string;
  name: string;
  description: string;
  category: Template["category"];
  role: Extract<AssetRole, "mobile" | "desktop">;
  axis: SliderLayout["axis"];
}

/** Mobile Slider and Desktop Slider: one carousel shot that loops natively (presets P03). */
export function sliderTemplate(spec: SliderTemplateSpec): Template {
  const label = spec.role === "mobile" ? "Mobile" : "Desktop";
  const slots: SlotSpec[] = Array.from({ length: SLOT_COUNT }, (_, i) => ({
    key: `${spec.role}${i + 1}`,
    role: spec.role,
    required: i < REQUIRED_SLOTS,
    prefer: "any",
    label: `${label} screenshot ${i + 1}`,
  }));

  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    category: spec.category,
    slots,
    // The gallery badge: the five demo screenshots its preview and demo content use.
    defaultDuration: 5 * SLIDER_STEP,
    build: (ctx: TemplateBuildContext) => {
      // fillSlots reuses an asset when a slot has no distinct one; a screenshot must not appear
      // twice in view (quality bar §4).
      const assetIds = [
        ...new Set(
          slots.map((slot) => ctx.slots[slot.key]?.id).filter((id): id is string => Boolean(id)),
        ),
      ];

      const style: Style = {
        ...defaultStyle(),
        ...ctx.style,
        background: paletteBackground("ash"),
        textColor: paletteTextColor("ash"),
        frameAppearance: "light",
        shadow: "none",
        // A flat light fill cannot band, so it needs no grain (quality bar §5, §6; D7).
        grain: 0,
        vignette: 0,
      };

      const layout: SliderLayout = {
        kind: "slider",
        assetIds,
        axis: spec.axis,
        shape: spec.role,
        step: SLIDER_STEP,
      };
      const shot = defaultShot(layout);
      shot.duration = sliderDuration(layout);
      // After N steps the cards are back where they started, so the loop is native.
      shot.transitionIn = { kind: "cut", duration: 0, easing: "quintInOut" };
      shot.entrance = "none";
      shot.camera = { preset: "static", intensity: 0, easing: "smooth", float: 0 };
      shot.texts = [];

      return { style, shots: [shot], loop: true };
    },
  };
}
