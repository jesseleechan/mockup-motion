import { expect, test, type Page } from "@playwright/test";
import type { ExportSettings, ProjectDoc } from "../../src/doc/types";
import { quadrantCentroids, type PixelBuffer } from "../helpers/pixels";

// F09: export correctness (motion blur with transitions, multi-device exports, every
// destination preset) and the export dialog (layout, truthful summary, cancel).

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
    getAudio?: unknown;
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

async function openLab(page: Page) {
  await page.goto("/lab?fixture=device-card-frontal&t=0&aspect=16:9");
  await page.waitForFunction(() => (window as unknown as LabWindow).__labReady === true);
  await loadMediabunny(page);
}

test.describe("F09 export correctness", () => {
  test("motion blur keeps a fade transition in the exported video", async ({ page }) => {
    test.setTimeout(120_000);
    await openLab(page);
    const result = await page.evaluate(async () => {
      const w = window as unknown as LabWindow;
      const media = w.__f09Media;
      const doc = structuredClone(w.__fixtures?.["device-card-frontal"]);
      if (!media || !doc || !w.__exportWithEngine || !w.__createLabAssetProvider)
        throw new Error("Lab export hooks are unavailable");
      // Two static title shots, black then white, with a 0.6 s linear fade: 1.4 s to 2.0 s.
      doc.loop = false;
      doc.style.background = { kind: "solid", color: "#000000" };
      doc.style.grain = 0;
      doc.style.vignette = 0;
      const shot = doc.shots[0];
      shot.layout = { kind: "title" };
      shot.texts = [];
      shot.duration = 2;
      shot.camera = { preset: "static", intensity: 0, easing: "smooth", float: 0 };
      doc.shots = [
        shot,
        {
          ...structuredClone(shot),
          id: "white-shot",
          styleOverrides: { background: { kind: "solid", color: "#FFFFFF" } },
          transitionIn: { kind: "fade", duration: 0.6, easing: "linear" },
        },
      ];
      const exported = await w.__exportWithEngine(doc, w.__createLabAssetProvider(), {
        destination: "custom",
        resolution: 360,
        fps: 30,
        quality: "high",
        format: "webm",
        supersample: 1,
        motionBlur: true,
      });
      const input = new media.Input({
        source: new media.BlobSource(exported.blob),
        formats: media.ALL_FORMATS,
      });
      try {
        const track = await input.getPrimaryVideoTrack();
        if (!track) throw new Error("Export has no video track");
        const sink = new media.CanvasSink(track);
        const lumas: number[][] = [];
        // Just after the transition start, midpoint and end frames (42, 51 and 60 at 30 fps)
        for (const t of [1.405, 1.705, 2.005]) {
          const decoded = await sink.getCanvas(t);
          if (!decoded) throw new Error(`No decoded frame at ${t}s`);
          const ctx = decoded.canvas.getContext("2d") as CanvasRenderingContext2D | null;
          if (!ctx) throw new Error("Decoded frame has no 2D context");
          const data = ctx.getImageData(0, 0, decoded.canvas.width, decoded.canvas.height).data;
          const luma: number[] = [];
          for (let i = 0; i < data.length; i += 4)
            luma.push((data[i] + data[i + 1] + data[i + 2]) / 3);
          lumas.push(luma);
        }
        const mad = (a: number[], b: number[]) =>
          a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length;
        const mean = (a: number[]) => a.reduce((sum, value) => sum + value, 0) / a.length;
        return {
          means: lumas.map(mean),
          midVsBefore: mad(lumas[1], lumas[0]),
          midVsAfter: mad(lumas[1], lumas[2]),
        };
      } finally {
        input.dispose();
      }
    });
    console.log(`F09 motion blur fade: ${JSON.stringify(result)}`);
    expect(
      result.midVsBefore,
      "the transition midpoint must differ from its start",
    ).toBeGreaterThan(2);
    expect(result.midVsAfter, "the transition midpoint must differ from its end").toBeGreaterThan(
      2,
    );
  });

  test("a responsive-pair export is upright and fills the phone screen", async ({ page }) => {
    test.setTimeout(120_000);
    await openLab(page);
    const frame = await page.evaluate(async () => {
      const w = window as unknown as LabWindow;
      const media = w.__f09Media;
      const images = w.__labTestImages;
      const base = structuredClone(w.__fixtures?.["device-card-frontal"]);
      if (!media || !images || !base || !w.__exportWithEngine || !w.__createLabAssetProvider)
        throw new Error("Lab export hooks are unavailable");
      // A dev-server module path, resolved by the browser
      const templatePath = "/src/templates/responsive-pair.ts";
      const { responsivePairTemplate } = await import(/* @vite-ignore */ templatePath);
      const desktop = {
        id: "f09-desktop",
        kind: "image",
        name: "desktop.png",
        mime: "image/png",
        bytes: 1,
        width: 1600,
        height: 1000,
        role: "desktop",
      };
      const mobile = {
        id: "f09-mobile",
        kind: "image",
        name: "mobile.png",
        mime: "image/png",
        bytes: 1,
        width: 360,
        height: 780,
        role: "mobile",
      };
      const built = responsivePairTemplate.build({
        aspect: "16:9",
        slots: { desktop1: desktop, mobile1: mobile },
        projectName: "F09 pair",
      });
      const doc = {
        ...base,
        assets: [desktop, mobile],
        style: built.style,
        shots: built.shots,
        loop: false,
      } as ProjectDoc;
      doc.shots[0].duration = 3;
      const bitmaps: Record<string, ImageBitmap> = {
        [desktop.id]: await images.quadrants(1600, 1000),
        // The phone screen: magenta top half, cyan bottom half
        [mobile.id]: await images.bands(360, 780, ["#FF00FF", "#00FFFF"]),
      };
      const labProvider = w.__createLabAssetProvider();
      const provider = {
        ...labProvider,
        getImage: async (id: string, maxWidth: number) =>
          bitmaps[id] ?? labProvider.getImage(id, maxWidth),
      };
      const exported = await w.__exportWithEngine(doc, provider, {
        destination: "custom",
        resolution: 360,
        fps: 30,
        quality: "high",
        format: "webm",
        supersample: 1,
        motionBlur: false,
      });
      const input = new media.Input({
        source: new media.BlobSource(exported.blob),
        formats: media.ALL_FORMATS,
      });
      try {
        const track = await input.getPrimaryVideoTrack();
        if (!track) throw new Error("Export has no video track");
        const decoded = await new media.CanvasSink(track).getCanvas(1.5);
        if (!decoded) throw new Error("No decoded frame at 1.5s");
        const ctx = decoded.canvas.getContext("2d") as CanvasRenderingContext2D | null;
        if (!ctx) throw new Error("Decoded frame has no 2D context");
        const { width, height } = decoded.canvas;
        return { width, height, data: Array.from(ctx.getImageData(0, 0, width, height).data) };
      } finally {
        input.dispose();
      }
    });
    expect([frame.width, frame.height]).toEqual([640, 360]);
    const pixels: PixelBuffer = { ...frame, data: new Uint8Array(frame.data) };

    // Desktop browser: the four source quadrants keep their places (F01).
    const q = quadrantCentroids(pixels);
    for (const [name, point] of Object.entries(q)) {
      expect(point.count, `${name} quadrant visible`).toBeGreaterThan(50);
    }
    expect(q.red.y, "red (top-left) above blue (bottom-left)").toBeLessThan(q.blue.y);
    expect(q.green.y, "green (top-right) above yellow (bottom-right)").toBeLessThan(q.yellow.y);
    expect(q.red.x, "red (top-left) left of green (top-right)").toBeLessThan(q.green.x);
    expect(q.blue.x, "blue (bottom-left) left of yellow (bottom-right)").toBeLessThan(q.yellow.x);

    // Phone: its screenshot is loaded (not the empty fill) and upright (magenta above cyan).
    let magenta = { y: 0, count: 0 };
    let cyan = { y: 0, count: 0 };
    for (let y = 0; y < pixels.height; y++) {
      for (let x = 0; x < pixels.width; x++) {
        const i = (y * pixels.width + x) * 4;
        const [r, g, b] = [pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]];
        if (r > 140 && g < 100 && b > 140) magenta = { y: magenta.y + y, count: magenta.count + 1 };
        if (r < 100 && g > 140 && b > 140) cyan = { y: cyan.y + y, count: cyan.count + 1 };
      }
    }
    expect(magenta.count, "phone screen top half (magenta) visible").toBeGreaterThan(200);
    expect(cyan.count, "phone screen bottom half (cyan) visible").toBeGreaterThan(200);
    expect(magenta.y / magenta.count, "phone screen is upright").toBeLessThan(cyan.y / cyan.count);
  });
});

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
      test.setTimeout(preset.width >= 3840 ? 300_000 : 150_000);
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
        timeout: preset.width >= 3840 ? 280_000 : 130_000,
      });
      const download = dialog.getByRole("button", { name: /Download/ });
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
