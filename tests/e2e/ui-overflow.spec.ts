import { expect, test, type Page } from "@playwright/test";
import type { CameraPresetId, Layout, ProjectDoc } from "../../src/doc/types";
import type { Engine } from "../../src/engine/Engine";
import { CAMERA_LABELS, EASING_LABELS } from "../../src/editor/labels";
import { BLANK_PAGE } from "../helpers/blank-page";
import { ciTimeout } from "../helpers/ci";

interface StoreHandle {
  getState: () => { doc: ProjectDoc };
}

interface EditorStoreHandle {
  getState: () => { doc: ProjectDoc; apply: (recipe: (draft: ProjectDoc) => void) => void };
}

interface UIStoreHandle {
  getState: () => {
    setSelection: (selection: { kind: "video" } | { kind: "shot"; id: string }) => void;
  };
}

type Theme = "dark" | "light";

const PANELS = ["library", "inspector", "timeline"] as const;

// Desktop Frames and Mobile Frames at 16:9 (src/templates/frames-template.ts), without assets.
type FramesLayout = Extract<Layout, { kind: "rows" | "columns" }>;
// Omit on each member of the union, so the list can hold either layout.
type WithoutAssets<T> = T extends unknown ? Omit<T, "assetIds"> : never;
const FRAMES_LAYOUTS: WithoutAssets<FramesLayout>[] = [
  {
    kind: "rows",
    rows: 2,
    device: "card",
    tilt: 0,
    cardHeight: 0.42,
    gap: 0.065,
    travel: "period",
  },
  {
    kind: "columns",
    columns: 5,
    device: "card",
    tilt: 0,
    cardWidth: 0.269,
    gap: 0.065,
    travel: "period",
  },
];

async function resetAndOpen(page: Page, theme: Theme) {
  await page.goto(BLANK_PAGE);
  await page.evaluate(async (theme) => {
    localStorage.clear();
    sessionStorage.clear();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase("mockupmotion-v2");
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("deleteDatabase blocked"));
    });
    // EditorShell reads the saved theme on load, as after a user toggles it.
    localStorage.setItem("mockupmotion_theme", theme);
  }, theme);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

/** Applies a template from the gallery and fills its slots with demo screenshots. */
async function applyTemplateWithDemo(page: Page, templateId: string) {
  await page.getByRole("button", { name: "Start with a template" }).click();
  await page.locator(`[data-testid="template-card"][data-template-id="${templateId}"]`).click();
  await page.getByRole("button", { name: "Apply template" }).click();
  await page.getByRole("button", { name: "Use demo content" }).click();
  // Setup, not the check under test: decoding the demo screenshots took over 5 s on the
  // GitHub runner (F08 PR run), while it takes about 1 s locally.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const store = (window as unknown as { __editorStore?: StoreHandle }).__editorStore;
          return store?.getState().doc.assets.length ?? 0;
        }),
      { timeout: 20000 },
    )
    .toBeGreaterThan(0);
}

/** The shot looks the inspector shows: a single browser and a phone. */
type ShotLook = "browser" | "phone";
const SHOT_LOOKS: ShotLook[] = ["browser", "phone"];

/** Scroll Story with its demo screenshot: one single-browser shot. */
async function openStory(page: Page) {
  await applyTemplateWithDemo(page, "scroll-story");
}

/**
 * Gives the video's one shot `look`, keeping its screenshot. Set through the store, as no
 * template builds a phone.
 */
async function setShotLook(page: Page, look: ShotLook, camera?: CameraPresetId) {
  await page.evaluate(
    ({ look, camera }) => {
      const store = (window as unknown as { __editorStore?: EditorStoreHandle }).__editorStore;
      if (!store) throw new Error("__editorStore is unavailable");
      store.getState().apply((draft) => {
        const shot = draft.shots[0];
        const assetId = draft.assets.find((a) => a.kind === "image")?.id ?? "";
        shot.layout = { kind: "single", device: look, assetId };
        if (camera) shot.camera.preset = camera;
      });
    },
    { look, camera },
  );
}
async function currentDoc(page: Page): Promise<ProjectDoc> {
  return page.evaluate(() => {
    const store = (window as unknown as { __editorStore?: StoreHandle }).__editorStore;
    if (!store) throw new Error("__editorStore is unavailable");
    return store.getState().doc;
  });
}

async function select(page: Page, selection: { kind: "video" } | { kind: "shot"; id: string }) {
  await page.evaluate((selection) => {
    const ui = (window as unknown as { __uiStore?: UIStoreHandle }).__uiStore;
    if (!ui) throw new Error("__uiStore is unavailable");
    ui.getState().setSelection(selection);
  }, selection);
}

interface PanelReport {
  panel: string;
  checked: number;
  offenders: string[];
}

