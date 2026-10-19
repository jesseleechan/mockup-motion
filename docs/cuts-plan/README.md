# Cuts plan

On 19 October 2026 the owner approved the editor audit's cuts ([audit](https://claude.ai/artifact/ANtzprpDcoTPmiCdxH22Db)): "Go with your recommendations, start sessions for the cuts." The product is now flat, looping single-shot presets. Five sessions run the cuts in parallel. This file holds each session's plan under its own heading.

## Structural cuts: layouts, laptop and tablet, reels

This session removes the layouts no template builds, the laptop and tablet devices, and multi-shot reels with their transitions. The owner's decisions:

1. Cut multi-shot reels.
2. Cut laptop and tablet.
3. Saved projects must keep loading: a removed layout maps to the nearest preset look; no shot is dropped for its layout.

### Timing

The preset sessions are still changing these files: Stack (#53, #56, #57) adds the slider's deck arrangement, Responsive Scroll (#52, #54, #55, #58, #59) adds a `responsive` layout kind, Orbit (#49, merged) added `orbit`, and the iPhone phone (#50) and Mobile Scroll Story (#48) change the phone and `trio.ts`. Both PRs below stay drafts until all of those have merged into `main`; then each merges `main`, goes green, and waits for the owner's go-ahead.

Responsive Scroll's `responsive` layout is its own kind (`src/motion/layouts/responsive.ts`); it doesn't extend `pair`. It shares the Assets section's desktop and mobile pickers with `pair`, so PR 1 keeps those pickers for `responsive`. Its entrance (`ENTRANCE_DURATION`, stagger) goes with the other entrances in PR 2: in a single looping shot an entrance never plays, and nothing sets one.

### PR 1: layouts no template builds, laptop and tablet

Removes:

- `pair`, `trio`, the tilted `stack` fan, `wall` and `marquee.ts` (the Frames speed limit moves to `lanes.ts`).
- The `travel: "steps"` branches of `rows` and `columns`. `travel` becomes `"period"` only, so every rows or columns layout is Frames; `speed` goes with the marquee.
- Their Layout and Assets inspector controls, the shot card's "Change layout" entries, and their lab fixtures.
- `src/engine/devices/laptop.ts` and `tablet.ts`, the `laptop` and `tablet` device kinds, and their Device select entries and lab and visual fixtures. The `tablet` asset role stays: a screenshot's detected size, which the gallery groups by.
- The Shot inspector's Layout select lists only kinds a user can pick that work: single (by device) and Title card (until the typography session removes it). Slider, orbit, Frames and the others come from templates.

Saved projects (`sanitizeLayout`, `src/doc/legacy-layouts.ts`):

| Saved                                     | Becomes                                                                                   |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| `pair`, `trio`                            | a single browser with the desktop screenshot                                              |
| tilted `stack`                            | the Desktop Stack deck (`slider`, `axis: "y"`, `shape: "desktop"`, `arrangement: "deck"`) |
| `wall`, `rows` without `travel: "period"` | Desktop Frames (`framesLayout` at the document's aspect)                                  |
| `columns` without `travel: "period"`      | Mobile Frames (`mobileFramesLayout`)                                                      |
| `single` on a laptop or tablet            | a single browser (validation maps unknown devices to `browser`)                           |

A shot mapped to Frames or the deck also takes its preset's still camera and a cut wrap, and its duration follows the preset (Frames at least 15 s; the deck N × step). The document's style is left alone. The V1 migration in `src/doc/migrate.ts` builds the same layouts directly. Unit tests load a saved document of each kind.

Tests removed with the features (approved): `tests/e2e/layouts.spec.ts`, the pair and wall tests in `assets.spec`, the pair export in `export.spec`, `tests/wall.test.ts`, the removed layouts' parts of `layouts.test`, `removed-templates.test`, and the laptop and tablet stills. `scripts/e2e-shards.ts` and `tests/visual/stills.spec.ts` follow.

### PR 2: multi-shot reels and transitions

Removes:

- `TransitionChip`, `TransitionPopover`, `TransitionSection`, `AddShotMenu` and the Entrance select (`EntranceSection` becomes `DurationSection`).
- The store's add, duplicate, delete, move, transition and split actions, and the shot card's reorder, duplicate and split.
- The multi-shot parts of `TimelineContainer` and `schedule`, the blur, push, zoom and wipe shader, `Shot.entrance` with the entrance code in the layouts and `evaluate`, and `CameraMove.progressRange` (split shots).
- The 5 transition stills (approved) and the e2e screenshots only reels wrote.

Stays:

- The loop wrap crossfade: the schedule wrap, the two-layer composite and the fade. Responsive Scroll and other loops need it.
- `DeviceFadePass`, shared with the slider and the deck.
- The timeline with one shot: ruler, scrubber and shot card. A slim scrubber is a later polish task.

Saved reels keep shot 0 and drop the rest. Shot 0's `transitionIn` is the loop wrap: `blur`, `push`, `zoom` and `wipe` become `fade`; `cut` and `fade` stay.

### Docs

Each PR updates `contracts.md` (§2, §4, §5), `quality-bar.md`, `README.md` ("Reels") and `docs/plan/README.md`, and removes the follow-ups it resolves (pair, trio, stack, wall, tilted rows, the Layout select, reels, `Engine.pick` on the pair overlap). `docs/archive` stays as it is.
