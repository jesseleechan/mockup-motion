# WP-09: Layouts and camera framing

**Milestone:** M1 · **Depends on:** WP-02 (`layouts.ts` interface, `single`), WP-03, WP-06 (device proportions) · **Size:** L

## Goal

Implement every composition (single, pair, trio, marquee rows, phone columns, isometric wall, cascading stack, title) so each one fills the frame beautifully at all 5 aspects. Add automatic camera framing that guarantees safe margins under every camera move.

## Context (read first)

- `contracts.md` §2 `Layout`, §3, §4, §5 (marquee speed snapping)
- `quality-bar.md` §2.3, §2.5 (marquee speed limit), §4 (all composition rules)
- WP-02's `single` implementation and entrance handling, and WP-06's device sizes

## Scope

**In**

1. **`resolveLayout` for every `Layout.kind`** (`src/motion/layouts.ts`, split into `src/motion/layouts/*.ts` per kind):
   - **`pair`:** `overlap` follows quality-bar §4 (phone in front, overlapping the right edge by 10–16%). `side` places them side by side with a gap of 6% of the frame width. In portrait aspects, `overlap` places the phone lower-right over the browser's bottom third.
   - **`trio`:** desktop at the back center, tablet left-front, phone right-front, depth offsets 0.05 and 0.09. Without a tablet, falls back to `pair overlap`.
   - **`rows`** (marquee): `rows` 1–3, group `tilt` as a 3D rotation (rx = tilt × 0.6, rz = −tilt) about the stage center. Adjacent rows run in opposite directions, offset by half a period. Speed is snapped to `k · period / totalDuration` so loops are seamless. No asset repeats within a row's visible window (enough copies so the frame is always covered, plus one).
   - **`columns`**: phone marquee in counterflow (same rules, vertical).
   - **`wall`**: a grid on a plane rotated to an isometric view (rx −50°, rz 35° as the starting value; tune by eye and document it), with each column drifting by period and alternate columns offset.
   - **`stack`**: 3–5 devices fanned in depth (z step 0.06, x step 0.07, ry 6–10° by `spread`), with the front device fully visible.
   - **`title`**: no nodes.
   - Entrances (`Shot.entrance`) apply to every kind (stagger order follows depth, back to front).
2. **Auto-framing (`src/motion/framing.ts`)**
   - `frameDistance(nodes, aspect, pose) → distanceMultiplier`. Project every bounded node's corners under the pose and solve for the distance that keeps them inside the frame minus a 7% margin (quality-bar §4). This feeds `evaluate`, so camera presets stay relative to the framed composition at every aspect.
   - Marquee and wall layouts are "full-bleed": instead of fitting, ensure the content **covers** the frame with no background gaps along the travel direction at any `t`.
3. **Repetition and size rules.** No asset twice within a row or column window. Primary device sizes stay within the quality-bar §4 ranges.

**Out:** rendering changes (the engine already draws nodes), scroll and cursor (WP-15), templates (WP-11).

## Acceptance criteria

- [ ] **Framing test matrix:** every non-marquee layout × every camera preset × 5 aspects × t ∈ {0, 0.25, 0.5, 0.75, 1}·duration, at intensity 1. All projected corners sit inside the frame minus the 7% margin (pure unit test, no GPU).
- [ ] **Full-bleed test:** for marquee and wall layouts, the projected content covers the frame at 60 sampled times per loop.
- [ ] **Loop test:** the marquee node transforms at t = 0 and t = total match, up to a node-id permutation.
- [ ] **Repetition test:** no asset id repeats within any visible window for 3–12 assets.
- [ ] **Size test:** the single-device and phone size ranges hold at all aspects.
- [ ] Attach a `/lab` contact strip for every layout at 16:9, 9:16, and 4:3 with demo assets. Check them against quality-bar §4.
