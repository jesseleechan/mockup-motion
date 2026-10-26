import { getDB } from "./db";
import { normalizeStyleAngles } from "../doc/gradient-angle";
import { applyLegacyLook, legacyLook, mapLegacyLayout } from "../doc/legacy-layouts";
import type { Aspect, AssetRef, AssetRole, ProjectDoc, Shot, Style } from "../doc/types";
import { defaultShot } from "../doc/defaults";
import { fitPace, isPacedShot, nearestPace } from "../motion";

export interface UserTemplate {
  id: string;
  name: string;
  description: string;
  style: Style;
  shots: Shot[]; // assetIds replaced with slot keys e.g. "slot:desktop:0"
  loop: boolean;
  createdAt: number;
}

export async function listUserTemplates(): Promise<UserTemplate[]> {
  const db = await getDB();
  return (await db.getAll("userTemplates")).map(normalizeStyleAngles);
}

export async function loadUserTemplate(id: string): Promise<UserTemplate | null> {
  const db = await getDB();
  const t = await db.get("userTemplates", id);
  return t ? normalizeStyleAngles(t) : null;
}

export async function saveUserTemplate(template: UserTemplate): Promise<void> {
  const db = await getDB();
  await db.put("userTemplates", normalizeStyleAngles(template));
}

export async function deleteUserTemplate(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("userTemplates", id);
}

export async function renameUserTemplate(id: string, newName: string): Promise<void> {
  const db = await getDB();
  const t = await db.get("userTemplates", id);
  if (t) {
    t.name = newName;
    await db.put("userTemplates", normalizeStyleAngles(t));
  }
}

/**
 * Converts a ProjectDoc into a reusable UserTemplate by replacing concrete assetIds
 * with slot keys based on their detected roles.
 */
export function convertDocToUserTemplate(
  doc: ProjectDoc,
  name: string,
  description = "Custom user template",
): UserTemplate {
  const assetIdToSlotKey = new Map<string, string>();
  const roleCounts: Record<AssetRole, number> = {
    desktop: 0,
    mobile: 0,
    tablet: 0,
    logo: 0,
    background: 0,
    other: 0,
  };

  for (const asset of doc.assets) {
    const role = asset.role ?? "desktop";
    const idx = roleCounts[role]++;
    assetIdToSlotKey.set(asset.id, `slot:${role}:${idx}`);
  }

  // Helper to replace an assetId with a slot key
  const remapId = (id: string | null | undefined): string => {
    if (!id) return "";
    return assetIdToSlotKey.get(id) ?? id;
  };

  // Clone and replace asset references in shots
  const templatedShots: Shot[] = doc.shots.map((s) => {
    const shot = structuredClone(s);
    const layout = shot.layout;

    switch (layout.kind) {
      case "single":
        layout.assetId = remapId(layout.assetId);
        break;
      case "rows":
      case "columns":
      case "slider":
      case "orbit":
      case "tour":
      case "pageColumns":
        layout.assetIds = layout.assetIds.map(remapId);
        break;
    }

    return shot;
  });

  return {
    id: crypto.randomUUID(),
    name,
    description,
    style: structuredClone(doc.style),
    shots: templatedShots,
    loop: doc.loop,
    createdAt: Date.now(),
  };
}

/**
 * Fills slots in a UserTemplate with target assets by matching roles. `aspect` is the document's:
 * a removed layout maps to a Frames look sized for it.
 */
