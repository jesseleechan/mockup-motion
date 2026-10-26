import type { AssetRef, AssetRole, ProjectDoc, Shot, Style } from "../doc/types";
import type { SlotSpec, Template } from "./types";
import { setPresetTone, templateTones } from "./looks";

interface RoleNeed {
  role: AssetRole;
  /** Distinct screenshots of the role: one per required slot (quality bar §4: Frames needs 4). */
  count: number;
  /** A required slot prefers a full-page screenshot (Scroll Story, Responsive Scroll). */
  tall: boolean;
  /** The template takes more of the role than it needs: it has optional slots for them. */
  more: boolean;
}

/** The screenshots a template's required slots ask for, by role, in slot order. */
function roleNeeds(template: Template): RoleNeed[] {
  const needs = new Map<AssetRole, RoleNeed>();
  for (const slot of template.slots) {
    if (!slot.required) continue;
    const need = needs.get(slot.role) ?? { role: slot.role, count: 0, tall: false, more: false };
    need.count += 1;
    need.tall ||= slot.prefer === "tall";
    needs.set(slot.role, need);
  }
  for (const slot of template.slots) {
    const need = needs.get(slot.role);
    if (need && !slot.required) need.more = true;
  }
  return [...needs.values()];
}

function describeNeed({ role, count, tall, more }: RoleNeed): string {
  const kind = tall ? `full-page ${role}` : role;
  // "3+" when more are welcome; Before & After takes exactly 2.
  return count > 1 ? `${count}${more ? "+" : ""} ${kind} screenshots` : `a ${kind} screenshot`;
}

/**
 * What a template needs, said the same way on every card: "Needs 3+ desktop screenshots",
 * "Needs a full-page mobile screenshot", "Needs a desktop and a mobile full-page screenshot",
 * "Needs 3+ pages in desktop and mobile".
 */
export function templateNeeds(template: Template): string {
  const needs = roleNeeds(template);
  if (needs.length === 0) return "No screenshots needed";
  // One full-page screenshot of each size reads better as one phrase.
  if (needs.length > 1 && needs.every((n) => n.count === 1 && n.tall)) {
    return `Needs a ${needs.map((n) => n.role).join(" and a ")} full-page screenshot`;
  }
  // Several pages in both sizes (Responsive Tour): each page is a desktop and a mobile screenshot.
  const [first, second] = needs;
  if (
    needs.length === 2 &&
    first.role === "desktop" &&
    second.role === "mobile" &&
    first.count > 1 &&
    first.count === second.count &&
    !first.tall &&
    !second.tall
  ) {
    return `Needs ${first.count}${first.more ? "+" : ""} pages in desktop and mobile`;
  }
  return `Needs ${needs.map(describeNeed).join(" and ")}`;
}

/**
 * Whether the library has enough distinct screenshots of each role the template's required
 * slots ask for, full-page ones where a slot prefers them. When it doesn't, `reason` is the
 * template's `templateNeeds` text.
 */
