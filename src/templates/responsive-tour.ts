import type { Layout, ProjectDoc, Style } from "../doc/types";
import { defaultShot, defaultStyle } from "../doc/defaults";
import { distinctPages, sliderDuration } from "../motion";
import type { SlotSpec, Template, TemplateBuildContext } from "./types";
import { presetToneStyle } from "./looks";
import { buildTemplatePreviewDoc } from "./demo-preview";

type ResponsiveTourLayout = Extract<Layout, { kind: "responsive-tour" }>;

// Quality bar §2.2: the slider's 2.0 s per page.
const TOUR_STEP = 2;
// Presets round two, D12: 3–5 pages, each a desktop and a mobile screenshot; the first 3 are
// required.
const REQUIRED_PAGES = 3;
const PAGE_SLOTS = 5;
// The gallery badge: the four demo pages its preview and demo content use.
const DEMO_PAGES = 4;

const PAGE_NUMBERS = Array.from({ length: PAGE_SLOTS }, (_, i) => i + 1);

// Page n is the slots desktop<n> and mobile<n>, side by side, so the slots read as pairs.
const SLOTS: SlotSpec[] = PAGE_NUMBERS.flatMap((n) =>
  (["desktop", "mobile"] as const).map((role) => ({
    key: `${role}${n}`,
    role,
    required: n <= REQUIRED_PAGES,
    // A full page shows its top, so a hero or a full page both work.
    prefer: "any" as const,
    label: `${role === "mobile" ? "Mobile" : "Desktop"} page ${n}`,
  })),
);

/**
 * Responsive Tour (presets round two, D12–D15): pages of one site, each as a desktop and a mobile
 * screenshot, on Responsive Scroll's frameless cards. Every step moves both cards to the next
 * page. One shot that loops natively.
 */
export const responsiveTourTemplate: Template = {
  id: "responsive-tour",
  name: "Responsive Tour",
  description: "Each page in desktop and mobile. Every step moves both to the next page.",
  category: "both",
  slots: SLOTS,
  defaultDuration: DEMO_PAGES * TOUR_STEP,
  build: (ctx: TemplateBuildContext) => {
    // Pages pair by order (D12): the n-th desktop screenshot with the n-th mobile one. fillSlots
    // reuses a screenshot when a size runs short; a tour shows each page once, so a page that
    // would repeat one is left out.
    const { desktopIds, mobileIds } = distinctPages(
      PAGE_NUMBERS.map((n) => ctx.slots[`desktop${n}`]?.id ?? ""),
      PAGE_NUMBERS.map((n) => ctx.slots[`mobile${n}`]?.id ?? ""),
    );

    // Responsive Scroll's look: frameless cards on the flat Ash fill, no shadow.
    const style: Style = {
      ...defaultStyle(),
      ...ctx.style,
      ...presetToneStyle("light"),
      shadow: "none",
      // A flat fill cannot band, so it needs no grain (quality bar §5, §6).
      grain: 0,
      vignette: 0,
    };

    const layout: ResponsiveTourLayout = {
      kind: "responsive-tour",
      desktopIds,
      mobileIds,
      step: TOUR_STEP,
    };
    const shot = defaultShot(layout);
    shot.duration = sliderDuration(layout);
    // After N steps the first page is back on both cards, so the loop is native.
    shot.transitionIn = { kind: "cut", duration: 0, easing: "quintInOut" };
    shot.camera = { preset: "static", intensity: 0, easing: "smooth" };

    return { style, shots: [shot], loop: true };
  },
};

export function previewDoc(): ProjectDoc {
  return buildTemplatePreviewDoc(responsiveTourTemplate);
}