/**
 * Walks every rendered element inside each [data-panel] root and lists those that cut content
 * off: content wider than a box that clips or scrolls it (overflow-x is not visible), or taller
 * than a box that hides it (overflow-y hidden). An element with visible overflow hides nothing
 * itself; whatever spills past a clipping ancestor, up to the panel root, makes that ancestor
 * fail. Exempt from the width check: designated horizontal scroll containers ([data-scroll-x])
 * and user content that may truncate with an ellipsis ([data-truncate]). Screen-reader-only
 * text is clipped to 1 px on purpose and is skipped.
 */
async function overflowReport(
  page: Page,
  panels: readonly (typeof PANELS)[number][],
): Promise<PanelReport[]> {
  return page.evaluate((panels) => {
    return panels.map((name) => {
      const root = document.querySelector(`[data-panel="${name}"]`);
      if (!root)
        return { panel: name, checked: 0, offenders: [`[data-panel="${name}"] is missing`] };
      const offenders: string[] = [];
      let checked = 0;
      for (const el of [root, ...root.querySelectorAll("*")]) {
        if (!(el instanceof HTMLElement) || el.getClientRects().length === 0) continue;
        checked++;
        const style = getComputedStyle(el);
        if (style.clipPath === "inset(50%)" || style.clip === "rect(0px, 0px, 0px, 0px)") continue;
        const text = () =>
          (el.innerText || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").slice(0, 60);
        const tag = `<${el.tagName.toLowerCase()} class="${el.className}">`;
        const widthExempt = el.hasAttribute("data-scroll-x") || el.hasAttribute("data-truncate");
        if (!widthExempt && style.overflowX !== "visible" && el.scrollWidth > el.clientWidth + 1) {
          offenders.push(
            `${tag} scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}: "${text()}"`,
          );
        }
        // Content cut off at the bottom by a box that hides it (scroll containers scroll, and
        // line-clamped text ends in an ellipsis on purpose).
        if (
          (style.overflowY === "hidden" || style.overflowY === "clip") &&
          style.webkitLineClamp === "none" &&
          el.scrollHeight > el.clientHeight + 1
        ) {
          offenders.push(
            `${tag} scrollHeight ${el.scrollHeight} > clientHeight ${el.clientHeight}: "${text()}"`,
          );
        }
      }
      return { panel: name, checked, offenders };
    });
  }, panels);
}

async function expectNoOverflow(
  page: Page,
  context: string,
  panels: readonly (typeof PANELS)[number][] = PANELS,
) {
  const reports = await overflowReport(page, panels);
  for (const report of reports) {
    // A panel that renders almost nothing would pass trivially.
    expect(report.checked, `${context}: elements checked in ${report.panel}`).toBeGreaterThan(20);
    expect(report.offenders, `${context}: overflow in ${report.panel}`).toEqual([]);
  }
}

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1600, height: 1000 },
];
const THEMES: Theme[] = ["dark", "light"];

test.describe("F08 overflow guard", () => {
  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`no clipped text in the panels at ${viewport.width}×${viewport.height}, ${theme}${viewport.width === 1280 ? " @smoke" : ""}`, async ({
        page,
      }) => {
        test.setTimeout(90000);
        await page.setViewportSize(viewport);
        await resetAndOpen(page, theme);
        await openStory(page);
        const inspector = page.locator('[data-panel="inspector"]');

        await select(page, { kind: "video" });
        await expect(inspector.getByText("Composition", { exact: true })).toBeVisible();
        await expectNoOverflow(page, "Video inspector");

        // Every section of a single-device shot: Scroll Story's shot already scrolls.
        const shotId = (await currentDoc(page)).shots[0].id;
        await select(page, { kind: "shot", id: shotId });
        await expect(inspector.getByRole("switch", { name: "Scroll through page" })).toBeChecked();
        await expect(inspector.getByText("Hold", { exact: true })).toBeVisible();
        await expectNoOverflow(page, "Shot inspector, scroll");

        // Each look in turn: a browser and a phone show different sections.
        for (const look of SHOT_LOOKS) {
          await setShotLook(page, look);
          await select(page, { kind: "shot", id: shotId });
          await expect(inspector.getByText("Shot 1", { exact: true })).toBeVisible();
          await expectNoOverflow(page, `${look} shot inspector`);
        }

        // The other library tab.
        await page.getByRole("tab", { name: "Media" }).click();
        await expectNoOverflow(page, "Media tab");

        // Both Frames presets, whose speed row holds the loop length chips: the shot takes a
        // Desktop Frames, then a Mobile Frames layout with six screenshots. The inspector only.
        for (const layout of FRAMES_LAYOUTS) {
          await page.evaluate(
            ({ id, layout }) => {
              const store = (window as unknown as { __editorStore?: EditorStoreHandle })
                .__editorStore;
              if (!store) throw new Error("__editorStore is unavailable");
              store.getState().apply((draft) => {
                const shot = draft.shots.find((s) => s.id === id);
                if (!shot) throw new Error("no shot");
                const assetId = draft.assets.find((a) => a.kind === "image")?.id ?? "";
                shot.duration = 30;
                shot.layout = {
                  ...layout,
                  assetIds: Array.from({ length: 6 }, () => assetId),
                } as FramesLayout;
              });
            },
            { id: shotId, layout },
          );
          await select(page, { kind: "shot", id: shotId });
          await expect(inspector.getByRole("group", { name: "Loop length" })).toBeVisible();
          await expectNoOverflow(page, `${layout.kind} Frames inspector`, ["inspector"]);
        }
      });
    }
  }
});

