# WP-02: Motion core (pure)

**Milestone:** M1 · **Depends on:** WP-00 · **Parallel with:** 01, 03, 04, 05 · **Size:** M

## Goal

Build the "brain" of the video: easing, seeded randomness, camera presets, shot scheduling with transitions and loop wrap, scroll timing, text animation timing, and `evaluate(doc, t) → FrameState`. It is all pure TypeScript and fully unit-tested. This is where "no yo-yo" and "seamless loops" become guarantees instead of hopes.

## Context (read first)

- `contracts.md` §3–§6 (stage units, layouts interface, timeline, `FrameState`)
- `quality-bar.md` §2 (all motion numbers)
- Legacy: `src/rendering/geometry.ts` `motionProgress`/`contentProgress` (the bug being replaced)

## Scope

**In** (all under `src/motion/`, with no DOM, three.js, or React imports; ESLint `no-restricted-imports` enforces this)

1. **`easing.ts`:** `ease(id, p)` for every `EasingId` using the exact curves in quality-bar §2.1. Use a cubic-bezier solver (`bezier-easing` or hand-rolled Newton-Raphson + bisection) and an analytic damped spring normalized to settle at p = 1. Every curve must satisfy `ease(0) = 0` and `ease(1) = 1`.
2. **`rng.ts`:** `mulberry32(seed)` and `hash2(a, b)`. Never use `Math.random`.
3. **`camera.ts`:** `cameraPose(move: CameraMove, aspect, p: 0..1, shotT, shotDuration) → CameraPose` with the preset table from quality-bar §2.3. `intensity` scales the delta around the midpoint pose. Float (§2.4) is added on top as one sine cycle per shot. Export `PRESET_POSES` for tests and UI previews.
4. **`timeline.ts`:** `schedule(doc)` and `activeLayers(doc, t)` implementing `contracts.md` §5 exactly, including the loop wrap (shot-0 local time clamps to 0 during the wrap blend).
5. **`scroll.ts`:** `scrollPosition(spec, shotT, shotDuration, scrollableFrames) → 0..1`. Stops, holds, eased segments, and a speed limit (quality-bar §2.2: 0.9 frame heights per second maximum). `scrollableFrames` is the scrollable distance in units of viewport heights. `minDurationFor(spec, scrollableFrames)` lets the UI explain when a shot is too short.
6. **`text-anim.ts`:** `textFrame(layer, wordCount, shotT) → TextFrame` for each `TextAnimId`, with timings from quality-bar §2.2. WP-10 tunes the visuals; this WP owns the timing math.
7. **`layouts.ts` (interface plus `single` only):** export `resolveLayout` with the signature from `contracts.md` §4. Implement only `kind: "single"` here, using the screen-aspect rules from §4 and entrance handling (`rise`: 3% rise with `expoOut` over 0.8 s; `scale`: 0.97 → 1; `stagger`: 100 ms per node). Other kinds throw `NotImplemented("WP-09")`. WP-09 fills them in.
8. **`evaluate.ts`:** assemble `FrameState` from schedule, camera, layouts, scroll, and text. Memoize layout work per `(shot.id, aspect, assetsSignature)`, never per time.

**Out:** rendering; layouts other than `single` (WP-09); text visuals (WP-10).

## Acceptance criteria

- [ ] **Easing:** endpoint tests for all ids; monotonic on [0, 1] for all except `backOut` and `spring`; overshoot of `backOut` and `spring` at most 3%.
- [ ] **No yo-yo (property test):** for every camera preset at intensity 1 with `float = 0`, each of yaw, pitch, distance, panX, and panY is monotonic over the shot.
- [ ] **Loop seams:** for single static, single `pushIn` + loop, single `orbitLeft` + loop + float, and a 3-shot loop with `fade`/`push` transitions, `evaluate(doc, 0)` deep-equals `evaluate(doc, total)` within 1e-6.
- [ ] **Schedule:** totals and overlaps match `contracts.md` §5 for cut, fade, and mixed sequences, with and without loop.
- [ ] **Scroll:** stays within 0..1, holds at stops, never exceeds the speed limit, and `minDurationFor` is consistent with `scrollPosition`.
- [ ] **Determinism:** 1,000 random docs (seeded) evaluate identically twice.
- [ ] **Performance:** `evaluate` on a 3-shot doc with 30 nodes takes under 0.3 ms on average (Vitest bench, reported in the PR).
- [ ] 100% branch coverage on `easing.ts`, `timeline.ts`, and `scroll.ts`.
