# MockupMotion

Turn website screenshots into a short presentation video. It runs in the browser: no server, no account, no watermark.

Tested in Chrome and Chromium only. Safari, Firefox and Edge have not been tested yet; see [`docs/plan/browser-matrix.md`](docs/plan/browser-matrix.md).

## Run

Node.js 22.12 or later.

```sh
npm ci
npm run dev
```

Open http://localhost:3000.

## Capture screenshots

Good frames start with a full-page screenshot. Capture one locally:

```sh
npx playwright install chromium
npm run capture -- https://example.com --unstick
```

This writes a desktop capture (1440 px wide) and a mobile capture (390 px wide) to `captures/`, both at 2× by default. Each has a first-viewport PNG, a full-page PNG and a JSON file with the page's section positions. `--unstick` flattens sticky and fixed headers so they don't repeat down the full-page capture. Run `npm run capture -- --help` for the other options (`--out`, `--scale`, `--mode`, `--hide`, `--wait`). You can also use the browser's full-page screenshot in DevTools.

`npm run demo:capture` rebuilds the built-in demo captures from `demo-sites/`.

## Choose a template

Start with a template, or try the demo content. Four templates: Desktop Slider, Mobile Slider, Frames and Scroll Story.

Drop PNG, JPEG, WebP or AVIF files onto the stage, or upload them in the Media tab. Uploads go to the library. To put a screenshot in a shot, drag it from the Media tab onto a device on the stage, or onto the screenshot field in the inspector. Demo images stay in place until you do.

## Scroll Story

Scrolling is off unless you pick Scroll Story or turn on "Scroll through page" for a shot. A tall screenshot never starts moving on its own. When scroll is on, the shot inspector shows its stops, the hold at each stop and the easing.

## Reels

Add shots on the timeline. Between two shots, pick a cut or a fade, blur, push, zoom or wipe transition. A looping video also has a wrap transition from the last shot back to the first, so the camera never reverses.

## Brand kit

In the Brand tab, save colours, a display and a body font, a default URL and a light and dark logo once, then apply the kit to a project. The fonts are the built-in pairs, which are self-hosted.

Not available yet: uploading your own font, and logos in the video (a saved logo is not drawn). See [`docs/plan/follow-ups.md`](docs/plan/follow-ups.md).

## Music

Optional. Add an MP3, M4A, WAV or OGG file from the timeline. Drag the clip to offset it, and set its volume and fades. Fades go up to 3 seconds; by default the fade-in is 0.5 seconds and the fade-out 1.5 seconds, so a loop doesn't cut the track. Music is mixed into MP4 (AAC) and WebM (Opus). GIF, PNG and the web bundle stay silent.

## Export

Export uses the same renderer as the preview. Formats: MP4 (H.264), WebM (VP9), web bundle (.zip), animated GIF and a still frame (PNG). Resolutions run from 720p to 2160p and set the short side of the video. GIFs are capped at 960 px on the short side and 20 fps.

Each destination is a starting point for the settings:

| Destination     | Format              | Resolution  | Suggested aspect   |
| --------------- | ------------------- | ----------- | ------------------ |
| Website         | Web bundle (.zip)   | 1080p       | 16:9               |
| Dribbble        | MP4                 | 1200p       | 4:3 (1600 × 1200)  |
| Instagram       | MP4                 | 1080p       | 4:5 (1080 × 1350)  |
| Story           | MP4                 | 1080p       | 9:16 (1080 × 1920) |
| LinkedIn & X    | MP4                 | 1080p       | 16:9               |
| 4K presentation | MP4, master quality | 2160p       | 16:9               |
| Custom          | Your choice         | Your choice | Your project's     |

A destination doesn't change the project's aspect on its own. If they differ, the dialog says so and offers "Switch to 4:3" (for example). Until you switch, a 16:9 project exported for Dribbble comes out at 2134 × 1200.

A web bundle holds an MP4, a WebM, a WebP poster and `embed.html` with the snippet. If the browser can't encode H.264, the bundle holds only the WebM. The dialog shows the snippet and a "Copy code" button. For a project named "Untitled presentation" at 720p, it is:

```html
<video
  autoplay
  muted
  loop
  playsinline
  preload="metadata"
  poster="untitled-presentation-poster.webp"
  width="1280"
  height="720"
>
  <source src="untitled-presentation.webm" type='video/webm; codecs="vp09.00.41.08"' />
  <source src="untitled-presentation.mp4" type="video/mp4" />
</video>
<!-- Pause video if user prefers reduced motion (quality-bar & accessibility) -->
<script>
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const v = document.currentScript && document.currentScript.previousElementSibling;
    if (v && v.tagName === "VIDEO") {
      v.pause();
    }
  }
</script>
```

