import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ProjectDoc } from "../doc/types";
import type { BrandKit } from "./brand-kits";
import type { UserTemplate } from "./user-templates";

export interface MockupMotionDB extends DBSchema {
  projects: {
    key: string;
    value: ProjectDoc;
    indexes: { "by-updated": number };
  };
  blobs: {
    key: string;
    value: Blob;
  };
  thumbs: {
    key: string;
    value: Blob;
  };
  meta: {
    key: string;
    value: unknown;
  };
  brandKits: {
    key: string;
    value: BrandKit;
  };
  userTemplates: {
    key: string;
    value: UserTemplate;
  };
}

export const DB_NAME = "mockupmotion-v2";
export const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<MockupMotionDB>> | null = null;

export async function getDB(): Promise<IDBPDatabase<MockupMotionDB>> {
  if (dbPromise) return dbPromise;

  dbPromise = openDB<MockupMotionDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("projects")) {
        const store = db.createObjectStore("projects", { keyPath: "id" });
        store.createIndex("by-updated", "updatedAt");
      }
      if (!db.objectStoreNames.contains("blobs")) {
        db.createObjectStore("blobs");
      }
      if (!db.objectStoreNames.contains("thumbs")) {
        db.createObjectStore("thumbs");
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta");
      }
      if (!db.objectStoreNames.contains("brandKits")) {
        db.createObjectStore("brandKits", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("userTemplates")) {
        db.createObjectStore("userTemplates", { keyPath: "id" });
      }
    },
  });

  return dbPromise;
}

export async function closeDB(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}

export function resetDBPromise(): void {
  dbPromise = null;
}
