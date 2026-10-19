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

/** The gallery tab a template sits under: the screenshots it presents. */
export type TemplateCategory = "desktop" | "mobile";

export interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  slots: SlotSpec[];
  defaultDuration: number;
  /** The Light and Dark background fills (`presetToneStyle`); Ash and Onyx when omitted. */
  tones?: PresetTones;
  build: (ctx: TemplateBuildContext) => {
    style: Style;
    shots: Shot[];
    loop: boolean;
  };
}
