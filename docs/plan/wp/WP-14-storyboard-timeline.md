# WP-14: Storyboard timeline and transitions

**Milestone:** M2 · **Depends on:** WP-02 (`schedule`), WP-03 (compositor), WP-12 (timeline container) · **Parallel with:** 13 · **Size:** L

## Goal

Let designers build short case-study reels: a storyboard of shots with durations and elegant transitions, scrubbed as one continuous video. It stays a storyboard, not a full keyframe editor.

## Context (read first)

- `contracts.md` §2 (`Shot`, `Transition`), §5 (scheduling and loop wrap), §6
- `quality-bar.md` §2.2 (transition durations and easing)
- WP-12 timeline container and selection model; WP-05 primitives (Popover, ContextMenu)

## Scope

**In**

1. **Timeline UI (`src/editor/Timeline/`, 148 px tall)**
   - Time ruler with labels every 1 s (or 0.5 s when zoomed in), and a playhead you can drag anywhere (pointer capture) or click to seek. Shift snaps to shot boundaries.
   - **Shot cards** have a width proportional to on-screen duration. Each shows a thumbnail rendered by the engine at the shot's midpoint (cached, re-rendered when the shot changes, debounced 300 ms), a label (layout · camera, e.g. "Browser · Push in"), and its duration.
   - Click selects (the inspector shows the Shot panel). Drag the right edge to change duration (0.1 s snap, Shift for 0.5 s, range 1–30 s); one drag is one undo transaction.
   - `@dnd-kit` reorder.
   - Context menu: Duplicate, Delete (not the last shot), Change layout ▸, Split here (two shots at the playhead with the same layout; the camera move splits at that point).
   - **Transition chips** between cards (and a wrap chip at the end when the doc loops) open a popover: kind (with tiny animated previews), duration (0.2–1.5 s, default 0.7 s), easing, direction. The overlap is drawn visually, so the cards overlap by the transition duration.
   - **Add shot (+)** after the selected shot opens a menu: "Same layout", "From template ▸" (adds that template's shot with the current assets), and "Title card".
   - **Text lanes:** a thin lane under each shot showing text layers as pills from `delay` to the end of the shot. Click to select a text layer. Dragging a pill changes `delay`.
   - Timeline zoom: fit, plus Ctrl or pinch.
2. **Transitions in the engine** (`src/engine/compositor.ts` + final pass): `fade`; `blur` (both layers blur toward the middle of the transition, peaking at 1.2% of frame height); `push` (the outgoing shot slides out and the incoming slides in, in the given direction, `quintInOut`, with no gap); `zoom` (incoming 1.06 → 1, outgoing 1 → 0.96 with fade); `wipe` (soft diagonal mask, 6% feather). All are driven by `FrameState.transition`.
3. **Store actions:** `addShot`, `duplicateShot`, `removeShot`, `moveShot`, `splitShot`, `setShotDuration`, and `setTransition`. Each is one undo step (drags use transactions).

**Out:** audio lanes (WP-17); per-property keyframes (deliberately out of scope).

## Acceptance criteria

- [ ] The displayed total duration always equals `schedule(doc).total` (unit test plus an E2E check).
- [ ] Unit tests for `splitShot`: camera continuity (the pose at the split equals the original pose at that time) and the sum of durations.
- [ ] Multi-shot loop seam test passes for every transition kind (WP-02 harness).
- [ ] Attach frame strips at transition progress 0, 0.25, 0.5, 0.75, and 1 for every transition kind.
- [ ] **E2E:** build a 3-shot reel, reorder it, change a transition, export it, and check that the duration matches the schedule within ±1 frame.
- [ ] The timeline works with the keyboard (Tab to shots, arrows to move the selection, Enter to open the transition popover). Axe is clean.
