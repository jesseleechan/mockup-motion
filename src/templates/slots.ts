import type { AssetRef, AssetRole, ProjectDoc, Shot, Style } from "../doc/types";
import type { SlotSpec, Template } from "./types";

/** Distinct screenshots a multi-screen template needs. Quality bar §4: Frames needs 4. */
const MULTI_ASSET_MINIMUM: Record<string, number> = {
  frames: 4,
};

/** The one role a multi-screen template's required slots share. */
function multiAssetRole(template: Template): AssetRole {
  const roles = new Set(template.slots.filter((s) => s.required).map((s) => s.role));
  const [role] = roles;
  if (roles.size !== 1 || !role) {
    throw new Error(`${template.id}: required slots must share one role, got ${[...roles]}`);
  }
  return role;
}

/**
 * Validates if the available assets satisfy the template requirements.
 * Multi-screen templates need enough distinct screenshots of their slots' role.
 * With too few assets, returns valid: false with a user-facing explanation.
 */
export function validateTemplateRequirements(
  template: Template,
  assets: AssetRef[],
): { valid: boolean; reason?: string } {
  // 1. Multi-screen layouts need several distinct screenshots
  const minimum = MULTI_ASSET_MINIMUM[template.id];

  if (minimum !== undefined) {
    const requiredRole = multiAssetRole(template);
    const distinctRoleAssets = assets.filter((a) => a.kind === "image" && a.role === requiredRole);

    if (distinctRoleAssets.length < minimum) {
      return {
        valid: false,
        reason: `Needs ${minimum}+ ${requiredRole} screenshots`,
      };
    }
  }

  // 2. Check required slots
  const requiredSlots = template.slots.filter((s) => s.required);
  for (const slot of requiredSlots) {
    const hasRoleMatch = assets.some((a) => a.kind === "image" && a.role === slot.role);
    if (!hasRoleMatch) {
      return {
        valid: false,
        reason: slot.role === "logo" ? "Needs a logo" : `Needs a ${slot.role} screenshot`,
      };
    }
  }

  return { valid: true };
}

/**
 * Greedily fills template slots from available assets by matching roles.
 * - Never puts a mobile-role asset in a desktop slot or vice versa.
 * - Respects prefer: "tall" for full-page screenshots.
 * - Preserves previous assignments when the asset is still present and matches role.
 * - Only reuses an asset when there are not enough distinct ones (unless disallowed).
 */
export function fillSlots(
  t: Template,
  assets: AssetRef[],
  previousAssignments?: Record<string, string | undefined>,
): Record<string, AssetRef | undefined> {
  const result: Record<string, AssetRef | undefined> = {};
  const used = new Set<string>();

  // Helper to find asset by ID
  const findAssetById = (id?: string): AssetRef | undefined => {
    if (!id) return undefined;
    return assets.find((a) => a.id === id);
  };

  // Phase 1: Try to preserve previous assignments if valid
  if (previousAssignments) {
    for (const slot of t.slots) {
      const prevId = previousAssignments[slot.key];
      if (prevId) {
        const prevAsset = findAssetById(prevId);
        if (prevAsset && prevAsset.role === slot.role && !used.has(prevAsset.id)) {
          result[slot.key] = prevAsset;
          used.add(prevAsset.id);
        }
      }
    }
  }

  // Phase 2: Greedily assign remaining slots by role and tall preference
  for (const slot of t.slots) {
    if (result[slot.key]) continue; // Already preserved

    const roleCandidates = assets.filter((a) => a.kind === "image" && a.role === slot.role);

    // 1. Try unused candidate matching prefer === "tall"
    if (slot.prefer === "tall") {
      const tallUnused = roleCandidates.find((a) => !used.has(a.id) && a.meta?.tall);
      if (tallUnused) {
        result[slot.key] = tallUnused;
        used.add(tallUnused.id);
        continue;
      }
    }

    // 2. Try any unused candidate with matching role
    const unusedRole = roleCandidates.find((a) => !used.has(a.id));
    if (unusedRole) {
      result[slot.key] = unusedRole;
      used.add(unusedRole.id);
      continue;
    }

    // 3. Fallback: reuse an already-used asset of the same role (never cross-role)
    if (roleCandidates.length > 0) {
      result[slot.key] = roleCandidates[0];
      continue;
    }

    // 4. No matching role asset available
    result[slot.key] = undefined;
  }

  return result;
}

/** Required slots that fillSlots cannot fill from these assets. */
export function missingRequiredSlots(t: Template, assets: AssetRef[]): SlotSpec[] {
  const filled = fillSlots(t, assets);
  return t.slots.filter((slot) => slot.required && !filled[slot.key]);
}

/**
 * Applies a template to a project document, filling slots and preserving brand style.
 */
export function applyTemplate(
  template: Template,
  doc: ProjectDoc,
  previousAssignments?: Record<string, string | undefined>,
): { style: Style; shots: Shot[]; loop: boolean } {
  const slots = fillSlots(template, doc.assets, previousAssignments);

  // Preserve user's brand style (fonts, text color, accent)
  const brandStyle: Partial<Style> = {
    fonts: doc.style.fonts,
    textColor: doc.style.textColor,
    accent: doc.style.accent,
    browserChrome: doc.style.browserChrome,
  };

  return template.build({
    aspect: doc.aspect,
    slots,
    projectName: doc.name,
    style: brandStyle,
  });
}
