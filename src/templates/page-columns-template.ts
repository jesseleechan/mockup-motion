import type { AssetRef, AssetRole, Layout, Style } from "../doc/types";
import { defaultShot, defaultStyle } from "../doc/defaults";
import { PAGE_COLUMNS_MAX_SCREENSHOTS, pageColumnsPacedDuration } from "../motion";
import type { SlotSpec, Template, TemplateBuildContext } from "./types";
import { loopWrapCrossfade, presetToneStyle } from "./looks";

type PageColumnsLayout = Extract<Layout, { kind: "pageColumns" }>;

// Plan D11: two full pages of one size, and a third column at 16:9, 4:3 and 1:1.
const REQUIRED_SLOTS = 2;

interface PageColumnsTemplateSpec {
  id: string;
  name: string;
  description: string;
  role: Extract<AssetRole, "mobile" | "desktop">;
  /** The gallery badge: the loop of its 16:9 preview, whose demo pages set it (plan D10). */
  defaultDuration: number;
}

/**
 * Desktop Page Columns and Mobile Page Columns (docs/presets-2-plan, D9–D11): full pages side by
 * side, each drifting through its page, on Ash or Onyx with a still camera. The loop returns to
 * the start through the wrap crossfade, because a drift can't reverse.
 */
export function pageColumnsTemplate(spec: PageColumnsTemplateSpec): Template {
  const label = spec.role === "mobile" ? "Mobile" : "Desktop";
  const slots: SlotSpec[] = Array.from({ length: PAGE_COLUMNS_MAX_SCREENSHOTS }, (_, i) => ({
    key: `${spec.role}${i + 1}`,
    role: spec.role,
    required: i < REQUIRED_SLOTS,
    prefer: "tall",
    label: `${label} full page ${i + 1}`,
  }));

  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    category: spec.role,
    slots,
    defaultDuration: spec.defaultDuration,
    build: (ctx: TemplateBuildContext) => {
      // fillSlots reuses an asset when a slot has no distinct one; a page shows once.
      const assets = [
        ...new Map(
          slots
            .map((slot) => ctx.slots[slot.key])
            .filter((asset): asset is AssetRef => Boolean(asset))
            .map((asset) => [asset.id, asset]),
        ).values(),
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

      const layout: PageColumnsLayout = {
        kind: "pageColumns",
        assetIds: assets.map((asset) => asset.id),
        shape: spec.role,
      };
      const shot = defaultShot(layout);
      // The Default pace: the shortest loop from 12 s at which the longest page keeps to the
      // speed limit, plus the wrap crossfade (quality bar §2.2).
      shot.duration = pageColumnsPacedDuration(layout, ctx.aspect, assets, 1);
      // A drift can't reverse, so the loop crossfades back to the start (contracts.md §5).
      shot.transitionIn = loopWrapCrossfade();
      shot.camera = { preset: "static", intensity: 0, easing: "smooth" };

      return { style, shots: [shot], loop: true };
    },
  };
}
