import { expect, test, type Page } from "@playwright/test";
import type { ProjectDoc } from "../../src/doc/types";

// Presets P04: a Frames shot (rows with travel "period") shows no speed slider, and its
// duration control cannot go below the shortest duration under the speed limit.

interface EditorWindow {
  __editorStore?: {
    getState: () => { doc: ProjectDoc; apply: (recipe: (draft: ProjectDoc) => void) => void };
  };
}

async function openEditorWithDemo(page: Page) {
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
  await page.getByRole("button", { name: "Try with demo content" }).click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as unknown as EditorWindow).__editorStore?.getState().doc.assets.length ?? 0,
        ),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
}

test("a Frames shot replaces the speed slider and keeps its minimum duration", async ({ page }) => {
  await openEditorWithDemo(page);
  // Four demo screenshots at 4:5: 4 × (0.32 × 1.6 + 0.065) / 0.20 = 11.54 s, so 12 s.
  await page.evaluate(() => {
    const store = (window as unknown as EditorWindow).__editorStore;
    if (!store) throw new Error("__editorStore is unavailable");
    store.getState().apply((draft) => {
      const ids = draft.assets.filter((a) => a.kind === "image").map((a) => a.id);
      draft.aspect = "4:5";
      draft.shots = draft.shots.slice(0, 1);
      draft.shots[0].duration = 15;
      draft.shots[0].layout = {
        kind: "rows",
        assetIds: [0, 1, 2, 3].map((i) => ids[i % ids.length]),
        rows: 3,
        device: "card",
        tilt: 0,
        speed: 0.35,
        cardHeight: 0.32,
        gap: 0.065,
        travel: "period",
      };
    });
  });

  await page.locator(".group", { hasText: "Shot 1" }).click();
  await expect(page.getByText("Speed follows shot length")).toBeVisible();
  await expect(page.getByRole("slider", { name: "Speed" })).toHaveCount(0);

  const duration = page.getByRole("slider", { name: "Duration" });
  await expect(duration).toHaveAttribute("aria-valuemin", "12");
  await expect(duration).toHaveAttribute("aria-valuenow", "15");
  // Home moves the thumb to the minimum; the shot keeps the Frames minimum, not 1 s.
  await duration.focus();
  await page.keyboard.press("Home");
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as EditorWindow).__editorStore?.getState().doc.shots[0].duration,
      ),
    )
    .toBe(12);
});

test("a Frames shot with more screenshots than fit 30 s shows the first ones and says so", async ({
  page,
}) => {
  await openEditorWithDemo(page);
  // Eleven at 4:5: only ten fit 30 s at 0.20 frame heights per second (quality bar §2.2), and
  // ten take 10 × (0.32 × 1.6 + 0.065) / 0.20 = 28.85 s, so 29 s.
  await page.evaluate(() => {
    const store = (window as unknown as EditorWindow).__editorStore;
    if (!store) throw new Error("__editorStore is unavailable");
    store.getState().apply((draft) => {
      const ids = draft.assets.filter((a) => a.kind === "image").map((a) => a.id);
      draft.aspect = "4:5";
      draft.shots = draft.shots.slice(0, 1);
      draft.shots[0].duration = 30;
      draft.shots[0].layout = {
        kind: "rows",
        assetIds: Array.from({ length: 11 }, (_, i) => ids[i % ids.length]),
        rows: 3,
        device: "card",
        tilt: 0,
        speed: 0.35,
        cardHeight: 0.32,
        gap: 0.065,
        travel: "period",
      };
    });
  });

  await page.locator(".group", { hasText: "Shot 1" }).click();
  await expect(
    page.getByText("Shows the first 10 screenshots, so the loop fits in 30 s."),
  ).toBeVisible();
  await expect(page.getByRole("slider", { name: "Duration" })).toHaveAttribute(
    "aria-valuemin",
    "29",
  );
});
