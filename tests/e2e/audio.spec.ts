import { expect, test, type Page } from "@playwright/test";
import type { ExportSettings, ProjectDoc } from "../../src/doc/types";
import { ciTimeout } from "../helpers/ci";

/** A frame the playback loop published while playing (recorder in the loop-wrap test). */
interface PublishedFrame {
  playhead: number;
  /** Music minus playhead after the preview's own handling of this frame. */
  drift: number | null;
  /** The playhead moved backwards: a loop wrap. */
  wrap: boolean;
}

interface EditorWindow {
  __editorStore?: {
    getState: () => { doc: ProjectDoc; apply: (recipe: (draft: ProjectDoc) => void) => void };
  };
  __uiStore?: {
    getState: () => {
      playhead: number;
      playing: boolean;
      setPlayhead: (time: number) => void;
      setPlaying: (playing: boolean) => void;
    };
    subscribe: (
      listener: (
        state: { playhead: number; playing: boolean },
        prev: { playhead: number; playing: boolean },
      ) => void,
    ) => () => void;
  };
  /** Every AudioContext the page created (init script below). */
  __audioContexts?: AudioContext[];
  __frames?: PublishedFrame[];
}

/** 16-bit stereo PCM WAV of a constant-amplitude 440 Hz tone. */
function makeWav(seconds: number, sampleRate = 44100, amp = 0.8): Buffer {
  const frames = Math.round(seconds * sampleRate);
  const data = Buffer.alloc(frames * 4);
  for (let i = 0; i < frames; i++) {
    const v = Math.round(amp * 32767 * Math.sin((2 * Math.PI * 440 * i) / sampleRate));
    data.writeInt16LE(v, i * 4);
    data.writeInt16LE(v, i * 4 + 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

async function openEditorWithDemo(page: Page) {
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
  await page.getByRole("button", { name: "Try with demo content" }).click();
  await expect(page.locator("canvas").first()).toBeVisible();
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

/** One shot of `seconds`, no transition, so exports and loop wraps stay short. */
async function useShortDoc(page: Page, seconds: number, loop: boolean) {
  await page.evaluate(
    ({ seconds, loop }) => {
      const store = (window as unknown as EditorWindow).__editorStore;
      if (!store) throw new Error("__editorStore is unavailable");
      store.getState().apply((draft) => {
        draft.shots = draft.shots.slice(0, 1);
        // The first-run demo is Desktop Slider (presets D1), whose length follows its screenshots
        // (contracts.md §5), so the shot shows the first screenshot in one browser instead.
        draft.shots[0].layout = { kind: "single", device: "browser", assetId: draft.assets[0].id };
        draft.shots[0].duration = seconds;
        draft.shots[0].transitionIn = { kind: "cut", duration: 0, easing: "linear" };
        draft.loop = loop;
      });
    },
    { seconds, loop },
  );
}

/** The app's own encoder probes for H.264 + AAC at the project's export settings. */
async function canExportMp4WithAudio(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const store = (window as unknown as EditorWindow).__editorStore;
    if (!store) throw new Error("__editorStore is unavailable");
    const settings: ExportSettings = store.getState().doc.export;
    // @ts-expect-error dev-server module path resolved by the browser
    const { probeVideoEncoders } = await import(/* @vite-ignore */ "/src/export/probe.ts");
    // @ts-expect-error dev-server module path resolved by the browser
    const { canEncodeExportAudio } = await import(/* @vite-ignore */ "/src/export/audio-mux.ts");
    const video = await probeVideoEncoders({
      width: Math.round((settings.resolution * 16) / 9),
      height: settings.resolution,
      fps: settings.fps,
      quality: settings.quality,
    });
    return video.avc && (await canEncodeExportAudio("aac"));
  });
}

async function addMusic(page: Page, seconds = 12) {
  await page.getByTestId("music-input").setInputFiles({
    name: "tone.wav",
    mimeType: "audio/wav",
    buffer: makeWav(seconds),
  });
  await expect(page.getByTestId("audio-lane")).toBeVisible();
}

/**
 * Records every frame the playback loop publishes while playing. The listener subscribes after
 * the music preview's, so it reads each frame's drift after any re-anchor on that frame.
 */
async function recordFrames(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as EditorWindow;
    const frames: PublishedFrame[] = [];
    w.__frames = frames;
    w.__uiStore!.subscribe((state, prev) => {
      if (!state.playing || !prev.playing || state.playhead === prev.playhead) return;
      frames.push({
        playhead: state.playhead,
        drift: window.__mmAudio?.drift() ?? null,
        wrap: state.playhead < prev.playhead,
      });
    });
  });
}

