import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
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

  test("rejects corrupt and oversized screenshots", async ({ page }) => {
    await resetAndOpen(page);
    await page.getByRole("button", { name: "Try with demo content" }).click();
    await expect(page.locator("canvas").first()).toBeVisible();
    await page.getByRole("tab", { name: "Media" }).click();

    const input = page.getByTestId("media-input");
    await input.setInputFiles({
      name: "broken.png",
      mimeType: "image/png",
      buffer: Buffer.from("this is not a png"),
    });
    await expect(page.getByText(/couldn't be read/)).toBeVisible();

    await input.setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello"),
    });
    await expect(page.getByText(/PNG, JPG, WebP, or AVIF/)).toBeVisible();

    await input.setInputFiles({
      name: "huge.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(35 * 1024 * 1024 + 8, 1),
    });
    await expect(page.getByText(/below 35 MB/)).toBeVisible();
  });

  test("storage quota surfaces a calm error and keeps the editor usable", async ({ page }) => {
    await resetAndOpen(page);
    await page.getByRole("button", { name: "Try with demo content" }).click();
    await expect(page.locator("canvas").first()).toBeVisible();

    await page.evaluate(() => {
      IDBObjectStore.prototype.put = function put() {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      };
    });

    const name = page
      .getByRole("textbox", { name: /project name/i })
      .or(page.locator("input").first());
    await name.fill("Quota check");
    await name.press("Enter");
    await expect(page.getByTestId("save-error")).toContainText(/storage is full/i, {
      timeout: 8_000,
    });
    await expect(page.locator("canvas").first()).toBeVisible();
  });

  test("projects can be duplicated and deleted", async ({ page }) => {
    await resetAndOpen(page);
    await page.getByRole("button", { name: "Try with demo content" }).click();
    await expect(page.locator("canvas").first()).toBeVisible();
    await expect(page.getByText(/^Saved$/)).toBeVisible({ timeout: 8_000 });

    await page.getByRole("button", { name: /MockupMotion/i }).click();
    await page.getByRole("menuitem", { name: /Projects/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const before = await dialog.getByRole("button", { name: "Duplicate project" }).count();

    await dialog.getByRole("button", { name: "Duplicate project" }).first().click();
    await expect(dialog.getByRole("button", { name: "Duplicate project" })).toHaveCount(before + 1);

    await expect(dialog.getByText(/\(Copy\)/)).toBeVisible();
    page.once("dialog", (d) => d.accept());
    const copyCard = dialog
      .getByText(/\(Copy\)/)
      .locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]");
    await copyCard.getByRole("button", { name: "Delete project" }).click();
    await expect(dialog.getByRole("button", { name: "Duplicate project" })).toHaveCount(before);
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

  test("cancels an export and survives context loss while exporting", async ({ page }) => {
    test.setTimeout(90_000);
    await resetAndOpen(page);
    await page.getByRole("button", { name: "Try with demo content" }).click();
    await expect(page.locator("canvas").first()).toBeVisible();

    await page.getByRole("button", { name: "Export", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Start export" }).click();
    await expect(dialog.getByRole("button", { name: "Cancel export" })).toBeVisible();

    await page.evaluate(() => {
      const canvas = document.querySelector("canvas") as HTMLCanvasElement;
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    });

    await dialog.getByRole("button", { name: "Cancel export" }).click();
    await expect(dialog.getByText("Export cancelled.")).toBeVisible({ timeout: 20_000 });
    await page.keyboard.press("Escape");
    await expect(page.locator("canvas").first()).toBeVisible();
  });

  test("editor has no serious axe violations and respects reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await resetAndOpen(page);
    await page.getByRole("button", { name: "Try with demo content" }).click();
    await expect(page.locator("canvas").first()).toBeVisible();

    const duration = await page.evaluate(() => {
      const el = document.querySelector("button");
      if (!el) return 1;
      return parseFloat(getComputedStyle(el).transitionDuration) || 0;
    });
    expect(duration).toBeLessThan(0.05);

    const results = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious).toEqual([]);
  });
});
