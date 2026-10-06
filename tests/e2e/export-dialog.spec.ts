import { expect, test, type Locator, type Page } from "@playwright/test";
import type { ProjectDoc } from "../../src/doc/types";

// F09: the export dialog's layout, its summary of what will really be written, and cancel.

interface EditorWindow {
  __editorStore?: {
    getState: () => { doc: ProjectDoc; apply: (recipe: (draft: ProjectDoc) => void) => void };
  };
  __liveExportWorkers?: () => number;
  __releaseProbe?: () => void;
}

/** Clears the project database from /lab/ui, then opens the editor with demo content. */
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

/** One static, non-looping 1 s shot, so an export takes 30 frames at 30 fps. */
async function useOneSecondDoc(page: Page) {
  await page.evaluate(() => {
    const store = (window as unknown as EditorWindow).__editorStore;
    if (!store) throw new Error("__editorStore is unavailable");
    store.getState().apply((draft) => {
      draft.shots = draft.shots.slice(0, 1);
      draft.shots[0].duration = 1;
      draft.shots[0].transitionIn = { kind: "cut", duration: 0, easing: "linear" };
      draft.loop = false;
    });
  });
}

async function openExportDialog(page: Page) {
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Export video" })).toBeVisible();
  return dialog;
}

async function choose(page: Page, dialog: Locator, field: string, option: RegExp) {
  await dialog.getByRole("combobox", { name: field }).click();
  await page.getByRole("option", { name: option }).click();
}

interface LayoutReport {
  width: number;
  checked: number;
  fields: number;
  offenders: string[];
}

/**
 * Walks every rendered element of the export dialog (a Radix portal, not a [data-panel]) and
 * lists content cut off by a box that clips or scrolls it, as in ui-overflow.spec.ts, plus every
 * Field whose label box intersects its control box. Exempt from the width check: designated
 * horizontal scroll areas ([data-scroll-x]) and user content ([data-truncate]); screen-reader
 * text is skipped.
 */
async function dialogLayout(page: Page): Promise<LayoutReport> {
  return page.evaluate(() => {
    const root = document.querySelector('[role="dialog"]');
    if (!(root instanceof HTMLElement))
      return { width: 0, checked: 0, fields: 0, offenders: ["no dialog"] };
    const offenders: string[] = [];
    let checked = 0;
    for (const el of [root, ...root.querySelectorAll("*")]) {
      if (!(el instanceof HTMLElement) || el.getClientRects().length === 0) continue;
      checked++;
      const style = getComputedStyle(el);
      if (style.clipPath === "inset(50%)" || style.clip === "rect(0px, 0px, 0px, 0px)") continue;
      const text = (el.innerText || el.getAttribute("aria-label") || "")
        .replace(/\s+/g, " ")
        .slice(0, 60);
      const tag = `<${el.tagName.toLowerCase()} class="${el.className}">`;
      const widthExempt = el.hasAttribute("data-scroll-x") || el.hasAttribute("data-truncate");
      if (!widthExempt && style.overflowX !== "visible" && el.scrollWidth > el.clientWidth + 1) {
        offenders.push(
          `${tag} scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}: "${text}"`,
        );
      }
      if (
        (style.overflowY === "hidden" || style.overflowY === "clip") &&
        style.webkitLineClamp === "none" &&
        el.scrollHeight > el.clientHeight + 1
      ) {
        offenders.push(
          `${tag} scrollHeight ${el.scrollHeight} > clientHeight ${el.clientHeight}: "${text}"`,
        );
      }
    }
    const fields = root.querySelectorAll("[data-field]");
    for (const field of fields) {
      const label = field.querySelector("[data-field-label]")?.getBoundingClientRect();
      const control = field.querySelector("[data-field-control]")?.getBoundingClientRect();
      if (!label || !control) {
        offenders.push(`field without label or control: "${field.textContent}"`);
        continue;
      }
      const overlaps =
        label.left < control.right &&
        control.left < label.right &&
        label.top < control.bottom &&
        control.top < label.bottom;
      if (overlaps) offenders.push(`label overlaps its control: "${field.textContent}"`);
    }
    return { width: root.getBoundingClientRect().width, checked, fields: fields.length, offenders };
  });
}

async function expectCleanLayout(page: Page, context: string, minFields: number) {
  const report = await dialogLayout(page);
  expect(report.width, `${context}: dialog width`).toBe(600);
  // A view that renders almost nothing would pass trivially.
  expect(report.checked, `${context}: elements checked`).toBeGreaterThan(15);
  expect(report.fields, `${context}: fields checked`).toBeGreaterThanOrEqual(minFields);
  expect(report.offenders, `${context}: layout`).toEqual([]);
}

