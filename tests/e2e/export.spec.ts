import { expect, test, type Page } from "@playwright/test";
import type { ExportSettings, ProjectDoc } from "../../src/doc/types";
import { keepResourceTimings } from "../helpers/resource-timing";
import { BLANK_PAGE } from "../helpers/blank-page";

// The specs below find the app's Mediabunny module in the resource-timing entries.
test.beforeEach(async ({ page }) => {
  await keepResourceTimings(page);
});

// F09: export correctness (every destination preset) and the
// export dialog (layout, truthful summary, cancel).

interface Media {
  ALL_FORMATS: unknown;
  BlobSource: new (blob: Blob) => unknown;
  Input: new (options: { source: unknown; formats: unknown }) => {
    getPrimaryVideoTrack(): Promise<{
      displayWidth: number;
      displayHeight: number;
      codec: string | null;
    } | null>;
    computeDuration(): Promise<number>;
    dispose(): void;
  };
  CanvasSink: new (track: unknown) => {
    getCanvas(time: number): Promise<{ canvas: HTMLCanvasElement | OffscreenCanvas } | null>;
  };
  canEncodeVideo(
    codec: "avc" | "vp9",
    options: { width: number; height: number },
  ): Promise<boolean>;
}

type ExportFn = (
  doc: ProjectDoc,
  provider: unknown,
  settings: ExportSettings,
) => Promise<{ blob: Blob; mime: string }>;

interface LabWindow {
  __labReady?: boolean;
  __fixtures?: Record<string, ProjectDoc>;
  __exportWithEngine?: ExportFn;
  __createLabAssetProvider?: () => {
    getImage(id: string, maxWidth: number): Promise<ImageBitmap>;
    getText: unknown;
  };
  __labTestImages?: {
    quadrants(w: number, h: number): Promise<ImageBitmap>;
    bands(w: number, h: number, colors: string[]): Promise<ImageBitmap>;
  };
  __f09Media?: Media;
}

interface EditorWindow {
  __editorStore?: {
    getState: () => { doc: ProjectDoc; apply: (recipe: (draft: ProjectDoc) => void) => void };
  };
  __liveExportWorkers?: () => number;
  __releaseProbe?: () => void;
  __f09Media?: Media;
}

/** The app's own optimized Mediabunny module, loaded once the page has used it. */
async function loadMediabunny(page: Page) {
  await page.evaluate(async () => {
    const entry = performance
      .getEntriesByType("resource")
      .find((resource) => new URL(resource.name).pathname.endsWith("/deps/mediabunny.js"));
    if (!entry) throw new Error("The app's optimized Mediabunny module was not loaded");
    (window as unknown as LabWindow).__f09Media = await import(/* @vite-ignore */ entry.name);
  });
}

/** Clears the project database from a blank page, then opens the editor with demo content. */
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

