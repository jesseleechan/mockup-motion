# F00 verification record

The audit at `51c1b5f` records 214 passing unit tests, passing typecheck/lint/build, 10 E2E failures among 70 tests, and visual tests that passed without baselines. The original pre-follow-up F00 run at `66449be` is recorded in the files in this directory: 64 E2E passed and 13 failed, five visual groups failed because baselines are absent, and the width-fit UV mutation failed at the left-edge assertion. Those E2E counts are from this environment; the original audit counts are from another environment, and a baseline comparison could not be run.

The original run also did not exercise the configured executable override on a cloud host. Its known-bug artifact covered nine tests from the earlier source snapshot and is not evidence for the follow-up tests now in `tests/e2e/assets.spec.ts`.

The F00 follow-up now makes font-readiness errors visible, makes contact-sheet generation fail when the canvas is missing, and makes template-preview generation fail when the expected WebM is absent. The added F03 expected-failure coverage uses the APIs available before F03: distinct pair-screen colors, provider requests for each image in pair/trio/rows/columns/wall/stack, a delayed earlier text raster, texture memory after alternating single-asset documents, and a 640×360 WebM decoded at 0.5 seconds. Follow-up results are below; no F00 completion claim is made here.

F01 owns the correction to the orientation tests: isolate card, browser, phone, tablet, and laptop assertions; measure text within glyph ink bounds; and add the decoded exported-video orientation assertion. F02 owns the additional 180° gradient-direction assertion. F03 owns tests that require its new `collectAssetIds` and `debugInfo` APIs, including all-template texture-state assertions. This F00 follow-up does not mark F00 Done.

The earlier verification notes remain useful only for their original source snapshot. In particular, the full-suite failures are not classified as regressions because a baseline run could not be made in this environment. The missing visual baselines remain an intentional F13 failure.

## Follow-up run (2026-10-05)

On the F00 follow-up source, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` all passed. Vitest reported 19 files and 214 tests passed, plus one existing expected failure. Full native Chromium E2E ran 80 tests: 72 passed and 8 failed. The eight failures are in existing audio UI/seek/export specs, editor export flow, first-run template gallery, and export-speed spike. The 12 marked known-bug tests (5 F03, 4 F02, 3 F01) reported as expected failures, with no unexpected failures among them. `devices.spec.ts` width-fit passed; its earlier 10%-crop mutation failure remains in `width-fit-crop-mutation.txt`.

The focused F03 follow-up was rerun after formatting and produced 5 expected failures, 0 unexpected failures, and 0 skips. All five reached their intended pixel/state assertions: pair rendering found only 30 red pixels (expected >100); multi-layout loading reported all 17 image IDs missing; the newer text raster had 0 green pixels (expected >20); decoded WebM had 2 desktop red pixels (expected >100); and alternating documents grew texture count from 6 to 24. The raw Playwright JSON is in `focused-followup.json`, with a readable excerpt in `focused-followup.txt`.

The local run selected installed Chrome through the existing platform configuration. It did not exercise `PW_CHROMIUM_EXECUTABLE` against the mismatched cloud Chromium binary, so the cloud-launch acceptance criterion remains unverified. F00 remains in progress; no status change is claimed. Current gate and full-suite output is saved in the `*-followup.txt` files in this directory.

## Isolated-cache URL follow-up (2026-10-05)

The responsive-pair WebM known-bug test now selects the already-loaded Mediabunny resource by URL pathname suffix (`/deps/mediabunny.js`), preserving the full query URL for dynamic import. With a private Vite cache at `.execution/vite-cache-f00` and the focused test server on port 3100, Playwright reported 1 expected failure, 0 unexpected failures, and 0 skips. The test completed export and reached the expected desktop-pixel assertion (2 red pixels, expected >100), proving setup no longer fails while locating the module. See `focused-cache-followup.json`.
