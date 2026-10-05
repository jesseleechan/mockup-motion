import type { ProjectDoc } from "../doc/types";
import { sanitizeDoc } from "../doc/validate";
import { migrateV1Project, type V1Project } from "../doc/migrate";
import { getDB } from "./db";
import { deleteBlob, listBlobKeys, putBlob } from "./blobs";
import type { Project, UploadedImage } from "../types";
import { decodeImage } from "../assets/images";

// ==========================================
// V2 Project Storage API
// ==========================================

export async function listProjects(): Promise<{ id: string; name: string; updatedAt: number }[]> {
  const db = await getDB();
  const tx = db.transaction("projects", "readonly");
  const store = tx.objectStore("projects");
  const index = store.index("by-updated");

  // Read all records using index to sort by updatedAt
  const projects = await index.getAll();
  // Return in descending order (most recently updated first)
  return projects
    .map((p) => ({
      id: p.id,
      name: p.name,
      updatedAt: p.updatedAt,
    }))
    .reverse();
}

export async function loadProject(id: string): Promise<ProjectDoc | null> {
  const db = await getDB();
  const doc = await db.get("projects", id);
  if (!doc) return null;
  const { doc: sanitized } = sanitizeDoc(doc);
  return sanitized;
}

export async function saveProject(doc: ProjectDoc): Promise<void>;
export async function saveProject(project: Project): Promise<void>;
export async function saveProject(item: ProjectDoc | Project): Promise<void> {
  if ("version" in item && item.version === 2) {
    const db = await getDB();
    const { doc } = sanitizeDoc(item);
    await db.put("projects", doc);
    await db.put("meta", doc.id, "lastProjectId");
    return;
  }

  // Legacy v1 save fallback
  return legacySaveProject(item as Project);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("projects", id);
  await db.delete("thumbs", id);
  await garbageCollectBlobs();
}

export async function duplicateProject(id: string): Promise<ProjectDoc> {
  const original = await loadProject(id);
  if (!original) {
    throw new Error(`Project ${id} not found`);
  }

  const now = Date.now();
  const duplicate: ProjectDoc = {
    ...structuredClone(original),
    id: crypto.randomUUID(),
    name: `${original.name} (Copy)`,
    createdAt: now,
    updatedAt: now,
  };

  await saveProject(duplicate);
  return duplicate;
}

export async function putThumb(projectId: string, blob: Blob): Promise<void> {
  const db = await getDB();
  await db.put("thumbs", blob, projectId);
}

export async function getThumb(projectId: string): Promise<Blob | null> {
  const db = await getDB();
  const thumb = await db.get("thumbs", projectId);
  return thumb ?? null;
}

export async function garbageCollectBlobs(): Promise<number> {
  const db = await getDB();
  const allProjects = await db.getAll("projects");
  const referencedAssetIds = new Set<string>();

  for (const project of allProjects) {
    for (const asset of project.assets) {
      referencedAssetIds.add(asset.id);
    }
    if (project.style.background.kind === "ambient" && project.style.background.assetId) {
      referencedAssetIds.add(project.style.background.assetId);
    }
    if (project.style.background.kind === "image" && project.style.background.assetId) {
      referencedAssetIds.add(project.style.background.assetId);
    }
  }

  const allBlobKeys = await listBlobKeys();
  let removedCount = 0;

  for (const key of allBlobKeys) {
    if (!referencedAssetIds.has(key)) {
      await deleteBlob(key);
      removedCount++;
    }
  }

  return removedCount;
}

export async function checkAndMigrateV1(): Promise<ProjectDoc | null> {
  const db = await getDB();
  const alreadyMigrated = await db.get("meta", "migratedFromV1");
  if (alreadyMigrated) return null;

  try {
    const legacyDB = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("mockupmotion", 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (!legacyDB.objectStoreNames.contains("projects")) {
      legacyDB.close();
      await db.put("meta", true, "migratedFromV1");
      return null;
    }

    const v1Stored = await new Promise<V1Project | undefined>((resolve, reject) => {
      const tx = legacyDB.transaction("projects", "readonly");
      const store = tx.objectStore("projects");
      const req = store.get("current");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    legacyDB.close();

    if (!v1Stored) {
      await db.put("meta", true, "migratedFromV1");
      return null;
    }

    // Write image blobs
    if (Array.isArray(v1Stored.images)) {
      for (const img of v1Stored.images) {
        if (img.blob && img.id) {
          await putBlob(img.id, img.blob);
        }
      }
    }

    // Migrate document
    const doc = migrateV1Project(v1Stored as V1Project);
    await saveProject(doc);
    await db.put("meta", true, "migratedFromV1");
    await db.put("meta", doc.id, "lastProjectId");

    return doc;
  } catch (_e) {
    // If legacy DB does not exist or fails, mark migrated
    await db.put("meta", true, "migratedFromV1");
    return null;
  }
}

// ==========================================
// Legacy V1 Project Storage Fallbacks
// ==========================================

interface StoredProject extends Omit<Project, "images"> {
  images: Omit<UploadedImage, "imageElement">[];
}

let legacyDatabase: Promise<IDBDatabase> | undefined;

function openLegacyDatabase() {
  return (legacyDatabase ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("mockupmotion", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("projects");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      legacyDatabase = undefined;
      reject(request.error);
    };
  }));
}

async function legacySaveProject(project: Project) {
  const db = await openLegacyDatabase();
  const stored: StoredProject = {
    ...project,
    images: project.images.map(({ imageElement: _element, url: _url, ...i }) => ({
      ...i,
      url: "",
    })),
  };
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("projects", "readwrite");
    transaction.objectStore("projects").put(stored, "current");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function restoreProject(): Promise<Project | null> {
  const db = await openLegacyDatabase();
  const stored = await new Promise<StoredProject | undefined>((resolve, reject) => {
    const request = db.transaction("projects").objectStore("projects").get("current");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  if (!stored || stored.version !== 1) return null;
  const images = await Promise.all(
    stored.images.map(async (i) => {
      if (!i.blob) throw new Error("A saved screenshot could not be restored.");
      const decoded = await decodeImage(i.blob, i.name, i.id);
      return { ...i, ...decoded, category: i.category, crop: i.crop };
    }),
  );
  return { ...stored, images };
}
