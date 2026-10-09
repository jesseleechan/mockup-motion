import { expect, test, type Page } from "@playwright/test";
import type { ProjectDoc } from "../../src/doc/types";
import type { Engine } from "../../src/engine/Engine";

// Suggestion 3 of docs/phone-frames-plan/README.md §8: the slider and Frames presets switch
// between their flat light (Ash) and dark (Onyx) backgrounds in the Video inspector.

const ASH = [223, 225, 227];
const ONYX = [20, 20, 23];

interface EditorWindow {
  __editorStore?: { getState: () => { doc: ProjectDoc } };
  __editorEngine?: Engine;
}

/** First run → gallery → the template → demo content, then the Video inspector. */
async function openTemplate(page: Page, templateId: string): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
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
  await page.getByRole("button", { name: "Start with a template" }).click();
  await page.locator(`[data-testid="template-card"][data-template-id="${templateId}"]`).click();
  await page.getByRole("button", { name: "Apply template" }).click();
  await page.getByRole("button", { name: "Use demo content" }).click();
  await expect
    .poll(
      () =>
        page.evaluate(() => (window as EditorWindow).__editorStore?.getState().doc.assets.length),
      {
        timeout: 20_000,
      },
    )
    .toBeGreaterThan(0);
  await page
    .locator('[data-panel="inspector"]')
    .getByRole("button", { name: "Video", exact: true })
    .click();
}

const docStyle = (page: Page) =>
  page.evaluate(() => {
    const style = (window as EditorWindow).__editorStore?.getState().doc.style;
    if (!style) throw new Error("No editor store");
    return style;
  });

/** The most common colour of the editor's rendered frame: the background on a Frames shot. */
const dominantColour = (page: Page) =>
  page.evaluate(() => {
    const { __editorEngine: engine, __editorStore: store } = window as EditorWindow;
    // The stage publishes its engine once it has mounted; poll until then.
    if (!engine || !store) return null;
    engine.renderAt(store.getState().doc.shots[0].duration * 0.5);
    const pixels = engine.readPixels();
    const counts = new Map<number, number>();
    for (let i = 0; i < pixels.length; i += 4) {
      const key = (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2];
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const [key] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return [(key >> 16) & 255, (key >> 8) & 255, key & 255];
  });

test("Desktop Frames switches to a dark background in one click, and undo brings Ash back", async ({
  page,
}) => {
  await openTemplate(page, "frames");

  const tone = page.getByRole("radiogroup", { name: "Background tone" });
  const light = tone.getByRole("radio", { name: "Light" });
  const dark = tone.getByRole("radio", { name: "Dark" });
  await expect(light).toHaveAttribute("aria-checked", "true");
  await expect(dark).toHaveAttribute("aria-checked", "false");
  await expect.poll(() => dominantColour(page), { timeout: 20_000 }).toEqual(ASH);

  await dark.click();
  await expect(dark).toHaveAttribute("aria-checked", "true");
  const style = await docStyle(page);
  expect(style.background).toEqual({ kind: "solid", color: "#141417" });
  expect(style.frameAppearance).toBe("dark");
  expect([style.grain, style.vignette, style.shadow]).toEqual([0, 0, "none"]);
  await expect.poll(() => dominantColour(page), { timeout: 20_000 }).toEqual(ONYX);

  // One undo step restores the light look.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(light).toHaveAttribute("aria-checked", "true");
  expect((await docStyle(page)).background).toEqual({ kind: "solid", color: "#DFE1E3" });
  await expect.poll(() => dominantColour(page), { timeout: 20_000 }).toEqual(ASH);
});

test("documents not made from the four presets have no tone switch", async ({ page }) => {
  await openTemplate(page, "scroll-story");
  await expect(page.getByRole("button", { name: "Bone" })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Background tone" })).toHaveCount(0);
});
