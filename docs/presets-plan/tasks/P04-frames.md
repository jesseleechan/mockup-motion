# P04: Frames: rows options, native loop, template

**Size:** M · **Depends on:** P00, and `fix/marquee-speed` merged into `main`

## Why

Frames is a flat, three-row marquee of desktop cards. The `rows` layout already alternates direction and offsets adjacent rows by half a period. It lacks three things: the reference's larger cards and tighter gaps, a native loop, and the speed limit decided in D2.

## Context

- `reference.md`, "Frames 1-01".
- `src/motion/layouts/rows.ts` and `marquee.ts` (re-read them on the latest `main`), `src/templates/portfolio-rows.ts`.
- `contracts.md` §5 and quality bar §2.5 and §4, as updated in P00.

## Required changes

1. **Rows options.** Add the optional `cardHeight`, `gap` and `travel` fields from P00 to the `rows` layout. Leave the fields unset and existing templates render exactly as before (the existing visual baselines must not change).
2. **Native loop (`travel: "period"`).** Every row travels exactly one asset period (N × pitch) per loop, with alternating direction, so frame(total) ≡ frame(0) with a `cut` wrap. Speed is therefore `N × pitch / duration` and follows the shot duration. Rows still sit half a period apart, so the same screenshot never lines up in adjacent rows.
3. **Speed limit.** Apply D2. With the recommended rule, a Frames layout stays at or under 0.20 frame heights per second. Export a helper `framesDuration(layout, aspect)` that returns the shortest duration that keeps under the limit, rounded up to 0.5 s. Templates and the editor use it as the minimum shot duration.
4. **Composition per aspect.** At 4:5, 9:16 and 1:1, use 3 rows with card height 0.315 and gap 0.065 (the reference). At 16:9 and 4:3, use 2 rows with card height 0.42 and the same gap, so a row window shows at most 4 cards. Check these on the contact sheet and adjust if a row shows a repeated screenshot or looks sparse. If you adjust, update `reference.md` and say why in the PR.
5. **Template.** Add `src/templates/frames.ts`: category `portfolio`; slots `desktop1`–`desktop4` required and `desktop5`–`desktop6` optional; device `card`, tilt 0, `travel: "period"`; duration from `framesDuration`, with a 15 s floor so the default feel matches the reference; `loop: true` with a `cut` wrap; camera static; Ash background, shadow off, grain 0, vignette 0. Dedupe slot assets.
6. **Editor.** For a rows layout with `travel: "period"`, the speed slider is replaced by one short line ("Speed follows shot length"), and the duration control enforces the `framesDuration` minimum.

## Tests

- Existing rows tests and the 12 existing visual baselines pass unchanged.
- Loop seam: for N = 4…6 and all five aspects, the Frames nodes at t = 0 and t = duration are identical.
- Direction: row r moves left when r is even and right when r is odd. Position over time is linear with no reversal.
- No repeats: within each row's visible window, no asset appears twice at any sampled time, for N = 4…6 at all aspects.
- Speed: each row's speed is at or under the D2 limit at every aspect, for N = 4…6.
- Template: Frames builds at all five aspects, `schedule(doc).total` equals the shot duration, and `evaluate(doc, 0)` equals `evaluate(doc, total)`.

## Evidence (`docs/presets-plan/evidence/P04/`)

- A 4:5 strip at t = 0, 5 and 10 s next to the reference at the same times.
- One still per aspect at t = 0 (5 stills), each with one sentence on what you checked.

## Acceptance criteria

- [ ] The tests above pass and each fails when its change is reverted.
- [ ] At 4:5, card size, gaps and row placement match `reference.md` within 3%.
- [ ] A 4:5 export loops without a visible pop over three loops. Say in the PR that you watched it.
- [ ] Gates pass, including `test:e2e` and `test:visual` (existing baselines unchanged).
