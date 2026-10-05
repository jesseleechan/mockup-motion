# MockupMotion: agent guide

MockupMotion is a local-first studio that turns website screenshots into short, elegant presentation videos. Think Jitter or shots.so, focused on web designers presenting their work. Everything renders in the browser, with no server, no account, and no watermark.

**Current phase: fixing the rebuild.** The October 2026 audit found that the rebuild on `main` renders upside down, has wrong colours, black screens and fake tests. The active plan is **`docs/fix-plan/README.md`**. If you were given a fix task (`Fxx`), read that file in full, especially section 3, "Rules for the executor", and then your task in `docs/fix-plan/tasks/`.

The original rebuild plan is still the reference for _what_ to build. If you were given a work package (WP), read these first, in this order:

1. `docs/plan/README.md`: architecture, milestones, and how WPs fit together
2. `docs/plan/contracts.md`: shared types and module APIs (the source of truth)
3. `docs/plan/quality-bar.md`: the aesthetic and motion rules every visual change must meet
4. `docs/plan/wp/WP-XX-*.md`: your task

`docs/archive/` holds the previous plan and design notes. They are stale, so do not follow them.

## Commands

```sh
npm ci                # install (Node 22.12+)
npm run dev           # http://localhost:3000
npm test              # unit tests (Vitest after WP-00; node:test before)
npm run typecheck
npm run lint          # ESLint after WP-00
npm run build
npm run test:e2e      # Playwright (WP-03 sets it up; WP-18 expands it)
npm run contact-sheet # renders every template at 4 times x all aspects into ./contact-sheet (after WP-11)
```

Playwright browsers:

- **Locally:** run `npx playwright install chromium` once.
- **Cloud sessions:** Chromium may be preinstalled under `/opt/pw-browsers` with a build older than the one `@playwright/test` expects. When versions differ, set `PW_CHROMIUM_EXECUTABLE` to the installed binary: `PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run test:e2e`.

Playwright's Chromium cannot encode H.264, so MP4 exports fall back to WebM there. MP4-only assertions must check the encoder at runtime and skip with that reason; no other skips are allowed.

## Hard rules

- **Determinism.** Nothing under `src/motion/` or the engine render path may read `Date.now()`, `performance.now()`, or unseeded `Math.random()`. A frame is a pure function of `(doc, t, size)`. Use `src/motion/rng.ts` (seeded) for noise or grain.
- **Module boundaries.** `src/motion/` is pure TypeScript with no DOM, three.js, or React imports, so it can be unit-tested in Node. `src/engine/` has no React. `src/editor/` and `src/ui/` never import three.js directly; they go through `Engine`.
- **Screens are unlit and color-exact.** Screenshot content uses unlit materials, `SRGBColorSpace` textures, and `NoToneMapping`. A screenshot must look exactly like the PNG.
- **Image orientation.** Image textures use `flipY = false`, so texel row 0 is the top of the image. Every quad that shows an image maps its top edge to v = 0. WebGL ignores `flipY` for `ImageBitmap`. See `docs/fix-plan/tasks/F01-image-orientation.md`.
- **Colour pipeline.** Render targets hold linear values, and every custom shader outputs linear. Only the final pass converts to sRGB, followed by grain and dither. See `docs/fix-plan/tasks/F02-color-pipeline.md`.
- **Tests must be able to fail.** Never weaken, skip, or early-return a test to make it pass. Never swallow errors with `.catch(() => {})` or an empty `catch {}`. Never ship placeholder assets. Look at the pixels you render.
- **Never crop a screenshot horizontally.** Device screens fit the screenshot to width. Overflow is cropped at the bottom or scrolled (opt-in only). See `quality-bar.md` §3.
- **No yo-yo motion.** A shot never reverses its main camera or layout movement. Loops come from marquee periods or a wrap crossfade (`contracts.md` §5).
- **Content scrolling is opt-in.** A tall screenshot never starts scrolling unless the user picks a scroll template or turns scroll on for that shot.
- **Dispose GPU resources** (textures, geometries, materials, render targets) whenever the scene graph changes.
- **Keep scope.** Do only your WP. If you find something out of scope, note it in your PR description under "Follow-ups".

## Code style

- Write readable TypeScript. Do not chain declarations with commas (`const a = 1, b = 2`). The legacy code does this; do not copy it.
- Use named exports. Keep files under about 400 lines, splitting by responsibility.
- Comment only non-obvious decisions, especially magic numbers in visual code. Point to the `quality-bar.md` section.
- Prettier formats the code; run `npm run format` before committing.
- UI copy is short, calm, and professional. Avoid cute phrases ("Ready for its close-up!"). Use sentence case.

## Definition of done (every WP)

- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass.
- The acceptance criteria in your WP file are met, and the PR shows how each one was verified.
- Visual work: attach before/after frames or a contact sheet to the PR. Check `quality-bar.md` and say which rules you checked.
- Update the WP's **Status** line in `docs/plan/README.md` (the WP table).