export function validateTemplateRequirements(
  template: Template,
  assets: AssetRef[],
): { valid: boolean; reason?: string } {
  const met = roleNeeds(template).every(
    ({ role, count, tall }) =>
      assets.filter((a) => a.kind === "image" && a.role === role && (!tall || a.meta?.tall))
        .length >= count,
  );
  return met ? { valid: true } : { valid: false, reason: templateNeeds(template) };
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

  // Phase 1.5: Fill a same-page slot pair with two captures of one page (Responsive Scroll)
  if (t.samePage) {
    const [desktopKey, mobileKey] = t.samePage;
    const desktopSlot = t.slots.find((s) => s.key === desktopKey);
    const mobileSlot = t.slots.find((s) => s.key === mobileKey);
    if (desktopSlot && mobileSlot && !result[desktopKey] && !result[mobileKey]) {
      const pair = samePagePair(assets, desktopSlot.role, mobileSlot.role, used);
      if (pair) {
        result[desktopKey] = pair[0];
        result[mobileKey] = pair[1];
        used.add(pair[0].id);
        used.add(pair[1].id);
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

    // 3. Fallback: reuse an already-used asset of the same role (never cross-role), unless the
    // template compares its screenshots
    if (roleCandidates.length > 0 && !t.distinct) {
      result[slot.key] = roleCandidates[0];
      continue;
    }

    // 4. No matching role asset available
    result[slot.key] = undefined;
  }

  return result;
}

/**
 * A capture's page name from its file name: without the extension, `-full`, and the size suffix
 * `npm run capture` adds, so `site-desktop-1440-full.png` and `site-mobile-390@2x-full.png` are
 * both `site`.
 */
export function capturePageName(fileName: string): string {
  return fileName
    .replace(/\.[^./]+$/, "")
    .replace(/-full$/, "")
    .replace(/-(desktop|mobile)(-\d+(@\d+x)?)?$/, "");
}

/**
 * Two screenshots of one page (decision D4): first a pair whose captures share a URL, then a pair
 * whose file names name the same page. Tall screenshots first. Undefined when there is none.
 */
function samePagePair(
  assets: AssetRef[],
  desktopRole: AssetRole,
  mobileRole: AssetRole,
  used: Set<string>,
): [AssetRef, AssetRef] | undefined {
  const byTall = (a: AssetRef, b: AssetRef) =>
    Number(Boolean(b.meta?.tall)) - Number(Boolean(a.meta?.tall));
  const candidates = (role: AssetRole) =>
    assets.filter((a) => a.kind === "image" && a.role === role && !used.has(a.id)).sort(byTall);
  const desktops = candidates(desktopRole);
  const mobiles = candidates(mobileRole);
  const keys: ((a: AssetRef) => string | undefined)[] = [
    (a) => a.meta?.page || undefined,
    (a) => capturePageName(a.name) || undefined,
  ];
  for (const key of keys) {
    for (const desktop of desktops) {
      const page = key(desktop);
      const mobile = page ? mobiles.find((m) => key(m) === page) : undefined;
      if (mobile) return [desktop, mobile];
    }
  }
  return undefined;
}

/** Required slots that fillSlots finds no screenshot of their role for. */
export function emptyRequiredSlots(t: Template, assets: AssetRef[]): SlotSpec[] {
  const filled = fillSlots(t, assets);
  return t.slots.filter((slot) => slot.required && !filled[slot.key]);
}

/**
 * Required full-page slots that hold a short screenshot, with the screenshot each holds. Such a
 * page never scrolls, so the slot still counts as missing (polish item 5).
 */
function shortFullPageSlots(
  t: Template,
  assets: AssetRef[],
): { slot: SlotSpec; asset: AssetRef }[] {
  const filled = fillSlots(t, assets);
  return t.slots.flatMap((slot) => {
    const asset = filled[slot.key];
    return slot.required && slot.prefer === "tall" && asset && !asset.meta?.tall
      ? [{ slot, asset }]
      : [];
  });
}

/**
 * Required slots the assets can't fill properly: empty ones, and full-page ones holding a short
 * screenshot. Demo content and the fill overlay offer to fill them.
 */
export function missingRequiredSlots(t: Template, assets: AssetRef[]): SlotSpec[] {
  const empty = new Set(emptyRequiredSlots(t, assets).map((slot) => slot.key));
  for (const { slot } of shortFullPageSlots(t, assets)) empty.add(slot.key);
  return t.slots.filter((slot) => empty.has(slot.key));
}

/**
 * Which short screenshots the new screenshots replace: for each full-page slot holding a short
 * screenshot, the first new full-page screenshot of its role, by asset id. Swapping the ids in
 * the shots fills the slot without rebuilding the template, so shot edits stay.
 */
export function fullPageReplacements(
  t: Template,
  assets: AssetRef[],
  added: AssetRef[],
): Record<string, string> {
  const replacements: Record<string, string> = {};
  const used = new Set<string>();
  for (const { slot, asset } of shortFullPageSlots(t, assets)) {
    const tall = added.find(
      (a) => a.kind === "image" && a.role === slot.role && a.meta?.tall && !used.has(a.id),
    );
    if (!tall) continue;
    replacements[asset.id] = tall.id;
    used.add(tall.id);
  }
  return replacements;
}

/**
 * Applies a template to a project document, filling slots and keeping the browser chrome.
 */
export function applyTemplate(
  template: Template,
  doc: ProjectDoc,
  previousAssignments?: Record<string, string | undefined>,
): { style: Style; shots: Shot[]; loop: boolean } {
  const slots = fillSlots(template, doc.assets, previousAssignments);

  // Preserve the user's browser chrome
  const brandStyle: Partial<Style> = {
    browserChrome: doc.style.browserChrome,
  };

  const result = template.build({
    aspect: doc.aspect,
    slots,
    projectName: doc.name,
    style: brandStyle,
  });
  // A dark document stays dark when a preset is applied again (say Desktop Frames to Mobile
  // Frames) or rebuilt to fill its slots: it takes the preset's own dark fill. A dark frame look
  // marks a dark fill, whether it is a preset's Dark or a dark custom colour.
  if (doc.style.frameAppearance === "dark") {
    setPresetTone(result.style, "dark", templateTones(template));
  }
  return result;
}
