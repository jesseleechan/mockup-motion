import type { AssetRole, Layout, Style } from "../doc/types";
import { defaultShot, defaultStyle } from "../doc/defaults";
import { sliderDuration } from "../motion";
import type { SlotSpec, Template, TemplateBuildContext } from "./types";
import { presetToneStyle } from "./looks";

type OrbitLayout = Extract<Layout, { kind: "orbit" }>;

// Quality bar §2.2: the slider's 2.0 s per screenshot.
const ORBIT_STEP = 2;
// Quality bar §4: an orbit needs 4 screenshots, reads best as a ring with 5–6, and shows 6.
const REQUIRED_SLOTS = 4;
const SLOT_COUNT = 6;

interface OrbitTemplateSpec {
  id: string;
  name: string;
  description: string;
  role: Extract<AssetRole, "mobile" | "desktop">;
}

/** Desktop Orbit and Mobile Orbit: one ring shot that loops natively (orbit plan). */
export function orbitTemplate(spec: OrbitTemplateSpec): Template {
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
    category: spec.role,
    slots,
    // The gallery badge: the five demo screenshots its preview and demo content use.
    defaultDuration: 5 * ORBIT_STEP,
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
        ...presetToneStyle("light"),
        shadow: "none",
        // A flat fill cannot band, so it needs no grain (quality bar §5, §6).
        grain: 0,
        vignette: 0,
      };

      const layout: OrbitLayout = {
        kind: "orbit",
        assetIds,
        shape: spec.role,
        step: ORBIT_STEP,
      };
      const shot = defaultShot(layout);
      shot.duration = sliderDuration(layout);
      // After N steps the ring is back where it started, so the loop is native.
      shot.transitionIn = { kind: "cut", duration: 0, easing: "quintInOut" };
      shot.camera = { preset: "static", intensity: 0, easing: "smooth" };

      return { style, shots: [shot], loop: true };
    },
  };
}
