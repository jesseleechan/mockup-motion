import { expect, test, type Page } from "@playwright/test";
import type { Layout, ProjectDoc } from "../../src/doc/types";

// Presets P04 and Frames plan PF03: a Frames shot (rows or columns with travel "period") shows
// no speed or tilt slider, and its duration control cannot go below the shortest duration under
// the speed limit.

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

type FramesLayout = Extract<Layout, { kind: "rows" | "columns" }>;
// Omit on each member of the union, so a case can hold either layout.
type WithoutAssets<T> = T extends unknown ? Omit<T, "assetIds"> : never;

interface FramesCase {
  name: string;
  /** The layout at 4:5; `assetIds` is filled with the demo screenshots in the page. */
  layout: WithoutAssets<FramesLayout>;
  /** framesDuration for four screenshots at 4:5. */
  minimum: number;
  /** framesDuration for eleven screenshots, of which only the first ten fit 30 s. */
  capped: number;
}

const CASES: FramesCase[] = [
  {
    // Four at 4:5: 4 × (0.32 × 1.6 + 0.065) / 0.20 = 11.54 s, so 12 s. Ten: 28.85 s, so 29 s.
    name: "Desktop Frames",
    layout: {
      kind: "rows",
      rows: 3,
      device: "card",
      tilt: 0,
      speed: 0.35,
      cardHeight: 0.32,
      gap: 0.065,
      travel: "period",
    },
    minimum: 12,
    capped: 29,
  },
  {
    // Four at 4:5: 4 × (0.246 / 0.4615 + 0.065) / 0.20 = 11.96 s, so 12 s. Ten: 29.9 s, so 30 s.
    name: "Mobile Frames",
    layout: {
      kind: "columns",
      columns: 3,
      device: "card",
      tilt: 0,
      speed: 0.35,
      cardWidth: 0.246,
      gap: 0.065,
      travel: "period",
    },
    minimum: 12,
    capped: 30,
  },
];

async function setFramesShot(page: Page, c: FramesCase, count: number, duration: number) {
  await page.evaluate(
    ({ layout, count, duration }) => {
      const store = (window as unknown as EditorWindow).__editorStore;
      if (!store) throw new Error("__editorStore is unavailable");
      store.getState().apply((draft) => {
        const ids = draft.assets.filter((a) => a.kind === "image").map((a) => a.id);
        draft.aspect = "4:5";
        draft.shots = draft.shots.slice(0, 1);
        draft.shots[0].duration = duration;
        draft.shots[0].layout = {
          ...layout,
          assetIds: Array.from({ length: count }, (_, i) => ids[i % ids.length]),
        } as FramesLayout;
      });
    },
    { layout: c.layout, count, duration },
  );
}

for (const c of CASES) {
  test(`a ${c.name} shot replaces the speed and tilt sliders and keeps its minimum duration`, async ({
    page,
  }) => {
    await openEditorWithDemo(page);
    await setFramesShot(page, c, 4, 15);

    await page.locator(".group", { hasText: "Shot 1" }).click();
    await expect(page.getByText("Speed follows shot length")).toBeVisible();
    await expect(page.getByRole("slider", { name: "Speed" })).toHaveCount(0);
    // Frames has no tilt by design (quality bar §4); the lane count stays editable.
    await expect(page.getByRole("slider", { name: "Tilt" })).toHaveCount(0);
    await expect(
      page.getByRole("combobox", {
        name: c.layout.kind === "rows" ? "Rows" : "Columns",
        exact: true,
      }),
    ).toBeVisible();

    const duration = page.getByRole("slider", { name: "Duration" });
    await expect(duration).toHaveAttribute("aria-valuemin", String(c.minimum));
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
      .toBe(c.minimum);
  });

  test(`a ${c.name} shot with more screenshots than fit 30 s shows the first ones and says so`, async ({
    page,
  }) => {
    await openEditorWithDemo(page);
    // Eleven at 4:5: only ten fit 30 s at 0.20 frame heights per second (quality bar §2.2).
    await setFramesShot(page, c, 11, 30);

    await page.locator(".group", { hasText: "Shot 1" }).click();
    await expect(
      page.getByText("Shows the first 10 screenshots, so the loop fits in 30 s."),
    ).toBeVisible();
    await expect(page.getByRole("slider", { name: "Duration" })).toHaveAttribute(
      "aria-valuemin",
      String(c.capped),
    );
  });
}
