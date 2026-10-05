import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  saveProject,
  loadProject,
  listProjects,
  deleteProject,
  duplicateProject,
  garbageCollectBlobs,
  checkAndMigrateV1,
} from "../src/storage/projects";
import { putBlob, getBlob, listBlobKeys } from "../src/storage/blobs";
import { getDB } from "../src/storage/db";
import { createDoc } from "../src/doc/defaults";
import type { V1Project } from "../src/doc/migrate";
import { V1_PRESETS } from "./fixtures/v1-presets";

describe("WP-01: Storage with fake-indexeddb", () => {
  beforeEach(async () => {
    const db = await getDB();
    const tx = db.transaction(
      ["projects", "blobs", "thumbs", "meta", "brandKits", "userTemplates"],
      "readwrite",
    );
    await Promise.all([
      tx.objectStore("projects").clear(),
      tx.objectStore("blobs").clear(),
      tx.objectStore("thumbs").clear(),
      tx.objectStore("meta").clear(),
      tx.objectStore("brandKits").clear(),
      tx.objectStore("userTemplates").clear(),
    ]);
    await tx.done;
  });

  it("saving a doc 20 times writes each blob exactly once", async () => {
    const doc = createDoc();
    const assetId = "test-blob-1";
    doc.assets.push({
      id: assetId,
      kind: "image",
      name: "Logo.png",
      mime: "image/png",
      bytes: 100,
    });

    const blobData = new Blob(["sample image data"], { type: "image/png" });
    await putBlob(assetId, blobData);

    // Save project 20 times (e.g. rapid user edits)
    for (let i = 0; i < 20; i++) {
      doc.updatedAt = Date.now() + i;
      await saveProject(doc);
    }

    const loaded = await loadProject(doc.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.name).toBe(doc.name);

    // The blob was saved once and remains untouched
    const blobKeys = await listBlobKeys();
    expect(blobKeys).toEqual([assetId]);
    const storedBlob = await getBlob(assetId);
    expect(storedBlob).not.toBeNull();
  });

  it("delete plus garbage collection removes orphaned blobs only", async () => {
    // Project 1 references blob-1
    const p1 = createDoc({ id: "p1", name: "Project 1" });
    p1.assets = [{ id: "blob-1", kind: "image", name: "1.png", mime: "image/png", bytes: 10 }];
    await saveProject(p1);
    await putBlob("blob-1", new Blob(["1"]));

    // Project 2 references blob-2
    const p2 = createDoc({ id: "p2", name: "Project 2" });
    p2.assets = [{ id: "blob-2", kind: "image", name: "2.png", mime: "image/png", bytes: 20 }];
    await saveProject(p2);
    await putBlob("blob-2", new Blob(["2"]));

    // Orphaned blob (e.g. from an aborted upload)
    await putBlob("orphan-blob", new Blob(["orphan"]));

    expect((await listBlobKeys()).sort()).toEqual(["blob-1", "blob-2", "orphan-blob"]);

    // Running GC removes only the orphaned blob
    const removedOrphan = await garbageCollectBlobs();
    expect(removedOrphan).toBe(1);
    expect((await listBlobKeys()).sort()).toEqual(["blob-1", "blob-2"]);

    // Delete Project 1
    await deleteProject("p1");

    // Project 1 is gone, and its orphaned blob-1 was garbage-collected automatically
    expect(await loadProject("p1")).toBeNull();
    expect(await listBlobKeys()).toEqual(["blob-2"]);

    // Project 2 still has its blob
    expect(await loadProject("p2")).not.toBeNull();
    expect(await getBlob("blob-2")).not.toBeNull();
  });

  it("v1 import runs once, imports blobs and migrated doc, and leaves legacy DB untouched", async () => {
    const legacyBlob = new Blob(["legacy image"], { type: "image/png" });

    // Populate legacy DB
    const legacyProject: V1Project = {
      version: 1,
      name: "Legacy Client Site",
      presetId: "clean-hero",
      customized: false,
      aspectRatio: "16:9",
      composition: structuredClone(V1_PRESETS[0].composition),
      images: [
        {
          id: "legacy-img-1",
          name: "old-hero.png",
          url: "",
          blob: legacyBlob,
          width: 1200,
          height: 800,
          aspectRatio: 1.5,
          category: "desktop",
        },
      ],
      exportSettings: {
        resolution: 1080,
        fps: 30,
        quality: "high",
        format: "mp4",
      },
    };

    // Store in legacy 'mockupmotion' database
    const req = indexedDB.open("mockupmotion", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("projects");
    const legacyDB = await new Promise<IDBDatabase>(
      (res) => (req.onsuccess = () => res(req.result)),
    );
    const tx = legacyDB.transaction("projects", "readwrite");
    tx.objectStore("projects").put(legacyProject, "current");
    await new Promise<void>((res) => (tx.oncomplete = () => res()));
    legacyDB.close();

    // Run v1 migration check
    const migrated = await checkAndMigrateV1();
    expect(migrated).not.toBeNull();
    expect(migrated?.name).toBe("Legacy Client Site");
    expect(migrated?.version).toBe(2);

    // Verify blob was transferred to v2 blobs store
    const importedBlob = await getBlob("legacy-img-1");
    expect(importedBlob).not.toBeNull();

    // Verify v2 project list includes it
    const projects = await listProjects();
    expect(projects.some((p) => p.name === "Legacy Client Site")).toBe(true);

    // Running checkAndMigrateV1 a second time returns null (runs only once)
    const secondRun = await checkAndMigrateV1();
    expect(secondRun).toBeNull();

    // Verify legacy database still exists and is completely untouched
    const checkReq = indexedDB.open("mockupmotion", 1);
    const checkedLegacyDB = await new Promise<IDBDatabase>(
      (res) => (checkReq.onsuccess = () => res(checkReq.result)),
    );
    const checkTx = checkedLegacyDB.transaction("projects", "readonly");
    const checkStored = await new Promise<V1Project | undefined>((res) => {
      const getReq = checkTx.objectStore("projects").get("current");
      getReq.onsuccess = () => res(getReq.result);
    });
    checkedLegacyDB.close();

    expect(checkStored).toBeDefined();
    expect(checkStored?.name).toBe("Legacy Client Site");
    expect(checkStored?.version).toBe(1);
  });

  it("duplicateProject creates a distinct copy with new ID", async () => {
    const original = createDoc({ name: "Alpha Project" });
    await saveProject(original);

    const dup = await duplicateProject(original.id);
    expect(dup.id).not.toBe(original.id);
    expect(dup.name).toBe("Alpha Project (Copy)");

    const projects = await listProjects();
    expect(projects.length).toBe(2);
  });
});
