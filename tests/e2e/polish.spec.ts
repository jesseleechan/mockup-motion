import { expect, test } from "@playwright/test";
import { ciTimeout } from "../helpers/ci";
import { waitForStageEngine } from "../helpers/stage-engine";

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

  test("a saved template appears in the gallery's Yours tab and applies from there", async ({
    page,
  }) => {
    await resetAndOpen(page);
    const gallery = page.getByRole("dialog", { name: /Template gallery/ });
    await gallery.getByRole("button", { name: "Try with demo content" }).click();
    await expect(gallery).toBeHidden();
    // With no saved template there is no "Yours" tab, and the Library has no template list.
    // The categories are tabs since R4b (they were toggle buttons).
    await page.getByRole("button", { name: "Templates", exact: true }).click();
    await expect(gallery.getByRole("tab", { name: "All" })).toBeVisible();
    await expect(gallery.getByRole("tab", { name: "Yours" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.locator('aside[data-panel="library"]').getByRole("tab")).toHaveCount(0);

    // The dialog is named by its title, and its labels name their text boxes.
    await page.getByRole("button", { name: "Save as template" }).click();
    const save = page.getByRole("dialog", { name: "Save as template" });
    await save.getByRole("textbox", { name: "Name", exact: true }).fill("Studio reel");
    await save.getByRole("button", { name: "Save template" }).click();
    await expect(save).toBeHidden();

    await page.getByRole("button", { name: "Templates", exact: true }).click();
    await gallery.getByRole("tab", { name: "Yours" }).click();
    const card = gallery.getByRole("button", { name: "Select template Studio reel" });
    await expect(gallery.getByTestId("user-template-card")).toHaveCount(1);
    const savedId = await card.getAttribute("data-template-id");
    // Escape in the rename field cancels the rename and leaves the gallery open.
    await card.getByRole("button", { name: "Rename Studio reel" }).click();
    await gallery.getByLabel("Template name").fill("Something else");
    await page.keyboard.press("Escape");
    await expect(gallery).toBeVisible();
    await expect(card).toBeVisible();
    await card.click();
    await expect(gallery.getByText("Selected: Studio reel")).toBeVisible();
    await gallery.getByRole("button", { name: "Apply template" }).click();
    await expect(gallery).toBeHidden();
    const templateId = await page.evaluate(
      () =>
        (window as unknown as { __editorStore: EditorStore }).__editorStore.getState().doc
          .templateId,
    );
    expect(savedId).toBeTruthy();
    expect(templateId).toBe(savedId);

    // Reopened, the gallery stays on Yours with the template the project uses selected.
    await page.getByRole("button", { name: "Templates", exact: true }).click();
    await expect(gallery.getByText("Selected: Studio reel")).toBeVisible();
    await expect(gallery.getByRole("tab", { name: "Yours" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("WebGL context loss during playback recovers", async ({ page }) => {
    await resetAndOpen(page);
    await page.getByRole("button", { name: "Try with demo content" }).click();
    // The stage lazy-loads its engine, which can take longer than the default 5 s to draw.
    await waitForStageEngine(page);
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
