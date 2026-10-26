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

Good frames start with a full-page screenshot. From this repo, with Node 20 or later:

```sh
npm run capture -- https://example.com --unstick
```

It writes a desktop capture (1440 px wide) and a mobile capture (390 px wide) to `captures/`, both at 2× by default. Each has a first-viewport PNG, a full-page PNG and a JSON file with the page's section positions. Drop the `captures` folder onto the editor to import them all at once. `--unstick` flattens sticky and fixed headers so they don't repeat down the full-page capture. Run it with `--help` for the other options (`--out`, `--scale`, `--mode`, `--hide`, `--wait`). The capture code is a small package in `packages/capture` (see its [README](packages/capture/README.md)); it isn't published to npm. You can also use the browser's full-page screenshot in DevTools.

`npm run demo:capture` rebuilds the built-in demo captures from `demo-sites/`.

## Choose a template

Start with a template, or try the demo content. Each template comes in a desktop and a mobile size: Desktop Slider and Mobile Slider, Desktop Frames and Mobile Frames, Desktop Stack and Mobile Stack, Desktop Orbit and Mobile Orbit, Desktop Site Tour and Mobile Site Tour, Desktop Scroll Story and Mobile Scroll Story.

Drop PNG, JPEG, WebP or AVIF files or a whole folder anywhere on the editor, paste an image with ⌘V / Ctrl+V, or upload them in the Media tab. A dropped `captures` folder brings each screenshot's role (desktop or mobile) and section data. Uploads go to the library. To put a screenshot in a shot, drag it from the Media tab onto a device on the stage, or onto the screenshot field in the inspector. After "Try with demo content", a banner under the stage offers "Use my screenshots": it swaps every demo image in the project for your uploads, desktop for desktop and mobile for mobile, in one undo step.

## Responsive Scroll

Responsive Scroll shows the desktop and mobile versions of one page side by side (stacked at 4:5 and 9:16), scrolling together and pausing on the same sections. It needs one desktop and one mobile full-page screenshot. Drop the JSON files `npm run capture` writes next to them, and both screens stop on the page's sections; without them, they stop at the same points down each page. Pick the sections in the shot inspector under Scroll stops.

## Responsive Tour

Responsive Tour shows several pages of one site, each in desktop and mobile, on Responsive Scroll's two cards. Every step (2 seconds at the Default pace) both cards slide to the next page together, and the loop comes back to the first page. It needs 3 to 5 pages in both sizes: page 1 is the first desktop and the first mobile screenshot in the Media tab, page 2 the second of each, and so on. The shot inspector lists the pages as pairs; drag a page to reorder it, or click a screenshot to change it.

## Scroll Story

Scrolling is off unless you pick Desktop Scroll Story or Mobile Scroll Story, or turn on "Scroll through page" for a shot. Mobile Scroll Story scrolls a tall mobile screenshot on a phone. Both last 10 s, or longer when a page needs it to stay under 0.9 screen heights per second. A tall screenshot never starts moving on its own. When scroll is on, the shot inspector shows its stops, the hold at each stop and the easing.

## Loops

A video is one shot that loops. The presets loop seamlessly on their own; a shot with a camera move fades from its end back into its start, so the camera never reverses. Multi-shot reels and shot transitions were removed on 19 October 2026: a saved reel opens with its first shot.

## Sound

Videos are silent. Music was removed in October 2026; a saved project with a music track still opens, without the music.

## Export

Export uses the same renderer as the preview. Formats: MP4 (H.264), WebM (VP9), web bundle (.zip) and a still frame (PNG). Resolutions run from 720p to 2160p and set the short side of the video. Animated GIF export and motion blur were removed in October 2026; a saved project that used them opens with MP4 and no motion blur.

Each destination is a starting point for the settings. A new project's dialog opens on Video, an MP4 at 1080p in your project's aspect; after that it opens on the settings of your last export:

| Destination     | Format                                  | Resolution | Suggested aspect   |
| --------------- | --------------------------------------- | ---------- | ------------------ |
| Video           | MP4 (default), also for LinkedIn and X  | 1080p      | Your project's     |
| Dribbble        | MP4                                     | 1200p      | 4:3 (1600 × 1200)  |
| Instagram       | MP4                                     | 1080p      | 4:5 (1080 × 1350)  |
| Story           | MP4                                     | 1080p      | 9:16 (1080 × 1920) |
| 4K presentation | MP4, master quality                     | 2160p      | 16:9               |
| Web bundle      | MP4, WebM, poster and embed code (.zip) | 1080p      | 16:9               |

Changing a setting by hand makes the settings Custom, and no destination is selected.

**Several sizes at once.** Under the destinations, pick any of 16:9, 4:3, 4:5 and 9:16 to get one file per size in one export, for example for a site, Dribbble, an Instagram post and a Story. Each size renders the project re-fitted to that aspect, as "Switch to" would, without changing the project. Files render one after another, and each one can be downloaded as soon as it finishes.

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

Export stays on this machine. Each finished file is read back and checked ("Verified MP4"). Cancel stops the encode and leaves the editor usable.

## Projects

Projects and screenshots are stored in IndexedDB in this browser. Open Projects from the MockupMotion menu at the top left to switch, rename, duplicate or delete them. If storage is full, the save indicator says so. Clearing site data removes the local library.

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
| Loops                   | A saved reel opens with its first shot, and its blur, push, zoom or wipe wrap plays as a fade. `tests/legacy-layouts.test.ts` "Saved multi-shot reels", `tests/motion.test.ts` loop seams                                                                 |
| Export                  | Destinations, formats and resolutions read from the dialog; "Switch to 4:3" changed Dribbble to 1600 × 1200. `tests/e2e/export.spec.ts` "F09 destination presets export at their size and length"                                                         |
| Web bundle              | A 720p Website export: the zip held `untitled-presentation.mp4`, `.webm`, `-poster.webp` and `embed.html`; both videos verified; the snippet above is the dialog's text, formatted by Prettier                                                            |
| PNG                     | Exported from the dialog and verified (PNG 1920 × 1080)                                                                                                                                                                                                   |
| Cancel                  | `tests/e2e/export-dialog.spec.ts` "cancel stops the worker and returns to the settings"                                                                                                                                                                   |
| Projects                | The Projects dialog lists rename, duplicate and delete. `polish.spec.ts` "projects can be duplicated and deleted" and "storage quota surfaces a calm error…"                                                                                              |
