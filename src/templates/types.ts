import type { Aspect, AssetRef, AssetRole, Shot, Style } from "../doc/types";

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
  /** Shows the Light / Dark background switch (Ash or Onyx, `presetToneStyle`). */
  toneSwitch?: boolean;
  /**
   * Two slot keys that show one page at two sizes (Responsive Scroll). `fillSlots` fills them with
   * a desktop and a mobile capture of the same page when the library has one.
   */
  samePage?: readonly [desktopSlot: string, mobileSlot: string];
  build: (ctx: TemplateBuildContext) => {
    style: Style;
    shots: Shot[];
    loop: boolean;
  };
}
