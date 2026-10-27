# mockup-motion-capture

Captures a website for [MockupMotion](https://github.com/jesseleechan/mockup-motion): desktop and mobile full-page screenshots, each with a JSON file of where the page's sections are. MockupMotion uses the section data to frame and scroll the screenshots.

From the MockupMotion repository:

```sh
npm run capture -- https://your-site.com
```

It needs Node 20 or later and no other setup when Chrome or Edge is installed. The package isn't published to npm yet (see [Publishing](#publishing-not-done-yet)).

## Output

The capture writes a `captures` folder in the current directory. For `https://your-site.com` it holds:

| File                                   | What it is                            |
| -------------------------------------- | ------------------------------------- |
| `your-site.com-desktop-1440-full.png`  | Desktop full page, 1440 px wide at 2× |
| `your-site.com-desktop-1440.png`       | Desktop first viewport (1440 × 900)   |
| `your-site.com-desktop-1440.json`      | Desktop section data                  |
| `your-site.com-mobile-390@2x-full.png` | Mobile full page, 390 px wide at 2×   |
| `your-site.com-mobile-390@2x.png`      | Mobile first viewport (390 × 844)     |
| `your-site.com-mobile-390@2x.json`     | Mobile section data                   |

A port and a path are part of the name: `http://localhost:8080/work/` gives `localhost_8080__work_-desktop-1440.png`.

Each JSON file looks like this:

```json
{
  "url": "https://your-site.com/",
  "viewportWidth": 1440,
  "scale": 2,
  "pageHeight": 4183,
  "sections": [{ "tag": "header", "className": "site-header", "top": 0, "height": 96 }]
}
```

## Import into MockupMotion

Drop the `captures` folder onto the editor. The screenshots are imported with their roles, section data and page URL in one step. When the folder has both screenshots of a page, only the full page is imported. A first-viewport screenshot imported without its full page (`--mode viewport`) still takes its page's URL, which Site Tour shows in the browser's URL bar, but no section data.

## Options

```
npm run capture -- <url> [options]

  --out <dir>           Output directory (default: captures/)
  --desktop <width>     Desktop viewport width (default: 1440)
  --mobile <width>      Mobile viewport width (default: 390)
  --scale <factor>      Device scale factor (default: 2)
  --mode <mode>         Capture mode: full | viewport | both (default: both)
  --hide "<selectors>"  CSS selectors to hide, for example cookie banners
  --wait <ms>           Milliseconds to wait after the page is ready
  --unstick             Convert position:fixed/sticky to static after the first viewport
  --help, -h            Show the help
```

Before each screenshot the page is scrolled to the bottom and back, so lazy images load, and animations and transitions are turned off.

## Browser

The capture runs a headless browser through [Playwright](https://playwright.dev). It tries, in order:

1. Playwright's own Chromium
2. Google Chrome
3. Microsoft Edge

If none of them is installed, it stops and asks you to install Playwright's Chromium. The command it prints names the Playwright version the capture uses, because each version expects its own Chromium build:

```sh
npx playwright@<version> install chromium
```

To use a specific Chromium binary, set `PW_CHROMIUM_EXECUTABLE` to its path:

```sh
PW_CHROMIUM_EXECUTABLE=/path/to/chrome npm run capture -- https://your-site.com
```

## Publishing (not done yet)

The package isn't on npm: publishing is deferred while MockupMotion is for personal use. Once it is published, anyone can run `npx mockup-motion-capture https://your-site.com` without the repo. These steps publish from `packages/capture` in the MockupMotion repo.

1. Create an account on [npmjs.com](https://www.npmjs.com/signup) if you don't have one, and turn on two-factor authentication.
2. Log in from the terminal: `npm login`, then check with `npm whoami`.
3. Check that the name is still free: `npm view mockup-motion-capture`. A 404 means it is free. If it's taken, change `name` in `package.json` (and the `bin` name, this README and the editor's capture dialog in `src/editor/dialogs/CaptureHelpModal.tsx`, which can then show the `npx` line).
4. Go to the package: `cd packages/capture`.
5. Set the version. The first release can stay at `0.1.0`; later releases bump it with `npm version patch` (or `minor`, `major`).
6. Look at what will ship: `npm pack --dry-run`. It should list `bin/`, `src/`, `README.md` and `package.json` only.
7. Publish: `npm publish --access public`.
8. Verify from a folder outside the repo: `npx mockup-motion-capture@latest --help`, then a real capture, for example `npx mockup-motion-capture@latest https://example.com`.
