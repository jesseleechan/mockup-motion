import type {
  Aspect,
  AssetRef,
  AssetRole,
  Shot,
  Style,
} from "../doc/types";

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
  category: "single" | "responsive" | "mobile" | "portfolio" | "reel";
  slots: SlotSpec[];
  defaultDuration: number;
  build: (ctx: TemplateBuildContext) => {
    style: Style;
    shots: Shot[];
    loop: boolean;
  };
}
