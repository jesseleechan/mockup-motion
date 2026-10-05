import { getDB } from "./db";

export interface BrandKit {
  id: string;
  name: string;
  colors: string[]; // up to 6 colors
  logoLightAssetId?: string;
  logoDarkAssetId?: string;
  fontDisplay?: string;
  fontBody?: string;
  browserUrl?: string;
  isDefault?: boolean;
  updatedAt: number;
}

export async function listBrandKits(): Promise<BrandKit[]> {
  const db = await getDB();
  return db.getAll("brandKits");
}

export async function loadBrandKit(id: string): Promise<BrandKit | null> {
  const db = await getDB();
  const kit = await db.get("brandKits", id);
  return kit ?? null;
}

export async function saveBrandKit(kit: BrandKit): Promise<void> {
  const db = await getDB();
  if (kit.isDefault) {
    // Unset any other default kit
    const all = await db.getAll("brandKits");
    for (const other of all) {
      if (other.id !== kit.id && other.isDefault) {
        other.isDefault = false;
        await db.put("brandKits", other);
      }
    }
  }
  await db.put("brandKits", kit);
}

export async function deleteBrandKit(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("brandKits", id);
}

export async function getDefaultBrandKit(): Promise<BrandKit | null> {
  const db = await getDB();
  const all = await db.getAll("brandKits");
  return all.find((k) => k.isDefault) ?? (all.length > 0 ? all[0] : null);
}

export async function setDefaultBrandKit(id: string): Promise<void> {
  const db = await getDB();
  const all = await db.getAll("brandKits");
  for (const kit of all) {
    const shouldBeDefault = kit.id === id;
    if (kit.isDefault !== shouldBeDefault) {
      kit.isDefault = shouldBeDefault;
      await db.put("brandKits", kit);
    }
  }
}
