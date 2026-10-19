import { expect, test, type Page } from "@playwright/test";
import type { Layout, ProjectDoc } from "../../src/doc/types";
import { BLANK_PAGE } from "../helpers/blank-page";

// Presets P04 and Frames plan PF03: a Frames shot (rows or columns with travel "period") shows
// no speed or tilt slider, and its pace (P5) cannot take it below the shortest duration under
// the speed limit.

interface EditorWindow {
  __editorStore?: {
    getState: () => { doc: ProjectDoc; apply: (recipe: (draft: ProjectDoc) => void) => void };
  };
}

async function openEditorWithDemo(page: Page) {
  await page.goto(BLANK_PAGE);
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
  test(`a ${c.name} shot replaces the speed and tilt sliders and sets its length by pace`, async ({
    page,
  }) => {
    await openEditorWithDemo(page);
    await setFramesShot(page, c, 4, 15);

    await page.getByTestId("shot-card").click();
    const pace = page.getByRole("radiogroup", { name: "Pace" });
    await expect(pace).toBeVisible();
    await expect(page.getByRole("slider", { name: "Speed" })).toHaveCount(0);
    // Frames has no tilt by design (quality bar §4); the lane count stays editable.
    await expect(page.getByRole("slider", { name: "Tilt" })).toHaveCount(0);
    await expect(
      page.getByRole("combobox", {
        name: c.layout.kind === "rows" ? "Rows" : "Columns",
        exact: true,
      }),
    ).toBeVisible();

    // The pace sets the length, so the inspector shows it as a read-out, not a control.
    await expect(page.getByRole("slider", { name: "Duration" })).toHaveCount(0);
    await expect(page.getByText("Loop length", { exact: true })).toBeVisible();
    await expect(page.getByText("15.0 s", { exact: true })).toBeVisible();
    // Brisk is 15 s × 0.8 = 12 s, which is exactly this shot's minimum, so the shot lands on it.
    // The clamp below the minimum is covered by tests/pace.test.ts.
    await pace.getByRole("radio", { name: "Brisk" }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as EditorWindow).__editorStore?.getState().doc.shots[0].duration,
        ),
      )
      .toBe(c.minimum);
    await expect(page.getByText(`${c.minimum.toFixed(1)} s`, { exact: true })).toBeVisible();
  });

  test(`a ${c.name} shot with more screenshots than fit 30 s shows the first ones and says so`, async ({
    page,
  }) => {
    await openEditorWithDemo(page);
    // Eleven at 4:5: only ten fit 30 s at 0.20 frame heights per second (quality bar §2.2).
    await setFramesShot(page, c, 11, 30);

    await page.getByTestId("shot-card").click();
    await expect(
      page.getByText("Shows the first 10 screenshots, so the loop fits in 30 s."),
    ).toBeVisible();
    // Default is the speed limit for the ten shown, so Brisk can't be faster.
    await expect(page.getByText(`${c.capped.toFixed(1)} s`, { exact: true })).toBeVisible();
    await expect(
      page.getByRole("radiogroup", { name: "Pace" }).getByRole("radio", { name: "Brisk" }),
    ).toHaveAttribute("aria-disabled", "true");
  });
}