export function fillUserTemplateSlots(
  template: UserTemplate,
  assets: AssetRef[],
  aspect: Aspect = "16:9",
): { style: Style; shots: Shot[]; loop: boolean } {
  template = normalizeStyleAngles(template);
  // Group available assets by role
  const assetsByRole: Record<string, AssetRef[]> = {
    desktop: [],
    mobile: [],
    tablet: [],
    logo: [],
    background: [],
    other: [],
  };

  for (const a of assets) {
    const role = a.role ?? "desktop";
    if (!assetsByRole[role]) assetsByRole[role] = [];
    assetsByRole[role].push(a);
  }

  // Fallback: any asset
  const anyAsset = assets[0]?.id ?? "";

  const slotKeyToAssetId = new Map<string, string>();

  // Resolve slot key e.g. "slot:desktop:0"
  const resolveSlot = (slotKey: string): string => {
    if (!slotKey) return "";
    if (!slotKey.startsWith("slot:")) return slotKey; // already real id

    if (slotKeyToAssetId.has(slotKey)) {
      return slotKeyToAssetId.get(slotKey)!;
    }

    const parts = slotKey.split(":");
    const role = parts[1] ?? "desktop";
    const idx = parseInt(parts[2] ?? "0", 10);

    const pool = assetsByRole[role] ?? [];
    let chosenId = anyAsset;

    if (pool.length > 0) {
      chosenId = pool[idx % pool.length].id;
    } else if (assets.length > 0) {
      chosenId = assets[idx % assets.length].id;
    }

    slotKeyToAssetId.set(slotKey, chosenId);
    return chosenId;
  };

  // A video has one shot: a template saved from a multi-shot reel keeps its first.
  const shots: Shot[] = withoutTitleCards(template.shots)
    .slice(0, 1)
    .map((s) => {
      const shot = structuredClone(s);
      // Its loop wrap: saved blur, push, zoom and wipe transitions play as fades.
      const wrap = shot.transitionIn.kind as string;
      if (wrap !== "cut" && wrap !== "fade") shot.transitionIn.kind = "fade";

      // A template saved before 19 Oct 2026 may use a removed layout: it takes the preset look a
      // saved project of that kind loads as (src/doc/legacy-layouts.ts).
      const raw = shot.layout as unknown as Record<string, unknown>;
      const look = legacyLook(raw);
      // A template saved before paces existed takes the pace nearest its saved timing, read
      // before its slots resolve (src/motion/pace.ts).
      if (!look && shot.pace === undefined && isPacedShot(shot)) {
        const pace = nearestPace(shot, aspect);
        if (pace !== "default") shot.pace = pace;
      }
      if (look) {
        const ids = Array.isArray(raw.assetIds)
          ? [...new Set(raw.assetIds.map((id) => resolveSlot(String(id))).filter(Boolean))]
          : [];
        const desktopId = typeof raw.desktopId === "string" ? resolveSlot(raw.desktopId) : "";
        shot.layout = mapLegacyLayout(raw, aspect, ids, desktopId);
        applyLegacyLook(shot, look, aspect);
      }

      // Text layers were removed (October 2026); a template saved before then may carry them.
      delete (shot as { texts?: unknown }).texts;
      const layout = shot.layout;

      switch (layout.kind) {
        case "single":
          layout.assetId = resolveSlot(layout.assetId);
          break;
        case "rows":
        case "columns":
          layout.assetIds = layout.assetIds.map(resolveSlot);
          break;
        case "slider":
        case "orbit":
        case "tour":
        case "pageColumns": {
          // Fewer assets than slots reuse one; a stepped layout or a Page Columns shot never shows
          // a screenshot twice (quality bar §4), and its length follows its screenshots so the
          // loop stays seamless.
          layout.assetIds = [...new Set(layout.assetIds.map(resolveSlot).filter(Boolean))];
          break;
        }
      }
      // Its pace sets its step or duration for the screenshots it got.
      fitPace(shot, aspect, assets);

      return shot;
    });

  const style = structuredClone(template.style);
  // Typography was removed (October 2026); a template saved before then may carry its fields.
  delete (style as { fonts?: unknown }).fonts;
  delete (style as { textColor?: unknown }).textColor;

  return {
    style,
    shots: shots.length > 0 ? shots : [defaultShot()],
    loop: template.loop,
  };
}

/** Drops the title cards a template saved before October 2026 may hold. */
function withoutTitleCards(shots: Shot[]): Shot[] {
  return shots.filter((shot) => (shot.layout as { kind: string }).kind !== "title");
}
