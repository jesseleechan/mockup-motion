import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type { AssetRef, ProjectDoc } from "../../src/doc/types";

const AURELIA = path.resolve("public/demo/aurelia");

interface StoreHandle {
  getState: () => { doc: ProjectDoc };
}

async function resetEditor(page: Page) {
  await page.goto("/lab/ui");
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase("mockupmotion-v2");
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("deleteDatabase blocked"));
    });
  });
  await page.goto("/");
  await expect(page.getByTestId("stage")).toBeVisible();
}

async function storedAssets(page: Page): Promise<AssetRef[]> {
  return page.evaluate(() => {
    const store = (window as unknown as { __editorStore?: StoreHandle }).__editorStore;
    if (!store) throw new Error("__editorStore is unavailable");
    return store.getState().doc.assets;
  });
}

/**
 * Writes a captures folder the way the capture command names it (Aurelia's pages, plus a stray
 * text file) and returns its path.
 */
function writeCapturesFolder(dir: string): string {
  const folder = path.join(dir, "captures");
  fs.mkdirSync(folder, { recursive: true });
  const files: [string, string][] = [
    ["desktop-full.webp", "aurelia-desktop-1440-full.webp"],
    ["desktop-hero.webp", "aurelia-desktop-1440.webp"],
    ["sections.json", "aurelia-desktop-1440.json"],
    ["mobile-full.webp", "aurelia-mobile-390@2x-full.webp"],
    ["sections-mobile.json", "aurelia-mobile-390@2x.json"],
  ];
  for (const [from, to] of files) fs.copyFileSync(path.join(AURELIA, from), path.join(folder, to));
  fs.writeFileSync(path.join(folder, "notes.txt"), "notes");
  return folder;
}

test("a dropped captures folder imports its full pages with roles and sections; paste imports an image", async ({
  page,
}, testInfo) => {
  const folder = writeCapturesFolder(testInfo.outputPath());
  await resetEditor(page);
  // A first run opens the template gallery; drag once the editor has settled under it.
  await expect(page.getByRole("dialog")).toBeVisible();

  // A real OS drop of a folder, which the page reads through webkitGetAsEntry.
  const cdp = await page.context().newCDPSession(page);
  const drag = (type: string) =>
    cdp.send("Input.dispatchDragEvent", {
      type: type as "dragEnter",
      x: 640,
      y: 360,
      data: { items: [], files: [folder], dragOperationsMask: 1 },
    });
  await drag("dragEnter");
  await drag("dragOver");
  await expect(page.getByTestId("import-drop-overlay")).toContainText("Drop to add to the library");
  await drag("drop");
  await expect(page.getByTestId("import-drop-overlay")).toHaveCount(0);
  await expect(page.getByText("Not imported: notes.txt.", { exact: false })).toBeVisible();
  await expect(page.getByText("Skipped 1 viewport capture", { exact: false })).toBeVisible();
  await expect.poll(async () => (await storedAssets(page)).length).toBe(2);
  const assets = await storedAssets(page);
  const desktop = assets.find((a) => a.name === "aurelia-desktop-1440-full.webp");
  const mobile = assets.find((a) => a.name === "aurelia-mobile-390@2x-full.webp");
  // The full-page desktop capture is taller than wide; its name makes it desktop.
  expect(desktop?.role).toBe("desktop");
  expect(mobile?.role).toBe("mobile");
  expect(desktop?.meta?.sections?.length).toBeGreaterThan(0);
  expect(mobile?.meta?.sections?.length).toBeGreaterThan(0);

  // ⌘V / Ctrl+V outside a field and with no dialog open imports the clipboard's image.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.evaluate(async () => {
    const blob = await (await fetch("/demo/aurelia/mobile-hero.webp")).blob();
    const data = new DataTransfer();
    data.items.add(new File([blob], "image.webp", { type: "image/webp" }));
    document.body.dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }),
    );
  });
  await expect.poll(async () => (await storedAssets(page)).length).toBe(3);
  const pasted = (await storedAssets(page)).find((a) => a.name === "Pasted screenshot.webp");
  expect(pasted?.role).toBe("mobile");
});
