import type { AssetRef, AssetRole } from "../doc/types";
import type { TemplateCategory } from "./types";
import { getTemplateById } from "./registry";

/** The presets that come in a desktop and a mobile size (Frames plan D3). Scroll Story has none. */
const SIZE_PAIRS: readonly (readonly [desktop: string, mobile: string])[] = [
  ["desktop-slider", "mobile-slider"],
  ["frames", "mobile-frames"],
];

const SCREENSHOT_ROLES: readonly AssetRole[] = ["desktop", "mobile", "tablet"];

/** The other size of a paired preset, or none. */
export function pairedTemplateId(templateId: string): string | undefined {
  for (const [desktop, mobile] of SIZE_PAIRS) {
    if (templateId === desktop) return mobile;
    if (templateId === mobile) return desktop;
  }
  return undefined;
}

/**
 * The size every screenshot in the library shares. None when there are no screenshots, or when
 * they mix sizes (a tablet screenshot counts as its own size).
 */
export function librarySize(assets: AssetRef[]): TemplateCategory | undefined {
  const roles = new Set(
    assets
      .filter((a) => a.kind === "image" && a.role && SCREENSHOT_ROLES.includes(a.role))
      .map((a) => a.role),
  );
  if (roles.size !== 1) return undefined;
  const [role] = roles;
  return role === "desktop" || role === "mobile" ? role : undefined;
}

/**
 * The other size of the template when it, and not the template, matches the library's
 * screenshots: Mobile Frames for Desktop Frames when every screenshot is mobile. Otherwise none.
 */
export function fittingTemplateId(templateId: string, assets: AssetRef[]): string | undefined {
  const size = librarySize(assets);
  const template = getTemplateById(templateId);
  if (!size || !template || template.category === size) return undefined;
  const pairId = pairedTemplateId(templateId);
  return pairId && getTemplateById(pairId)?.category === size ? pairId : undefined;
}
