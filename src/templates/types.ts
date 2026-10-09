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

export interface Template {
  id: string;
  name: string;
  description: string;
  category: "single" | "mobile" | "portfolio";
  slots: SlotSpec[];
  defaultDuration: number;
  /** Shows the Light / Dark background switch (Ash or Onyx, `presetToneStyle`). */
  toneSwitch?: boolean;
  build: (ctx: TemplateBuildContext) => {
    style: Style;
    shots: Shot[];
    loop: boolean;
  };
}
