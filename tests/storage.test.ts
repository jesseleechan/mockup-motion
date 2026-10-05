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
import type { AssetRef } from "../src/doc/types";
import { V1_PRESETS } from "./fixtures/v1-presets";
import {
  saveBrandKit,
  loadBrandKit,
  getDefaultBrandKit,
  type BrandKit,
} from "../src/storage/brand-kits";
import {
  convertDocToUserTemplate,
  fillUserTemplateSlots,
  saveUserTemplate,
  loadUserTemplate,
  deleteUserTemplate,
  renameUserTemplate,
} from "../src/storage/user-templates";
import { useEditorStore } from "../src/state/store";

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

  describe("WP-13: Brand Kit & User Templates Storage", () => {
    it("brand kit persists across reloads, applies in one undo step, and default kit applies", async () => {
      const kit1: BrandKit = {
        id: "kit-1",
        name: "Acme Corp",
        colors: ["#111111", "#FF5500", "#FFFFFF"],
        fontDisplay: "Fraunces",
        fontBody: "Inter",
        browserUrl: "acme.io",
        isDefault: true,
        updatedAt: Date.now(),
      };
      await saveBrandKit(kit1);

      const loadedKit = await loadBrandKit("kit-1");
      expect(loadedKit).not.toBeNull();
      expect(loadedKit?.name).toBe("Acme Corp");
      expect(loadedKit?.browserUrl).toBe("acme.io");

      const defaultKit = await getDefaultBrandKit();
      expect(defaultKit?.id).toBe("kit-1");

      // Verify applying kit to editor store in one undo step
      const store = useEditorStore;
      const initialDoc = createDoc({ name: "Brand Test Doc" });
      store.getState().loadDoc(initialDoc);

      const beforeTextColor = store.getState().doc.style.textColor;
      const beforeAccent = store.getState().doc.style.accent;

      store.getState().applyBrandKit(kit1);
      expect(store.getState().doc.style.textColor).toBe("#111111");
      expect(store.getState().doc.style.accent).toBe("#FF5500");
      expect(store.getState().doc.style.browserUrl).toBe("acme.io");
      expect(store.getState().doc.style.fonts.display.family).toBe("Fraunces");

      // Undo restores the previous state in one step
      store.getState().undo();
      expect(store.getState().doc.style.textColor).toBe(beforeTextColor);
      expect(store.getState().doc.style.accent).toBe(beforeAccent);

      // Redo reapplies
      store.getState().redo();
      expect(store.getState().doc.style.textColor).toBe("#111111");
      expect(store.getState().doc.style.accent).toBe("#FF5500");
    });

    it("user template replaces asset IDs with slot keys, re-applies to new assets, and persists", async () => {
      const doc = createDoc({ name: "Responsive Template Doc" });
      const desktopAsset: AssetRef = {
        id: "asset-desktop-1",
        name: "hero.png",
        kind: "image",
        mime: "image/png",
        bytes: 1000,
        role: "desktop",
      };
      const mobileAsset: AssetRef = {
        id: "asset-mobile-1",
        name: "mobile.png",
        kind: "image",
        mime: "image/png",
        bytes: 500,
        role: "mobile",
      };
      doc.assets = [desktopAsset, mobileAsset];
      doc.shots[0].layout = {
        kind: "pair",
        desktopId: "asset-desktop-1",
        mobileId: "asset-mobile-1",
        arrangement: "overlap",
      };

      // Convert doc to template
      const template = convertDocToUserTemplate(doc, "Responsive Showcase", "Pair layout demo");
      expect(template.name).toBe("Responsive Showcase");

      // Check slot keys
      const templatedLayout = template.shots[0].layout;
      expect(templatedLayout.kind).toBe("pair");
      if (templatedLayout.kind === "pair") {
        expect(templatedLayout.desktopId).toBe("slot:desktop:0");
        expect(templatedLayout.mobileId).toBe("slot:mobile:0");
      }

      // Save to IndexedDB
      await saveUserTemplate(template);
      const retrieved = await loadUserTemplate(template.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe("Responsive Showcase");

      // Fill slots with a completely different project's assets
      const newDesktop: AssetRef = {
        id: "client-desktop-99",
        name: "client.png",
        kind: "image",
        mime: "image/png",
        bytes: 2000,
        role: "desktop",
      };
      const newMobile: AssetRef = {
        id: "client-mobile-99",
        name: "client-m.png",
        kind: "image",
        mime: "image/png",
        bytes: 800,
        role: "mobile",
      };

      const filled = fillUserTemplateSlots(retrieved!, [newDesktop, newMobile]);
      expect(filled.shots.length).toBe(1);
      const filledLayout = filled.shots[0].layout;
      expect(filledLayout.kind).toBe("pair");
      if (filledLayout.kind === "pair") {
        expect(filledLayout.desktopId).toBe("client-desktop-99");
        expect(filledLayout.mobileId).toBe("client-mobile-99");
      }

      // Cleanup
      await deleteUserTemplate(template.id);
      expect(await loadUserTemplate(template.id)).toBeNull();
    });
  });
});

