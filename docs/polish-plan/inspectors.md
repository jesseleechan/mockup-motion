# Polish: the Video and Shot inspectors

From the editor audit of 19 October 2026, approved by the owner. Four items, one PR each. CLAUDE.md, fix plan §3, `contracts.md` and `quality-bar.md` apply to all four.

Polish what remains after the cuts, not what is being deleted. Each PR starts from a `main` that already has the cuts it builds on.

| #   | Item                           | Waits for                                                                        | Status           |
| --- | ------------------------------ | -------------------------------------------------------------------------------- | ---------------- |
| P1  | One background control         | Backgrounds cut (#64), chrome/finishes and camera-moves cuts, typography cut     | Proposal: owner  |
| P2  | Show only what applies         | Same as P1                                                                       | Waiting for cuts |
| P3  | The screenshot list            | Cursor cut (#62), typography cut, camera-moves cut, layouts and reels cuts (#61) | Waiting for cuts |
| P4  | Hide sections that can't apply | Same as P3                                                                       | Waiting for cuts |

## P1. One background control

Today Video inspector > Background has three controls that set one value: a Tone switch (only on presets with `toneSwitch`), a 10-swatch palette and a colour field. The palette never marks the solid Ash or Onyx as selected (`currentPalette` matches gradients only; listed in `follow-ups.md`).

![Before and after](img/background-control-mock.png)

**Proposal.** One segmented control: **Light**, **Dark**, **Custom**. Each option shows a dot of its fill. The colour row appears only when Custom is selected.

- **Light and Dark are the preset's own fills.** A template declares them (`tones: { light, dark }`, palette ids, replacing the `toneSwitch` flag). Slider, Frames, Orbit and Stack: Ash and Onyx. Scroll Story: Fog and, as its dark fill, Graphite (the Fog-matching gradient; Onyx is Graphite's first stop). A document with no template uses Ash and Onyx.
- **Custom** sets a flat solid from the colour field. Choosing Custom starts from the current fill's colour, so nothing jumps.
- **Hairline (quality bar §6).** Light and Dark take the palette's `frameAppearance`, so Dark gets the white 8% card hairline. A custom colour sets `frameAppearance` from its OKLCH lightness: below 0.5 is `"dark"` (white hairline), otherwise `"light"`.
- **What is selected.** Light or Dark when the background equals that fill (case-insensitive, gradients by stops and angle); Custom otherwise. That also fixes the `currentPalette` follow-up, since the palette grid goes.
- **Re-applying a preset** keeps the chosen tone, as `slots.ts` does today for dark. Custom is replaced by the preset's Light, as today.
- **Saved projects** load unchanged. A project on Bone, Sage or another removed swatch shows as Custom with its first stop; its gradient stays until the user picks something.
- **Grain and vignette** are not part of this control (P2 decides where they show).

Tests: unit tests for the tone read-out and the custom hairline rule in `src/templates/looks.ts`, and store-level tests for the three actions. The e2e selectors that click palette swatches move to the segmented control; no new e2e test. No still changes: the fills are the same values.

**Open question for the owner:** Scroll Story's dark fill: Graphite (gradient, matches Fog) or Onyx (flat, matches the other presets)?

## P2. Show only what applies

After the cuts, "Frame and effects" shows:

- **Shadow:** always.
- **Browser chrome and URL:** only when a shot uses a browser; URL only when the chrome shows an address bar.
- **Grain and vignette:** only when the background can band, that is a gradient. A flat fill cannot band (quality bar §6), so the presets' Ash and Onyx hide them. If a saved flat-fill project has grain or vignette above 0, the sliders stay visible so it can be turned off.
- Device finish: removed by the finishes cut; nothing to do here if it lands first.

A section with no visible control is not rendered. Unit test the visibility rules as a pure function (`frameEffectsFor(doc)`), not in e2e.

## P3. The screenshot list

`SliderScreenshots.tsx` lists file names with a remove button, an "Add screenshot" select and a drop target for files dragged from Media. It has no reordering. It serves the slider and orbit; Stack and Frames get the same list.

- Each row: drag handle, a 40 × 26 thumbnail (object-fit cover, top-aligned, from the asset's object URL), the name (truncated, full name in the tooltip), remove.
- Drag to reorder with pointer events, plus Alt+↑ / Alt+↓ on a focused row for keyboard users. Reorder is one undo step (`reorderShotAsset` in the store).
- "Add screenshot" becomes a button that opens a menu of library screenshots with thumbnails, and "Upload…" at the end.
- Frames fills lanes from the project's screenshots; the list there edits the same order.

Tests: unit tests for the store's reorder (order, undo, out-of-range). One e2e test at most, for drag reordering, if the drag is the part that has broken before; otherwise none.

## P4. Hide sections that can't apply

- **Entrance and duration** on a looping preset shows a disabled Duration slider and an Entrance select, each with a note. Hide both. Show the loop length as a read-out ("Loop 12.0 s") in the Screenshots section header or under the list.
- **Camera** after the moves cut is Still or Push in, plus intensity. Keep the section only where a shot has a camera (Scroll Story); drop easing and float if the cut leaves them with nothing to choose, and drop the section where the preset has a still camera.

Tests: unit tests for the visibility rules. Update e2e selectors that read the removed notes.

## Evidence for every PR

Before and after screenshots of the editor at 1440 × 900 and 1280 × 800, and `tests/e2e/ui-overflow.spec.ts` passing. The owner approves each PR's look before it merges.

## Follow-ups

None yet.
