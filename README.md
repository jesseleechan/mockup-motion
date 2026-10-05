# MockupMotion

Turn website screenshots into a short presentation video. It runs in the browser: no server, no account, no watermark.

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

That writes a desktop capture (1440) and a mobile capture (390 at 2×). `--unstick` turns fixed headers into normal flow so the full page is in the image. You can also use the browser’s full-page screenshot in DevTools.

`npm run demo:capture` rebuilds the built-in demo sites.

## Choose a template

Start with a template, or try the demo content. Twelve templates cover a quiet hero, tilted showcase, responsive pair and trio, phone spotlight and parade, portfolio rows, an isometric wall, a cascade stack, Scroll Story, and two reels.

Drop PNG, JPEG, WebP, or AVIF onto the stage, or add them from the media library. The first real upload replaces the demo images.

## Scroll Story

Scrolling is off unless you pick Scroll Story or turn scroll on for that shot. Stops, holds, and easing are in the inspector. A tall screenshot never starts moving on its own.

## Reels

Add shots on the timeline. Transitions (fade, blur, push, zoom, wipe) overlap the previous shot. A looping video uses a wrap crossfade instead of reversing the camera.

## Brand kit

Save a logo, colors, and fonts once, then apply the kit to a project. Custom fonts upload as files. Built-in pairs are self-hosted.

## Music

Optional. Add an MP3, M4A, WAV, or OGG from the timeline. Drag the clip to offset it, and set volume and fades (up to 3 seconds). The default fade-out is 1.5 seconds so a loop does not cut the track. Music is mixed into MP4 (AAC) and WebM (Opus). GIF and the web-embed bundle stay silent.

## Export

Export uses the same renderer as the preview.

| Destination            | What you get                                                   |
| ---------------------- | -------------------------------------------------------------- |
| Website embed          | MP4, WebM, poster, and a `<video>` snippet in a zip. No audio. |
| Dribbble               | 4:3                                                            |
| Instagram feed / story | 4:5 or 9:16                                                    |
| LinkedIn / X           | 16:9 or 1:1, depending on the preset                           |
| Presentation 4K        | Short side 2160                                                |

The embed snippet looks like this (filenames follow the project name):

```html
<video
  autoplay
  muted
  loop
  playsinline
  preload="metadata"
  poster="name-poster.webp"
  width="1920"
  height="1080"
>
  <source src="name.webm" type='video/webm; codecs="vp09.00.41.08"' />
  <source src="name.mp4" type="video/mp4" />
</video>
```

Put the files next to the page. The snippet pauses the video when the visitor prefers reduced motion.

Export stays on this machine. Cancel stops the encode and leaves the editor usable. If this browser cannot encode the audio codec, the video exports without music and the dialog says so.

## Projects

Projects, screenshots, and brand kits are stored in IndexedDB on this browser. Duplicate or delete them from the project list. If storage is full, the save indicator says so. Clearing site data removes the local library.

## Checks

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
npm run test:visual
npm run contact-sheet
```

Update visual baselines with `npm run test:visual:update`. See `tests/visual/README.md`.