// Enum ids that are camelCase can only reach the UI by mistake (e.g. "pushIn").
const RAW_ENUM_IDS = [CAMERA_LABELS, EASING_LABELS]
  .flatMap((labels) => Object.keys(labels))
  .filter((id) => /[a-z][A-Z]/.test(id));
// Layout node ids, e.g. "row1:item3", "col0:item2", "single:0".
const NODE_ID = String.raw`\\b(?:single|row\\d+|col\\d+):[a-z0-9]+`;
const RAW_ID = new RegExp(String.raw`pushIn|row\\d+:col\\d+|${NODE_ID}|${RAW_ENUM_IDS.join("|")}`);

async function expectNoRawIds(page: Page, context: string) {
  const text = await page.evaluate(() => document.body.innerText);
  expect(text.match(RAW_ID)?.[0] ?? null, `${context}: raw id in the UI`).toBeNull();
}

test("the UI shows human labels, never raw preset or node ids", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await resetAndOpen(page, "dark");
  await openStory(page);
  const shotId = (await currentDoc(page)).shots[0].id;

  // Each look, on the camera moves with camelCase ids. Set through the store, so the checks
  // below don't depend on finding the labels first.
  await select(page, { kind: "video" });
  await expectNoRawIds(page, "Video inspector");
  const timeline = page.locator('[data-panel="timeline"]');
  const inspector = page.locator('[data-panel="inspector"]');
  for (const [look, camera] of [
    ["browser", "pushIn"],
    ["phone", "static"],
  ] as const) {
    await setShotLook(page, look, camera);
    await select(page, { kind: "shot", id: shotId });
    await expectNoRawIds(page, `${look} shot inspector`);
  }

  // The human labels are the ones the task names.
  await setShotLook(page, "browser", "pushIn");
  await expect(timeline.getByText("Browser · Push in")).toBeVisible();
  await setShotLook(page, "phone", "static");
  await select(page, { kind: "shot", id: shotId });
  await expect(inspector.getByRole("radio", { name: "Still", exact: true })).toBeChecked();

  // The drop hint over a Frames row, whose nodes are "row1:item0" and so on.
  await resetAndOpen(page, "dark");
  await applyTemplateWithDemo(page, "frames");
  const assetId = (await currentDoc(page)).assets[0].id;
  const canvas = page.locator('[data-testid="stage"] canvas');
  await expect(canvas).toBeVisible();
  const hint = page.getByTestId("drop-hint");
  await expect
    .poll(
      async () => {
        // Drag a Media item over a Frames card. The stage centre can fall between cards (at
        // 16:9 it is the gap between the two rows), so ask the engine for a point on a row card.
        // The result names what the poll is still waiting for, so a timeout says which.
        return canvas.evaluate((el, assetId) => {
          const engine = (window as unknown as { __editorEngine?: Engine }).__editorEngine;
          if (!engine || !(el instanceof HTMLCanvasElement)) return "the stage engine is not ready";
          const rect = el.getBoundingClientRect();
          let target: { x: number; y: number } | null = null;
          for (let y = el.height * 0.1; y < el.height * 0.9 && !target; y += el.height / 20) {
            for (let x = el.width * 0.1; x < el.width * 0.9 && !target; x += el.width / 20) {
              if (engine.pick(x, y)?.nodeId.startsWith("row")) target = { x, y };
            }
          }
          if (!target) return "no Frames card on the stage yet";
          const dataTransfer = new DataTransfer();
          dataTransfer.setData("application/x-mockup-asset-id", assetId);
          el.dispatchEvent(
            new DragEvent("dragover", {
              bubbles: true,
              cancelable: true,
              clientX: rect.left + (target.x * rect.width) / el.width,
              clientY: rect.top + (target.y * rect.height) / el.height,
              dataTransfer,
            }),
          );
          return "dragged over a Frames card";
        }, assetId);
      },
      {
        // The engine picks Frames cards once its first frame is drawn, which the CI runner's
        // SwiftShader reaches about 5x later than a laptop (tests/helpers/ci.ts).
        timeout: ciTimeout(5000),
        message: "the engine finds a Frames row card to drag over",
      },
    )
    .toBe("dragged over a Frames card");
  await expect(hint).toBeVisible();
  await expectNoRawIds(page, "Stage drop hint");
  await expect(hint).toHaveText("Drop to use this screenshot");
});
