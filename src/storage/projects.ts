import type { Project, UploadedImage } from "../types";
import { decodeImage } from "../assets/images";
interface StoredProject extends Omit<Project, "images"> {
  images: Omit<UploadedImage, "imageElement">[];
}
let database: Promise<IDBDatabase> | undefined;
function openDatabase() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("mockupmotion", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("projects");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      database = undefined;
      reject(request.error);
    };
  }));
}
export async function saveProject(project: Project) {
  const db = await openDatabase();
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
  const db = await openDatabase();
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
