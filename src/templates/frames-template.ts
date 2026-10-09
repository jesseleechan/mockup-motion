import type { Aspect, AssetRole, Layout, Style } from "../doc/types";
import { defaultShot, defaultStyle } from "../doc/defaults";
import { framesDuration } from "../motion/layouts/rows";
import type { SlotSpec, Template, TemplateBuildContext } from "./types";
import { paletteBackground, paletteTextColor } from "./looks";

type RowsLayout = Extract<Layout, { kind: "rows" }>;
type ColumnsLayout = Extract<Layout, { kind: "columns" }>;

// The reference loop is 15 s (docs/presets-plan/reference.md); shorter loops feel hurried.
const FRAMES_MIN_LOOP = 15;
// Quality bar §4: Frames needs 4 screenshots; the slots take up to 6.
const REQUIRED_SLOTS = 4;
const SLOT_COUNT = 6;
// Quality bar §4: 0.065 stage units between cards and between lanes, in both sizes.
const FRAMES_GAP = 0.065;

// Quality bar §4 (Desktop Frames). The reference card is 0.315 × 0.52 stage units (aspect 1.65);
// our cards keep the 1.6 desktop screen aspect, so 0.32 tall keeps both sides within 3% of it.
const TALL_ROWS = { rows: 3, cardHeight: 0.32 } as const;
const WIDE_ROWS = { rows: 2, cardHeight: 0.42 } as const;

// Quality bar §4 (Mobile Frames): columns and portrait card widths per aspect. Every column is
// fully visible with 4.8% side margins, except at 4:5, where the outer columns are cropped by
// 14% of their width (docs/phone-frames-plan/README.md §3 has the derivation).
const MOBILE_COLUMNS: Record<Aspect, { columns: ColumnsLayout["columns"]; cardWidth: number }> = {
  "16:9": { columns: 5, cardWidth: 0.269 },
  "4:3": { columns: 4, cardWidth: 0.253 },
  "1:1": { columns: 3, cardWidth: 0.258 },
  "4:5": { columns: 3, cardWidth: 0.246 },
  "9:16": { columns: 2, cardWidth: 0.222 },
};

/** The Desktop Frames rows layout for an aspect: 3 rows on tall and square frames, 2 on wide ones. */
export function framesLayout(aspect: Aspect, assetIds: string[]): RowsLayout {
  const wide = aspect === "16:9" || aspect === "4:3";
  return {
    kind: "rows",
    assetIds,
    ...(wide ? WIDE_ROWS : TALL_ROWS),
    device: "card",
    tilt: 0,
    speed: 0.35, // unused: with travel "period" the speed follows the shot duration
    gap: FRAMES_GAP,
    travel: "period",
  };
}

/** The Mobile Frames columns layout for an aspect: portrait cards in 2–5 columns. */
export function mobileFramesLayout(aspect: Aspect, assetIds: string[]): ColumnsLayout {
  return {
    kind: "columns",
    assetIds,
    ...MOBILE_COLUMNS[aspect],
    device: "card",
    tilt: 0,
    speed: 0.35, // unused: with travel "period" the speed follows the shot duration
    gap: FRAMES_GAP,
    travel: "period",
  };
}

/**
 * Decision D13: a Frames shot (rows or columns with travel "period") takes the lane count and
 * card size of its preset at the new aspect, keeping its screenshots and other fields. Any
 * other layout comes back unchanged.
 */
export function refitFramesLayout(layout: Layout, aspect: Aspect): Layout {
  if (layout.kind === "rows" && layout.travel === "period") {
    const { rows, cardHeight } = framesLayout(aspect, layout.assetIds);
    return { ...layout, rows, cardHeight };
  }
  if (layout.kind === "columns" && layout.travel === "period") {
    const { columns, cardWidth } = mobileFramesLayout(aspect, layout.assetIds);
    return { ...layout, columns, cardWidth };
  }
  return layout;
}

interface FramesTemplateSpec {
  id: string;
  name: string;
  description: string;
  role: Extract<AssetRole, "mobile" | "desktop">;
}

/** Desktop Frames and Mobile Frames: one shot of lanes that loops natively (Frames plan PF03). */
export function framesTemplate(spec: FramesTemplateSpec): Template {
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
    // A pair's gallery tab is the role of its screenshots.
    category: spec.role,
    slots,
    defaultDuration: FRAMES_MIN_LOOP,
    build: (ctx: TemplateBuildContext) => {
      // fillSlots reuses an asset when a slot has no distinct one; a lane must not show the
      // same screenshot twice (quality-bar §4).
      const assets = [
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
        // A flat light fill cannot band, so it needs no grain (quality-bar §5, §6).
        grain: 0,
        vignette: 0,
      };

      const ids = assets.length > 0 ? assets : [""];
      const layout =
        spec.role === "mobile"
          ? mobileFramesLayout(ctx.aspect, ids)
          : framesLayout(ctx.aspect, ids);
      const shot = defaultShot(layout);
      shot.duration = Math.max(FRAMES_MIN_LOOP, framesDuration(layout, ctx.aspect));
      // Every lane travels one whole period per loop, so the loop is native (contracts.md §5).
      shot.transitionIn = { kind: "cut", duration: 0, easing: "quintInOut" };
      shot.entrance = "none";
      shot.camera = { preset: "static", intensity: 0, easing: "smooth", float: 0 };

      return { style, shots: [shot], loop: true };
    },
  };
}
