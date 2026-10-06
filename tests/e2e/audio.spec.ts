import { expect, test, type Page } from "@playwright/test";

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
}

async function addMusic(page: Page, seconds = 12) {
  await page.getByTestId("music-input").setInputFiles({
    name: "tone.wav",
    mimeType: "audio/wav",
    buffer: makeWav(seconds),
  });
  await expect(page.getByTestId("audio-lane")).toBeVisible();
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
    await expect(page.getByText("50%")).toBeVisible();

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

  for (const [format, label, extension] of [
    ["mp4", /MP4/, "mp4"],
    ["webm", /WebM/, "webm"],
  ] as const) {
    test(`${format.toUpperCase()} export has an audio track of the video length with audible fades`, async ({
      page,
    }) => {
      await openEditorWithDemo(page);
      await addMusic(page, 20);
      // Make the fade-in a full second so the first 100 ms is clearly near-silent
      const fadeIn = page.getByRole("slider", { name: "Fade in" });
      await fadeIn.focus();
      await page.keyboard.press("Shift+ArrowRight");

      const dialog = await exportAs(page, label);
      await expect(dialog.getByTestId("music-note")).toContainText(/Music is mixed/);
      await dialog.getByRole("button", { name: "Start export" }).click();

      const download = dialog.getByRole("link", { name: /Download/ });
      await expect(download).toBeVisible({ timeout: 90_000 });
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
    await openEditorWithDemo(page);
    const dialog = await exportAs(page, /MP4/);
    await expect(dialog.getByTestId("music-note")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Start export" }).click();
    const download = dialog.getByRole("link", { name: /Download/ });
    await expect(download).toBeVisible({ timeout: 90_000 });
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