/** The drift on `count` published frames from frame index `start`, once they exist. */
async function driftsFrom(page: Page, start: number, count: number) {
  await expect
    .poll(() => page.evaluate(() => (window as unknown as EditorWindow).__frames!.length), {
      timeout: ciTimeout(5000),
    })
    .toBeGreaterThanOrEqual(start + count);
  return page.evaluate(
    ({ start, count }) =>
      (window as unknown as EditorWindow)
        .__frames!.slice(start, start + count)
        .map((frame) => frame.drift),
    { start, count },
  );
}

function expectInSync(drifts: (number | null)[], when: string) {
  for (const drift of drifts) {
    expect(drift, `audio should be sounding ${when}`).not.toBeNull();
    expect(Math.abs(drift as number), `drift ${when}`).toBeLessThan(0.04);
  }
}

async function exportAs(page: Page, formatLabel: RegExp) {
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("combobox").first().click();
  await page.getByRole("option", { name: formatLabel }).click();
  return dialog;
}

test.describe("WP-17: Music track", () => {
  test.setTimeout(120_000);

  test("imports audio, draws a 200-bucket waveform, and edits volume and fades", async ({
    page,
  }) => {
    await openEditorWithDemo(page);
    await expect(page.getByTestId("audio-lane")).toHaveCount(0);
    await addMusic(page);

    await expect(page.getByTestId("audio-clip").locator("rect")).toHaveCount(200);
    // Media library only lists screenshots, never the music file
    await expect(page.getByText("tone.wav").first()).toBeVisible();

    const fadeOut = page.getByRole("slider", { name: "Fade out" });
    await expect(fadeOut).toHaveAttribute("aria-valuenow", "1.5");
    await fadeOut.focus();
    await page.keyboard.press("ArrowLeft"); // shrinks... handle moves right = shorter fade
    // ArrowLeft grows the fade-out by one step (handle moves left)
    await expect(fadeOut).toHaveAttribute("aria-valuenow", "1.6");

    const fadeIn = page.getByRole("slider", { name: "Fade in" });
    await fadeIn.focus();
    await page.keyboard.press("Shift+ArrowRight");
    await expect(fadeIn).toHaveAttribute("aria-valuenow", "1");

    const volume = page.getByRole("slider", { name: "Music volume" });
    await volume.fill("0.5");
    await expect(page.getByTestId("music-volume-value")).toHaveText("50%");

    // Dragging the clip changes the offset; undo restores it
    const clip = page.getByTestId("audio-clip");
    const box = (await clip.boundingBox())!;
    await page.mouse.move(box.x + 40, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    const moved = (await clip.boundingBox())!;
    expect(moved.x).toBeGreaterThan(box.x + 30);

    await page.getByRole("button", { name: "Remove music" }).click();
    await expect(page.getByTestId("audio-lane")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add music" })).toBeVisible();
  });

  test("rejects non-audio and corrupt files without adding a lane", async ({ page }) => {
    await openEditorWithDemo(page);
    await page.getByTestId("music-input").setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello"),
    });
    await expect(page.getByText(/use MP3, M4A, WAV, or OGG/)).toBeVisible();
    await page.getByTestId("music-input").setInputFiles({
      name: "broken.mp3",
      mimeType: "audio/mpeg",
      buffer: Buffer.from("this is not an mp3 file at all"),
    });
    await expect(page.getByText(/couldn't be read/)).toBeVisible();
    await expect(page.getByTestId("audio-lane")).toHaveCount(0);
  });

  test("preview stays within 40 ms of the playhead after 5 seeks", async ({ page }) => {
    await openEditorWithDemo(page);
    await addMusic(page);
    await expect.poll(() => page.evaluate(() => window.__mmAudio?.loaded())).toBe(true);

    const ruler = page.getByRole("slider", { name: "Timeline scrubber" });
    const rulerBox = (await ruler.boundingBox())!;
    const playButton = page.getByRole("button", { name: "Play" }).first();

    const drifts: number[] = [];
    for (const fraction of [0.1, 0.55, 0.3, 0.8, 0.02]) {
      await page.mouse.click(rulerBox.x + rulerBox.width * fraction * 0.8, rulerBox.y + 8);
      await playButton.click();
      // Music starts on the playback loop's first frame, which can take over 400 ms locally
      // after Play and about 5x longer on the CI runner.
      await expect
        .poll(() => page.evaluate(() => window.__mmAudio?.drift() ?? null), {
          timeout: ciTimeout(2000),
          message: "audio should be sounding while playing",
        })
        .not.toBeNull();
      await page.waitForTimeout(400);
      const drift = await page.evaluate(() => window.__mmAudio?.drift() ?? null);
      expect(drift, "audio should be sounding while playing").not.toBeNull();
      drifts.push(Math.abs(drift as number));
      await page.getByRole("button", { name: "Pause" }).first().click();
      // Muted while not playing
      await expect.poll(() => page.evaluate(() => window.__mmAudio?.position() ?? null)).toBeNull();
    }
    for (const d of drifts) expect(d).toBeLessThan(0.04);
  });

  test("preview re-anchors after a loop wrap and an audio clock stall, and is silent while scrubbing", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const Native = window.AudioContext;
      const created: AudioContext[] = [];
      (window as unknown as EditorWindow).__audioContexts = created;
      window.AudioContext = class extends Native {
        constructor(options?: AudioContextOptions) {
          super(options);
          created.push(this);
        }
      };
    });
    await openEditorWithDemo(page);
    await addMusic(page);
    await expect.poll(() => page.evaluate(() => window.__mmAudio?.loaded())).toBe(true);
    await useShortDoc(page, 2, true);
    expect(
      await page.evaluate(() => (window as unknown as EditorWindow).__audioContexts?.length),
    ).toBe(1);

    await recordFrames(page);

    // Loop wrap: play from 0.2 s before the end of the 2 s loop. The wrap frame and the two
    // after it must be in sync; locally they come before the next drift check could fix them.
    await page.evaluate(() => {
      const ui = (window as unknown as EditorWindow).__uiStore!.getState();
      ui.setPlayhead(1.8);
      ui.setPlaying(true);
    });
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            (window as unknown as EditorWindow).__frames!.findIndex((frame) => frame.wrap),
          ),
        { timeout: ciTimeout(5000), message: "playback should wrap to the start" },
      )
      .toBeGreaterThanOrEqual(0);
    const wrapIndex = await page.evaluate(() =>
      (window as unknown as EditorWindow).__frames!.findIndex((frame) => frame.wrap),
    );
    expectInSync(await driftsFrom(page, wrapIndex, 3), "after the loop wrap");

    // Main-thread stall (a long task, as on a busy CI runner): the next frame's callback runs
    // about 150 ms after the frame's timestamp, under the 0.25 s jump that re-anchors at once.
    const beforeBlock = await page.evaluate(() => {
      const count = (window as unknown as EditorWindow).__frames!.length;
      const end = performance.now() + 150;
      while (performance.now() < end) {
        // Keep the main thread busy.
      }
      return count;
    });
    expectInSync(await driftsFrom(page, beforeBlock, 3), "after a main-thread stall");

    // Audio clock stall (an audio device hiccup): the playhead keeps moving for 200 ms
    // while the audio clock stands still.
    await page.evaluate(async () => {
      const ctx = (window as unknown as EditorWindow).__audioContexts![0];
      await ctx.suspend();
      await new Promise((resolve) => setTimeout(resolve, 200));
      await ctx.resume();
    });
    // The drift check runs on the audio clock, so the CI runner needs more frames to reach it.
    await page.waitForTimeout(ciTimeout(600));
    const afterStall = await page.evaluate(() => window.__mmAudio?.drift() ?? null);
    expect(afterStall, "audio should be sounding after the stall").not.toBeNull();
    expect(Math.abs(afterStall as number), "drift after the audio clock stall").toBeLessThan(0.04);

    // Scrubbing the ruler during playback is silent.
    const ruler = page.getByRole("slider", { name: "Timeline scrubber" });
    const rulerBox = (await ruler.boundingBox())!;
    await page.mouse.move(rulerBox.x + rulerBox.width * 0.2, rulerBox.y + 8);
    await page.mouse.down();
    await page.mouse.move(rulerBox.x + rulerBox.width * 0.5, rulerBox.y + 8, { steps: 5 });
    await expect.poll(() => page.evaluate(() => window.__mmAudio?.position() ?? null)).toBeNull();
    await page.mouse.up();
  });

  for (const [format, label, extension] of [
    ["mp4", /MP4/, "mp4"],
    ["webm", /WebM/, "webm"],
  ] as const) {
    test(`${format.toUpperCase()} export has an audio track of the video length with audible fades`, async ({
      page,
    }) => {
      // A 2 s export: about 30 s locally, and the GitHub runner is about 5x slower.
      test.setTimeout(300_000);
      await openEditorWithDemo(page);
      if (format === "mp4" && !(await canExportMp4WithAudio(page))) {
        test.skip(true, "H.264 encoder unavailable in this Chromium build");
      }
      await addMusic(page, 20);
      await useShortDoc(page, 2, false);
      // Make the fade-in a full second so the first 100 ms is clearly near-silent
      const fadeIn = page.getByRole("slider", { name: "Fade in" });
      await fadeIn.focus();
      await page.keyboard.press("Shift+ArrowRight");

      const dialog = await exportAs(page, label);
      await expect(dialog.getByTestId("music-note")).toContainText(/Music is mixed/);
      await dialog.getByRole("button", { name: "Start export" }).click();

      const download = dialog.getByRole("link", { name: /Download/ });
      await expect(download).toBeVisible({ timeout: 240_000 });
      await expect(download).toHaveAttribute("download", new RegExp(`\\.${extension}$`));
      await expect(dialog.getByTestId("export-warnings")).toHaveCount(0);

      const href = (await download.getAttribute("href"))!;
      const result = await page.evaluate(async (url) => {
        const blob = await (await fetch(url)).blob();

        // Mediabunny Input: container-level duration of audio vs video
        // @ts-expect-error dev-server module path resolved by the browser
        const { verifyExportBlob } = await import(/* @vite-ignore */ "/src/export/verify.ts");
        const info = await verifyExportBlob(blob, {
          width: 1920,
          height: 1080,
          duration: 0,
          fps: 30,
          audio: undefined,
        });

        // Decoded PCM for RMS
        const ctx = new OfflineAudioContext(2, 1, 48000);
        const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
        const ch = buf.getChannelData(0);
        const sr = buf.sampleRate;
        const rms = (from: number, to: number) => {
          let sum = 0;
          const a = Math.max(0, Math.floor(from));
          const b = Math.min(ch.length, Math.floor(to));
          for (let i = a; i < b; i++) sum += ch[i] * ch[i];
          return Math.sqrt(sum / Math.max(1, b - a));
        };
        const hundred = sr * 0.1;
        const mid = ch.length / 2;
        return {
          videoDuration: info.actual?.duration as number,
          audioDuration: info.actual?.audioDuration as number | undefined,
          audioCodec: info.actual?.audioCodec as string | undefined,
          first: rms(0, hundred),
          middle: rms(mid - hundred / 2, mid + hundred / 2),
          last: rms(ch.length - hundred, ch.length),
          decodedSeconds: ch.length / sr,
        };
      }, href);

      expect(result.audioCodec).toBe(format === "mp4" ? "aac" : "opus");
      expect(result.audioDuration).toBeDefined();
      // Audio length equals the video length (±1 video frame + 1 audio frame)
      expect(Math.abs((result.audioDuration as number) - result.videoDuration)).toBeLessThan(0.07);
      expect(result.middle).toBeGreaterThan(0.15);
      expect(result.first / result.middle).toBeLessThan(0.1);
      expect(result.last / result.middle).toBeLessThan(0.1);
      await expect(dialog.getByTestId("verify-audio")).toBeVisible();
    });
  }

  test("a project with no music exports without an audio track", async ({ page }) => {
    // A 2 s export: about 30 s locally, and the GitHub runner is about 5x slower.
    test.setTimeout(300_000);
    await openEditorWithDemo(page);
    await useShortDoc(page, 2, false);
    const dialog = await exportAs(page, /MP4/);
    await expect(dialog.getByTestId("music-note")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Start export" }).click();
    const download = dialog.getByRole("link", { name: /Download/ });
    await expect(download).toBeVisible({ timeout: 240_000 });
    const href = (await download.getAttribute("href"))!;
    const hasAudio = await page.evaluate(async (url) => {
      const blob = await (await fetch(url)).blob();
      // @ts-expect-error dev-server module path resolved by the browser
      const { verifyExportBlob } = await import(/* @vite-ignore */ "/src/export/verify.ts");
      const info = await verifyExportBlob(blob, {
        width: 1920,
        height: 1080,
        duration: 0,
        fps: 30,
        audio: false,
      });
      return info.actual?.audioDuration !== undefined;
    }, href);
    expect(hasAudio).toBe(false);
    await expect(dialog.getByTestId("verify-audio")).toHaveCount(0);
  });

  test("web bundles and GIFs say music is left out", async ({ page }) => {
    await openEditorWithDemo(page);
    await addMusic(page);
    const dialog = await exportAs(page, /Web bundle/);
    await expect(dialog.getByTestId("music-note")).toContainText(/silent/);
    await dialog.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /Animated GIF/ }).click();
    await expect(dialog.getByTestId("music-note")).toContainText(/no sound/);
  });
});
