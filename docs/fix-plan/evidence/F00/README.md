# F00 verification record

The repository audit at `51c1b5f` records the baseline as 214/214 unit tests, passing typecheck/lint/build, 10 failing E2E tests out of 70, and visual tests silently passing without committed baselines. My pre-edit local E2E attempt did not reach test discovery because stale localhost listeners blocked Vite; the baseline figures above are from the committed audit, not a fresh run.

After the F00 changes, `typecheck.txt` passes, `lint.txt` passes with no warnings, `unit.txt` reports 19 files and 214 passing tests plus one expected F01 `flipY` failure, and `build.txt` passes (Vite reports existing large-chunk advisory warnings). `visual-after.txt` reports five failing test groups because no baseline images exist; this is intentional until F13.

`e2e-final.txt` ran 77 Chromium tests: 64 passed and 13 failed. The nine annotated F01–F03 tests count as expected failures; `known-bugs-final.txt` shows those checks plus the passing width-fit check. The 13 full-suite failures include the documented audio, editor first-run/full-flow, export, and perf failures, plus three UI/export cases. A focused rerun passed the library accessibility and Wave 5 export cases, while the context-loss export case failed again, so the full E2E run does not yet satisfy the “nothing else changed” criterion.

The width-fit mutation evidence is in `width-fit-crop-mutation.txt`: adding UV bounds from 0.1 to 0.9 made the test fail at the left-edge magenta assertion. The source file was restored, and the final focused run passed width-fit. `perf-after.txt` records the relocated, GPU-synchronized 60-frame measurement passing at 34,778 ms; the existing perf budget test failed because its page execution context was destroyed by navigation.

The executable override was exercised with local Windows Chrome using `PW_CHROMIUM_EXECUTABLE`. A cloud session was unavailable, so cloud-host launch itself remains unverified. F00 is not marked done because the full E2E run has three more failures than the audited baseline and the cloud-host criterion has not been exercised.
