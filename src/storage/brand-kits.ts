import { getDB } from "./db";

export interface BrandKit {
  id: string;
  name: string;
  colors: string[];
  logoAssetId?: string;
  fontDisplay?: string;
  fontBody?: string;
  updatedAt: number;
}

export async function listBrandKits(): Promise<BrandKit[]> {
  const db = await getDB();
  return db.getAll("brandKits");
}

export async function saveBrandKit(kit: BrandKit): Promise<void> {
  const db = await getDB();
  await db.put("brandKits", kit);
}

export async function deleteBrandKit(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("brandKits", id);
}
