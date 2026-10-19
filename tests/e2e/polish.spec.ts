import { expect, test } from "@playwright/test";
import { ciTimeout } from "../helpers/ci";

interface EditorStore {
  getState: () => {
    doc: { id: string; templateId?: string; assets: { role?: string }[] };
    past: unknown[];
  };
}

async function resetAndOpen(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase("mockupmotion-v2");
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });
  await page.goto("/");
}

test.describe("WP-18 polish", () => {
  test("first run opens on the gallery; its demo content applies the selected preset", async ({
    page,
  }) => {
    await resetAndOpen(page);
    const gallery = page.getByRole("dialog", { name: /Template gallery/ });
    await expect(gallery).toBeVisible();
    // Closing it leaves the empty state, which can open it again.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "Create a presentation" })).toBeVisible();
    await page.getByRole("button", { name: "Start with a template" }).click();
    await expect(gallery).toBeVisible();

    await gallery.getByRole("button", { name: "Select template Mobile Slider" }).click();
    await gallery.getByRole("button", { name: "Try with demo content" }).click();
    await expect(gallery).toBeHidden();
    // Mobile Slider with the mobile demo screenshots, in one undo step.
    const state = () =>
      page.evaluate(() => {
        const store = (window as unknown as { __editorStore: EditorStore }).__editorStore;
        const { doc, past } = store.getState();
        return {
          templateId: doc.templateId,
          roles: doc.assets.map((a) => a.role),
          undoSteps: past.length,
        };
      });
    await expect.poll(async () => (await state()).roles.length).toBeGreaterThanOrEqual(3);
    const applied = await state();
    expect(applied.templateId).toBe("mobile-slider");
    expect(new Set(applied.roles)).toEqual(new Set(["mobile"]));
    expect(applied.undoSteps).toBe(1);
    await expect(page.locator("canvas").first()).toBeVisible();

    // A returning user lands on their last project, not on the gallery.
    const projectId = await page.evaluate(
      () => (window as unknown as { __editorStore: EditorStore }).__editorStore.getState().doc.id,
    );
    // Reload once the project is in storage: autosave waits 600 ms, then writes. The save label
    // is a UI detail; the stored project is what the reload reads.
    await expect
      .poll(
        () =>
          page.evaluate(
            (id) =>
              new Promise<boolean>((resolve, reject) => {
                const req = indexedDB.open("mockupmotion-v2");
                req.onerror = () => reject(req.error);
                req.onsuccess = () => {
                  const db = req.result;
                  const get = db
                    .transaction("projects", "readonly")
                    .objectStore("projects")
                    .get(id);
                  get.onerror = () => reject(get.error);
                  get.onsuccess = () => {
                    db.close();
                    resolve(get.result !== undefined);
                  };
                };
              }),
            projectId,
          ),
        { timeout: ciTimeout(5_000), message: "the project is saved before the reload" },
      )
      .toBe(true);
    await page.reload();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { __editorStore: EditorStore }).__editorStore.getState().doc.id,
        ),
      )
      .toBe(projectId);
    expect((await state()).templateId).toBe("mobile-slider");
    await expect(gallery).toBeHidden();
  });

  test("WebGL context loss during playback recovers", async ({ page }) => {
    await resetAndOpen(page);
    await page.getByRole("button", { name: "Try with demo content" }).click();
    await expect(page.locator("canvas").first()).toBeVisible();
    await page.getByRole("button", { name: "Play" }).first().click();

    await page.evaluate(() => {
      const canvas = document.querySelector("canvas") as HTMLCanvasElement;
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      const ext = gl?.getExtension("WEBGL_lose_context");
      (window as unknown as { __glExt?: WEBGL_lose_context }).__glExt = ext ?? undefined;
      ext?.loseContext();
    });
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      (window as unknown as { __glExt?: WEBGL_lose_context }).__glExt?.restoreContext();
    });
    await expect(page.locator("canvas").first()).toBeVisible();
    await page.getByRole("button", { name: "Pause" }).first().click();
  });
});