test("changing the aspect re-fits both Frames presets, and one undo restores them", async ({
  page,
}) => {
  await openEditorWithDemo(page);
  // Mobile Frames made at 9:16 (2 columns, 16.5 s for six screenshots) and Desktop Frames made
  // at 9:16 (3 rows). At 16:9 they take 5 columns, 19.5 s, and 2 rows (Frames plan D13). A
  // video has one shot, so each preset gets its own round.
  const presets = [
    {
      duration: 16.5,
      layout: {
        kind: "columns",
        columns: 2,
        device: "card",
        tilt: 0,
        cardWidth: 0.222,
        gap: 0.065,
        travel: "period",
      },
      count: 6,
      refit: { columns: 5, cardWidth: 0.269, duration: 19.5 },
    },
    {
      duration: 15,
      layout: {
        kind: "rows",
        rows: 3,
        device: "card",
        tilt: 0,
        cardHeight: 0.32,
        gap: 0.065,
        travel: "period",
      },
      count: 4,
      refit: { rows: 2, cardHeight: 0.42, duration: 15 },
    },
  ] as const;
  const state = () =>
    page.evaluate(() => {
      const doc = (window as unknown as EditorWindow).__editorStore?.getState().doc;
      if (!doc) throw new Error("__editorStore is unavailable");
      return {
        aspect: doc.aspect,
        shot: { ...doc.shots[0].layout, duration: doc.shots[0].duration },
      };
    });
  const aspect = (label: string) =>
    page
      .getByRole("radiogroup", { name: "Aspect ratio" })
      .getByRole("radio", { name: label, exact: true })
      .click();

  for (const preset of presets) {
    await page.evaluate(
      ({ duration, layout, count }) => {
        const store = (window as unknown as EditorWindow).__editorStore;
        if (!store) throw new Error("__editorStore is unavailable");
        store.getState().apply((draft) => {
          const ids = draft.assets.filter((a) => a.kind === "image").map((a) => a.id);
          draft.aspect = "9:16";
          draft.shots[0].duration = duration;
          draft.shots[0].layout = {
            ...layout,
            assetIds: Array.from({ length: count }, (_, i) => ids[i % ids.length]),
          } as FramesLayout;
        });
      },
      { duration: preset.duration, layout: preset.layout, count: preset.count },
    );
    await expect.poll(async () => (await state()).aspect).toBe("9:16");
    const before = await state();

    await aspect("16:9");
    await expect.poll(async () => (await state()).aspect).toBe("16:9");
    expect((await state()).shot, preset.layout.kind).toMatchObject(preset.refit);

    await page.getByRole("button", { name: "Undo" }).click();
    expect(await state(), preset.layout.kind).toEqual(before);
  }
});

test("the pace sets a Frames shot's length in one undo step and explains an unavailable pace", async ({
  page,
}) => {
  await openEditorWithDemo(page);
  // Mobile Frames at 16:9 with six screenshots: Default is the 19.5 s speed limit, so Brisk is
  // unavailable, and Calm is 19.5 s × 1.2, 23.5 s (quality bar §2.2).
  await page.evaluate(() => {
    const store = (window as unknown as EditorWindow).__editorStore;
    if (!store) throw new Error("__editorStore is unavailable");
    store.getState().apply((draft) => {
      const ids = draft.assets.filter((a) => a.kind === "image").map((a) => a.id);
      draft.aspect = "16:9";
      draft.shots = draft.shots.slice(0, 1);
      delete draft.shots[0].pace;
      draft.shots[0].layout = {
        kind: "columns",
        assetIds: Array.from({ length: 6 }, (_, i) => ids[i % ids.length]),
        columns: 5,
        device: "card",
        tilt: 0,
        cardWidth: 0.269,
        gap: 0.065,
        travel: "period",
      };
    });
  });
  const duration = () =>
    page.evaluate(
      () => (window as unknown as EditorWindow).__editorStore?.getState().doc.shots[0].duration,
    );

  await page.getByTestId("shot-card").click();
  const pace = page.getByRole("radiogroup", { name: "Pace" });
  const option = (label: string) => pace.getByRole("radio", { name: label, exact: true });
  await expect(option("Default")).toHaveAttribute("aria-checked", "true");
  await expect(option("Calm")).toHaveAttribute("aria-checked", "false");
  expect(await duration()).toBe(19.5);

  // The unavailable option stays focusable, so its reason shows on focus and reaches screen
  // readers.
  const reason = "Already at the speed limit";
  await expect(option("Brisk")).toHaveAttribute("aria-disabled", "true");
  await expect(option("Brisk")).toHaveAccessibleDescription(reason);
  await option("Brisk").focus();
  await expect(page.getByRole("tooltip")).toHaveText(reason);
  await page.keyboard.press("Enter");
  expect(await duration()).toBe(19.5);
  await expect(option("Default")).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  await option("Calm").hover();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await option("Brisk").hover();
  await expect(page.getByRole("tooltip")).toHaveText(reason);

  // A click sets the pace; the loop length follows; one undo restores it.
  await option("Calm").click();
  await expect.poll(duration).toBe(23.5);
  await expect(option("Calm")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("23.5 s", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(duration).toBe(19.5);
  await expect(option("Default")).toHaveAttribute("aria-checked", "true");

  // From the keyboard: the arrow keys reach the next option with a visible focus ring, Enter
  // sets it. (Space plays the video everywhere in the editor, docs/plan/follow-ups.md.)
  await option("Default").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(option("Calm")).toBeFocused();
  expect(
    await option("Calm").evaluate(
      (el) => el.matches(":focus-visible") && getComputedStyle(el).boxShadow !== "none",
    ),
  ).toBe(true);
  await page.keyboard.press("Enter");
  await expect.poll(duration).toBe(23.5);
});