/** One static, non-looping 1 s shot, so an export takes 30 frames at 30 fps. */
async function useOneSecondDoc(page: Page) {
  await page.evaluate(() => {
    const store = (window as unknown as EditorWindow).__editorStore;
    if (!store) throw new Error("__editorStore is unavailable");
    store.getState().apply((draft) => {
      draft.shots = draft.shots.slice(0, 1);
      // The first-run demo is Desktop Slider (presets D1), whose length follows its screenshots
      // (contracts.md §5), so the shot shows the first screenshot in one browser instead.
      draft.shots[0].layout = { kind: "single", device: "browser", assetId: draft.assets[0].id };
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

interface ExportedVideo {
  name: string;
  width: number;
  height: number;
  duration: number;
  codec: string | null;
}

/** Re-reads the downloaded file with Mediabunny; a web bundle is unzipped first. */
async function readDownload(page: Page, href: string): Promise<ExportedVideo[]> {
  await loadMediabunny(page);
  return page.evaluate(async (url) => {
    const media = (window as unknown as EditorWindow).__f09Media;
    if (!media) throw new Error("Mediabunny is unavailable");
    const blob = await (await fetch(url)).blob();
    const files: { name: string; blob: Blob }[] = [];
    if (blob.type === "application/zip") {
      // A dev-server module path, resolved by the browser
      const fflatePath = "/node_modules/fflate/esm/browser.js";
      const { unzipSync } = await import(/* @vite-ignore */ fflatePath);
      const entries = unzipSync(new Uint8Array(await blob.arrayBuffer())) as Record<
        string,
        Uint8Array<ArrayBuffer>
      >;
      for (const [name, bytes] of Object.entries(entries)) {
        if (name.endsWith(".mp4") || name.endsWith(".webm"))
          files.push({ name, blob: new Blob([bytes]) });
      }
    } else {
      files.push({ name: blob.type, blob });
    }
    const videos = [];
    for (const file of files) {
      const input = new media.Input({
        source: new media.BlobSource(file.blob),
        formats: media.ALL_FORMATS,
      });
      try {
        const track = await input.getPrimaryVideoTrack();
        if (!track) throw new Error(`${file.name} has no video track`);
        videos.push({
          name: file.name,
          width: track.displayWidth,
          height: track.displayHeight,
          duration: await input.computeDuration(),
          codec: track.codec,
        });
      } finally {
        input.dispose();
      }
    }
    return videos;
  }, href);
}

async function canEncode(page: Page, codec: "avc" | "vp9", width: number, height: number) {
  await loadMediabunny(page);
  return page.evaluate(
    ({ codec, width, height }) =>
      (window as unknown as EditorWindow).__f09Media!.canEncodeVideo(codec, { width, height }),
    { codec, width, height },
  );
}

const PRESETS = [
  { card: "Website", width: 1920, height: 1080, bundle: true },
  { card: "Dribbble", width: 1600, height: 1200, bundle: false },
  { card: "Instagram", width: 1080, height: 1350, bundle: false },
  { card: "Story", width: 1080, height: 1920, bundle: false },
  { card: "LinkedIn & X", width: 1920, height: 1080, bundle: false },
  { card: "4K presentation", width: 3840, height: 2160, bundle: false },
  { card: "Custom", width: 1920, height: 1080, bundle: false },
] as const;

const ONE_FRAME = 1 / 30;

test.describe("F09 destination presets export at their size and length", () => {
  for (const preset of PRESETS) {
    test(`${preset.card}: ${preset.width}×${preset.height}`, async ({ page }) => {
      // Timeouts allow for the GitHub runner, about 5x slower than a local SwiftShader run;
      // a bundle renders two videos.
      const exportTimeout = preset.width >= 3840 ? 540_000 : preset.bundle ? 300_000 : 200_000;
      test.setTimeout(exportTimeout + 120_000);
      await openEditorWithDemo(page);
      await useOneSecondDoc(page);
      const dialog = await openExportDialog(page);
      await dialog.getByRole("button", { name: preset.card, exact: true }).click();
      const switchAspect = dialog.getByRole("button", { name: /^Switch to / });
      if (await switchAspect.isVisible()) await switchAspect.click();
      const summary = dialog.getByTestId("export-summary");
      await expect(summary).toContainText(`${preset.width} × ${preset.height}`);
      await expect(summary).not.toContainText("Checking encoder");

      await dialog.getByRole("button", { name: "Start export" }).click();
      await expect(dialog.getByText("Export complete")).toBeVisible({
        timeout: exportTimeout,
      });
      const download = dialog.getByRole("link", { name: /Download/ });
      const filename = (await download.getAttribute("download")) ?? "";
      const videos = await readDownload(page, (await download.getAttribute("href"))!);

      const avc = await canEncode(page, "avc", preset.width, preset.height);
      const vp9 = await canEncode(page, "vp9", preset.width, preset.height);
      const expected = preset.bundle
        ? [avc && "mp4", vp9 && "webm"].filter(Boolean)
        : [avc ? "mp4" : "webm"];
      expect(filename.endsWith(preset.bundle ? ".zip" : `.${expected[0]}`), filename).toBe(true);
      expect(videos.map((v) => (/avc|h264/i.test(v.codec ?? "") ? "mp4" : "webm"))).toEqual(
        expected,
      );
      for (const video of videos) {
        expect([video.width, video.height], video.name).toEqual([preset.width, preset.height]);
        expect(
          Math.abs(video.duration - 1),
          `${video.name} duration ${video.duration}`,
        ).toBeLessThanOrEqual(ONE_FRAME + 0.001);
      }
      await expect(dialog.getByTestId("export-verification")).not.toContainText("did not verify");
    });
  }
});
