import { getDB } from "./db";
import { normalizeStyleAngles } from "../doc/gradient-angle";
import type { AssetRef, AssetRole, ProjectDoc, Shot, Style } from "../doc/types";
import { clampSliderStep, sliderDuration } from "../motion";

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
      case "pair":
        layout.desktopId = remapId(layout.desktopId);
        layout.mobileId = remapId(layout.mobileId);
        break;
      case "trio":
        layout.desktopId = remapId(layout.desktopId);
        if (layout.tabletId) layout.tabletId = remapId(layout.tabletId);
        layout.mobileId = remapId(layout.mobileId);
        break;
      case "rows":
      case "columns":
      case "wall":
      case "stack":
      case "slider":
        layout.assetIds = layout.assetIds.map(remapId);
        break;
      case "title":
        break;
    }

    if (shot.texts) {
      for (const t of shot.texts) {
        if (t.logoAssetId) {
          t.logoAssetId = remapId(t.logoAssetId);
        }
      }
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
 * Fills slots in a UserTemplate with target assets by matching roles.
 */
export function fillUserTemplateSlots(
  template: UserTemplate,
  assets: AssetRef[],
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

  const shots: Shot[] = template.shots.map((s) => {
    const shot = structuredClone(s);
    const layout = shot.layout;

    switch (layout.kind) {
      case "single":
        layout.assetId = resolveSlot(layout.assetId);
        break;
      case "pair":
        layout.desktopId = resolveSlot(layout.desktopId);
        layout.mobileId = resolveSlot(layout.mobileId);
        break;
      case "trio":
        layout.desktopId = resolveSlot(layout.desktopId);
        if (layout.tabletId) layout.tabletId = resolveSlot(layout.tabletId);
        layout.mobileId = resolveSlot(layout.mobileId);
        break;
      case "rows":
      case "columns":
      case "wall":
      case "stack":
        layout.assetIds = layout.assetIds.map(resolveSlot);
        break;
      case "slider": {
        // Fewer assets than slots reuse one; a slider never shows a screenshot twice
        // (quality bar §4), and its length follows its screenshots so the loop stays native.
        layout.assetIds = [...new Set(layout.assetIds.map(resolveSlot).filter(Boolean))];
        layout.step = clampSliderStep(layout.step, layout.assetIds.length);
        shot.duration = sliderDuration(layout);
        break;
      }
      case "title":
        break;
    }

    if (shot.texts) {
      for (const t of shot.texts) {
        if (t.logoAssetId) {
          t.logoAssetId = resolveSlot(t.logoAssetId);
        }
      }
    }

    return shot;
  });

  return {
    style: structuredClone(template.style),
    shots,
    loop: template.loop,
  };
}