test.describe("F09 export dialog", () => {
  test("layout guard at 1280×800: settings, progress and result views", async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await openEditorWithDemo(page);
    await useOneSecondDoc(page);
    const dialog = await openExportDialog(page);
    const summary = dialog.getByTestId("export-summary");

    await expect(summary).not.toContainText("Checking encoder");
    await expectCleanLayout(page, "Website", 6);
    for (const card of ["Dribbble", "Story", "4K presentation", "Custom"]) {
      await dialog.getByRole("button", { name: card, exact: true }).click();
      await expect(summary).not.toContainText("Checking encoder");
      await expectCleanLayout(page, card, 6);
    }
    for (const format of [/Animated GIF/, /Still frame/, /WebM/]) {
      await choose(page, dialog, "Format", format);
      await expect(summary).not.toContainText("Checking encoder");
      await expectCleanLayout(page, `Format ${format.source}`, 6);
    }
    // The longest option of every select fits on one line (a still frame disables the
    // video-only fields, so it comes last).
    for (const [field, option] of [
      ["Resolution", /1200p/],
      ["Quality", /Master/],
      ["Anti-aliasing", /Sharpest/],
      ["Format", /Still frame/],
    ] as const) {
      await choose(page, dialog, field, option);
      await expectCleanLayout(page, `${field} ${option.source}`, 6);
    }

    await choose(page, dialog, "Format", /WebM/);
    await choose(page, dialog, "Resolution", /720p/);
    await dialog.getByRole("button", { name: "Start export" }).click();
    await expect(dialog.getByText(/Rendering frame \d+ of 30/)).toBeVisible({ timeout: 30_000 });
    await expectCleanLayout(page, "Progress", 0);
    await expect(dialog.getByText("Export complete")).toBeVisible({ timeout: 90_000 });
    await expect(dialog.getByTestId("export-verification")).toContainText("Verified WebM");
    await expectCleanLayout(page, "Result", 0);
  });

  test("the summary shows the probed container, and the file matches it", async ({ page }) => {
    test.setTimeout(120_000);
    // This browser "lacks" H.264, and the probe waits until the test releases it.
    await page.addInitScript(() => {
      const original = VideoEncoder.isConfigSupported.bind(VideoEncoder);
      let release = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      (window as unknown as { __releaseProbe?: () => void }).__releaseProbe = () => release();
      VideoEncoder.isConfigSupported = async (config: VideoEncoderConfig) => {
        await gate;
        if (config.codec.startsWith("avc")) return { supported: false, config };
        return original(config);
      };
    });
    await openEditorWithDemo(page);
    await useOneSecondDoc(page);
    const dialog = await openExportDialog(page);
    const summary = dialog.getByTestId("export-summary");

    await expect(summary).toHaveText("Checking encoder…");
    await expect(dialog.getByRole("button", { name: "Start export" })).toBeDisabled();
    await page.evaluate(() => (window as unknown as EditorWindow).__releaseProbe?.());

    // Website: a bundle with the WebM only, and why.
    await expect(summary).toContainText("Web bundle · WebM");
    await expect(summary).not.toContainText("MP4");
    await expect(dialog.getByRole("status")).toContainText("MP4 isn't available");

    // MP4 asked for, WebM written: every part of the summary says WebM.
    await choose(page, dialog, "Format", /MP4/);
    await choose(page, dialog, "Resolution", /720p/);
    await expect(summary).toContainText("WebM · VP9");
    await expect(summary).toContainText("1280 × 720 · 30 fps · 1.0 s");
    await expect(dialog.getByRole("status")).toContainText("this exports WebM (VP9)");

    await dialog.getByRole("button", { name: "Start export" }).click();
    await expect(dialog.getByText("Export complete")).toBeVisible({ timeout: 90_000 });
    const download = dialog.getByRole("button", { name: /Download/ });
    await expect(download).toHaveAttribute("download", /\.webm$/);
    await expect(download).toHaveText("Download WebM");
    await expect(dialog.getByTestId("export-verification")).toContainText("Verified WebM");
    await expect(dialog.getByTestId("export-verification")).toContainText("1280 × 720");
  });

  test("cancel stops the worker and returns to the settings", async ({ page }) => {
    test.setTimeout(120_000);
    await openEditorWithDemo(page);
    const dialog = await openExportDialog(page);
    await choose(page, dialog, "Format", /WebM/);
    await dialog.getByRole("button", { name: "Start export" }).click();
    await expect(dialog.getByText(/Rendering frame \d+ of \d+/)).toBeVisible({ timeout: 60_000 });
    const workers = () =>
      page.evaluate(() => (window as unknown as EditorWindow).__liveExportWorkers?.() ?? -1);
    expect(await workers(), "one export worker while rendering").toBe(1);

    await dialog.getByRole("button", { name: "Cancel export" }).click();
    await expect(dialog.getByText("Export cancelled.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Start export" })).toBeEnabled();
    await expect(dialog.getByRole("combobox", { name: "Format" })).toHaveText(/WebM/);
    await expect.poll(workers, { message: "no export worker left after cancel" }).toBe(0);
  });
});
