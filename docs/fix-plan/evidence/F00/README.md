# F00 verification record

The audit at `51c1b5f` records 214 passing unit tests, passing typecheck/lint/build, 10 E2E failures among 70 tests, and visual tests that passed without baselines. The original pre-follow-up F00 run at `66449be` is recorded in the files in this directory: 64 E2E passed and 13 failed, five visual groups failed because baselines are absent, and the width-fit UV mutation failed at the left-edge assertion. Those E2E counts are from this environment; the original audit counts are from another environment, and a baseline comparison could not be run.

The original run also did not exercise the configured executable override on a cloud host. Its known-bug artifact covered nine tests from the earlier source snapshot and is not evidence for the follow-up tests now in `tests/e2e/assets.spec.ts`.

The F00 follow-up now makes font-readiness errors visible, makes contact-sheet generation fail when the canvas is missing, and makes template-preview generation fail when the expected WebM is absent. The added F03 expected-failure coverage uses the APIs available before F03: distinct pair-screen colors, provider requests for each image in pair/trio/rows/columns/wall/stack, a delayed earlier text raster, texture memory after alternating single-asset documents, and a 640×360 WebM decoded at 0.5 seconds. Results for this follow-up are pending the focused rerun; no F00 completion claim is made here.

F01 owns the correction to the orientation tests: isolate card, browser, phone, tablet, and laptop assertions; measure text within glyph ink bounds; and add the decoded exported-video orientation assertion. F02 owns the additional 180° gradient-direction assertion. F03 owns tests that require its new `collectAssetIds` and `debugInfo` APIs, including all-template texture-state assertions. This F00 follow-up does not mark F00 Done.

The earlier verification notes remain useful only for their original source snapshot. In particular, the full-suite failures are not classified as regressions because a baseline run could not be made in this environment. The missing visual baselines remain an intentional F13 failure.
