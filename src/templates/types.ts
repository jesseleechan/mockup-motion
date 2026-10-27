import type { Aspect, AssetRef, AssetRole, Shot, Style } from "../doc/types";
import type { PresetTones } from "./looks";

export interface SlotSpec {
  key: string; // "desktop1", "mobile1", "logo"
  role: AssetRole;
  required: boolean;
  prefer?: "tall" | "any";
  label: string;
}

export interface TemplateBuildContext {
  aspect: Aspect;
  slots: Record<string, AssetRef | undefined>;
  projectName: string;
  style?: Partial<Style>;
}

/**
 * The gallery tab a template sits under: the screenshots it presents. "both" shows a desktop and
 * a mobile screenshot of one page (Responsive Scroll) and sits under both tabs.
 */
export type TemplateCategory = "desktop" | "mobile" | "both";

export interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  slots: SlotSpec[];
  defaultDuration: number;
  /** The Light and Dark background fills (`presetToneStyle`); Ash and Onyx when omitted. */
  tones?: PresetTones;
  /**
   * Two slot keys that show one page at two sizes (Responsive Scroll). `fillSlots` fills them with
   * a desktop and a mobile capture of the same page when the library has one.
   */
  samePage?: readonly [desktopSlot: string, mobileSlot: string];
  /**
   * Slot pairs that each show one page at two sizes, in page order (Responsive Tour). `fillSlots`
   * fills the desktop slots in Library order and gives each page the mobile capture of its
   * desktop's page, else the next mobile screenshot in Library order (`pairByPage`).
   */
  pages?: readonly (readonly [desktopSlot: string, mobileSlot: string])[];
  /**
   * Every slot takes a different screenshot (Before & After compares two): `fillSlots` leaves a
   * slot empty rather than reuse one, so the missing one is reported (`missingRequiredSlots`).
   */
  distinct?: boolean;
  build: (ctx: TemplateBuildContext) => {
    style: Style;
    shots: Shot[];
    loop: boolean;
  };
}
