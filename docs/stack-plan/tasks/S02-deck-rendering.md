# S02: Rendering, fade, lab fixtures

**Size:** S · **Depends on:** S01

## Required changes

1. Engine: a deck shot goes through `DeviceFadePass` as a slider does (it already will if D4 puts it on `slider`); check the entering card fades as one object with no body showing through.
2. Lab fixtures `desktop-stack-{16x9,9x16,1x1,4x5,4x3}` and `mobile-stack-*`, light and dark.
3. Stills at 1200 px wide for each fixture at rest (1.9 s) and mid-step (0.6, 1.0 s into a step) in `evidence/S02/`, one sentence each on what was checked against quality bar §3.1, §3.4 and §4.

## Acceptance criteria

- [ ] Settled cards are color-exact (ΔE < 1 against the PNG at a frontal camera).
- [ ] No screenshot cropped horizontally; the front card keeps the safe margin.