Put the files next to the page. The script pauses the video when the visitor prefers reduced motion.

Export stays on this machine. Each finished file is read back and checked ("Verified MP4"). Cancel stops the encode and leaves the editor usable. If this browser can't encode the audio codec, the video exports without music and the result says so.

GIF export is slow and large. A 6-second GIF at the 1080p setting (1708 × 960, 20 fps) took over a minute, froze the page while encoding, and came out at 83 MB. For GIFs, use 720p or a shorter video.

## Projects

Projects, screenshots and brand kits are stored in IndexedDB in this browser. Open Projects from the MockupMotion menu at the top left to switch, rename, duplicate or delete them. If storage is full, the save indicator says so. Clearing site data removes the local library.

## Checks

```sh
npm test                    # unit tests (Vitest)
npm run typecheck
npm run lint
npm run build
npm run test:e2e            # Playwright, Chromium
npm run test:visual         # pixel stills against the Linux baselines
npm run test:perf           # export speed and frame budgets; run on real hardware
npm run contact-sheet       # every template at 3 aspects x 3 times
npm run template-previews   # regenerates the gallery previews in public/templates
```

Visual baselines are Linux-only and change only with the project owner's approval. See [`tests/visual/README.md`](tests/visual/README.md).

## How this guide was checked

Every claim above was checked on 7 Oct 2026 (F14) by running the app with `npm run dev` in the Claude desktop browser pane (Chromium 152, Windows), or is covered by a test that runs in CI.

| Section                 | Evidence                                                                                                                                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capture                 | Ran `npm run capture -- <local demo site> --unstick --out <dir>`: 2880 px desktop and 780 px mobile PNGs, viewport and full page, plus JSON. Recapture: [PR #14](https://github.com/jesseleechan/mockup-motion/pull/14)                                   |
| Templates, demo content | The gallery lists the templates (12 then; 4 since 2026-10-08); `tests/e2e/polish.spec.ts` "first run opens the template gallery, then demo content"                                                                                                       |
| Uploads and assigning   | A PNG uploaded after demo content went to the library only; dragging it onto the stage device moved slot 1 to it. A WebP dropped on the window was added. `polish.spec.ts` "rejects corrupt and oversized screenshots"; types from `src/assets/decode.ts` |
| Scroll Story            | "Scroll through page" is off on a new shot with a tall screenshot; turning it on shows stops, hold and easing. `tests/e2e/wave5.spec.ts` "WP-15: Scroll Story…"                                                                                           |
| Reels                   | The transition picker lists Cut, Fade, Blur, Push, Zoom and Wipe, and the timeline has a "Loop wrap transition" chip. `tests/timeline.test.ts`, `tests/motion.test.ts` loop seams                                                                         |
| Brand kit               | Brand tab fields as listed; no font upload control. `tests/e2e/library.spec.ts` "Media Tab & Brand Kit flow…". Missing font upload and logo drawing: [`follow-ups.md`](docs/plan/follow-ups.md)                                                           |
| Music                   | The file input accepts .mp3, .m4a, .wav and .ogg; fade sliders read 0.5 / 3 and 1.5 / 3. `tests/e2e/audio.spec.ts` (offset drag, fades, export track length, silent bundle and GIF), `tests/audio.test.ts` (codec fallback warning)                       |
| Export                  | Destinations, formats and resolutions read from the dialog; "Switch to 4:3" changed Dribbble to 1600 × 1200. `tests/e2e/export.spec.ts` "F09 destination presets export at their size and length"                                                         |
| Web bundle              | A 720p Website export: the zip held `untitled-presentation.mp4`, `.webm`, `-poster.webp` and `embed.html`; both videos verified; the snippet above is the dialog's text, formatted by Prettier                                                            |
| GIF and PNG             | Exported both from the dialog and verified (GIF 1708 × 960, 83 MB; PNG 1920 × 1080)                                                                                                                                                                       |
| Cancel                  | `tests/e2e/export-dialog.spec.ts` "cancel stops the worker and returns to the settings"                                                                                                                                                                   |
| Projects                | The Projects dialog lists rename, duplicate and delete. `polish.spec.ts` "projects can be duplicated and deleted" and "storage quota surfaces a calm error…"                                                                                              |
