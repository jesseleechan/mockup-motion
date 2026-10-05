# F10: Music preview sync and audio specs

**Size:** S · **Depends on:** F05

## Problems

5 of 6 audio e2e tests fail on `main`:

1. `audio.spec.ts:124`: the preview drifts **0.89 s** from the playhead after 5 seeks (target: < 40 ms). `src/editor/audio/useAudioPreview.ts` starts the source at play time but does not re-anchor on seeks, scrubs or loop wraps.
2. `audio.spec.ts:65`: Playwright strict mode fails on `getByText('50%')`, which matches both the stage-zoom option and the volume readout. This is a **test bug**; give the readout a test id.
3. `audio.spec.ts:152` (MP4 and WebM) and `:222`: an expected element is "not found". Diagnose with a Playwright trace (`--trace on`), then fix whichever is wrong:
   - **UI regression:** a missing `music-note` or `export-warnings` test id, or the download link not rendered. Fix the UI.
   - **Environment:** the H.264 or AAC encoder is unavailable in Playwright Chromium. Use the runtime probe skip (README §3, rule 3) **for the MP4 case only**; WebM with Opus must pass.
   - **Timeout:** SwiftShader too slow. Shorten the exported video to 2 s and keep every assertion.

## Required changes

1. **`useAudioPreview`**
   - Anchor to `audioContext.currentTime`. On play, seek, scrub end or loop wrap, stop the current `AudioBufferSourceNode` and start a new one at offset `playhead − track.offset`, with the scheduled fade gains applied from that point.
   - While playing, compare the expected audio position with the playhead every 250 ms, and re-anchor if they differ by more than 30 ms.
   - Mute while scrubbing.
2. Fix the test selector by adding `data-testid="music-volume-value"` to the readout and using it in the test. Do not otherwise change test logic.
3. For the "not found" failures, follow the diagnosis above. In the PR, state which case it was, with trace evidence.

## Acceptance criteria

- [ ] All audio e2e specs pass, or the MP4 spec skips with the runtime-probe message and the WebM spec passes.
- [ ] The drift after 5 seeks is < 40 ms. With re-anchoring disabled, the drift test fails (paste the output).
