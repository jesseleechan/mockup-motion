import { getDB } from "./db";

export async function putBlob(assetId: string, blob: Blob): Promise<void> {
  const db = await getDB();
  await db.put("blobs", blob, assetId);
}

export async function getBlob(assetId: string): Promise<Blob | null> {
  const db = await getDB();
  const blob = await db.get("blobs", assetId);
  return blob ?? null;
}

export async function deleteBlob(assetId: string): Promise<void> {
  const db = await getDB();
  await db.delete("blobs", assetId);
}

export async function listBlobKeys(): Promise<string[]> {
  const db = await getDB();
  const keys = await db.getAllKeys("blobs");
  return keys.map(String);
}
