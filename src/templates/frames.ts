import type { Aspect, Layout, ProjectDoc, Style } from "../doc/types";
import { defaultShot, defaultStyle } from "../doc/defaults";
import { framesDuration } from "../motion/layouts/rows";
import type { SlotSpec, Template, TemplateBuildContext } from "./types";
import { paletteBackground, paletteTextColor } from "./looks";
import { buildTemplatePreviewDoc } from "./demo-preview";

// The reference loop is 15 s (docs/presets-plan/reference.md); shorter loops feel hurried.
const FRAMES_MIN_LOOP = 15;

// Quality bar §4 (Frames). The reference card is 0.315 × 0.52 stage units (aspect 1.65); our
// cards keep the 1.6 desktop screen aspect, so 0.32 tall keeps both sides within 3% of it.
const TALL_ROWS = { rows: 3, cardHeight: 0.32 } as const;
const WIDE_ROWS = { rows: 2, cardHeight: 0.42 } as const;
const FRAMES_GAP = 0.065;

const desktopSlot = (n: number, required: boolean): SlotSpec => ({
  key: `desktop${n}`,
  role: "desktop",
  required,
  prefer: "any",
  label: `Desktop screenshot ${n}`,
});

/** The Frames rows layout for an aspect: 3 rows on tall and square frames, 2 on wide ones. */
export function framesLayout(
  aspect: Aspect,
  assetIds: string[],
): Extract<Layout, { kind: "rows" }> {
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

export const framesTemplate: Template = {
  id: "frames",
  name: "Frames",
  description: "Rows of desktop screens that glide past in alternating directions.",
  category: "portfolio",
  slots: [1, 2, 3, 4, 5, 6].map((n) => desktopSlot(n, n <= 4)),
  defaultDuration: FRAMES_MIN_LOOP,
  build: (ctx: TemplateBuildContext) => {
    // fillSlots reuses an asset when a slot has no distinct one; a row must not show the
    // same screenshot twice (quality-bar §4).
    const assets = [
      ...new Set(
        [1, 2, 3, 4, 5, 6]
          .map((n) => ctx.slots[`desktop${n}`]?.id)
          .filter((id): id is string => Boolean(id)),
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

    const layout = framesLayout(ctx.aspect, assets.length > 0 ? assets : [""]);
    const shot = defaultShot(layout);
    shot.duration = Math.max(FRAMES_MIN_LOOP, framesDuration(layout, ctx.aspect));
    // Every row travels one whole period per loop, so the loop is native (contracts.md §5).
    shot.transitionIn = { kind: "cut", duration: 0, easing: "quintInOut" };
    shot.entrance = "none";
    shot.camera = { preset: "static", intensity: 0, easing: "smooth", float: 0 };

    return { style, shots: [shot], loop: true };
  },
};

export function previewDoc(): ProjectDoc {
  return buildTemplatePreviewDoc(framesTemplate);
}