it("F02 legacy user-template load, list and slot fill normalize angles once", async () => {
  const doc = createDoc();
  doc.style.background = { kind: "gradient", stops: ["#000000", "#FFFFFF"], angle: 145 };
  doc.shots[0].styleOverrides = {
    background: { kind: "gradient", stops: ["#000000", "#FFFFFF"], angle: 180 },
  };
  const template = convertDocToUserTemplate(doc, "Legacy F02");
  // Write the old shape directly to represent a saved template predating F02.
  const db = await getDB();
  await db.put("userTemplates", template);
  const loaded = await loadUserTemplate(template.id);
  expect(loaded?.style.background).toMatchObject({ angle: 305, angleConvention: "css" });
  expect(loaded?.shots[0].styleOverrides?.background).toMatchObject({
    angle: 270,
    angleConvention: "css",
  });
  const filled = fillUserTemplateSlots(template, []);
  expect(filled.style.background).toMatchObject({ angle: 305, angleConvention: "css" });
  const { listUserTemplates } = await import("../src/storage/user-templates");
  const listed = (await listUserTemplates()).find((t) => t.id === template.id);
  expect(listed?.style.background).toEqual(loaded?.style.background);
  if (!loaded) throw new Error("Saved template not found");
  await saveUserTemplate(loaded);
  expect((await loadUserTemplate(template.id))?.style.background).toEqual(loaded.style.background);
});

it("F02 saves user-template CSS angles with a durable idempotent marker", async () => {
  const doc = createDoc();
  doc.style.background = { kind: "gradient", stops: ["#000000", "#FFFFFF"], angle: 150 };
  const template = convertDocToUserTemplate(doc, "Legacy save F02");
  await saveUserTemplate(template);
  const db = await getDB();
  const stored = await db.get("userTemplates", template.id);
  expect(stored?.style.background).toMatchObject({ angle: 300, angleConvention: "css" });
  if (!stored) throw new Error("Template not saved");
  await saveUserTemplate(stored);
  expect((await db.get("userTemplates", template.id))?.style.background).toEqual(
    stored.style.background,
  );
});

it("F02 rename writes canonical legacy user-template angles", async () => {
  const doc = createDoc();
  doc.style.background = { kind: "gradient", stops: ["#000000", "#FFFFFF"], angle: 135 };
  doc.shots[0].styleOverrides = {
    background: { kind: "gradient", stops: ["#000000", "#FFFFFF"], angle: 180 },
  };
  const template = convertDocToUserTemplate(doc, "Before rename");
  const db = await getDB();
  await db.put("userTemplates", template);
  await renameUserTemplate(template.id, "After rename");
  const stored = await db.get("userTemplates", template.id);
  expect(stored?.name).toBe("After rename");
  expect(stored?.style.background).toMatchObject({ angle: 315, angleConvention: "css" });
  expect(stored?.shots[0].styleOverrides?.background).toMatchObject({
    angle: 270,
    angleConvention: "css",
  });
});
