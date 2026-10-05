# F08: Inspector and editor UI polish

**Size:** M · **Depends on:** F06

## Problems (seen at a 1600×1000 viewport, dark theme)

1. **Labels wrap onto 2–3 lines.** In the Video inspector, "Custom Background Color" wraps to three lines. Select triggers wrap too ("Standard Desktop Chrome").
2. The inspector's aspect-ratio segmented control is **cut off** (the 4:3 option is missing). It also duplicates the top-bar aspect control.
3. The Library tab label "Media (2)" wraps onto two lines. The "Browse All Templates" button puts its icon above the text.
4. **Internal identifiers are shown to users:**
   - Timeline shot label "Browser · pushIn" (`ShotCard.tsx:276`)
   - Drop hint "Assign media to row1:col3" (`Stage.tsx:359`)
   - Raw preset ids in selects
5. Copy uses title case and jargon ("Soft Gaussian", "Standard Desktop Chrome", "4K Keynote").
6. **Files far over the 400-line guideline:** `ShotInspector.tsx` (1148 lines), `ExportModal.tsx` (667, handled in F09), `store.ts` (656).

## Required changes

1. **`src/ui/Field.tsx`:** a 104 px label column with `white-space: nowrap`, `overflow: hidden` and `text-overflow: ellipsis`, plus a `title` tooltip. Add a `stacked` variant (label above the control) for long labels and wide controls. Shorten labels: "Custom background color" becomes "Color"; "Browser chrome" stays.
2. **Select and SegmentedControl triggers** never wrap. They truncate with an ellipsis and use short option labels:
   - Shadow: None / Soft / Medium / Dramatic
   - Browser chrome: Standard / Minimal / None
   - Destination: Website / Dribbble / Instagram / Story / LinkedIn & X / 4K presentation / Custom
3. **Remove the aspect control from the Video inspector.** The top bar owns it.
4. **Human labels in one place** (`src/editor/labels.ts`): maps for layout kinds, devices, camera presets (Push in, Pull back, Orbit left/right, Tilt up/down, Rise, Dolly left/right, Isometric drift, Hero tilt, Static), transitions, entrances and text animations. Use them everywhere, including the shot card label ("Browser · Push in") and the drop hint ("Drop to use this screenshot").
5. Fix the Library tab badge so "Media 2" stays on one line, and lay out the "Browse all templates" button with the icon left of the text on one line.
6. **Sentence case for all UI copy.** Search `src/editor` and `src/ui` for title-cased labels and fix them.
7. **Split `ShotInspector.tsx`** into `inspector/shot/` sections: Layout, Assets, Camera, Entrance and duration, Transition, Scroll, Cursor and Text layers. Each section stays under 300 lines. Behaviour does not change.
8. **Overflow guard test** (`tests/e2e/ui-overflow.spec.ts`): at 1280×800 and 1600×1000, in dark and light themes, with the Video, Shot and Text inspectors open in turn, no element inside `[data-panel]` has `scrollWidth > clientWidth + 1` unless it is a designated scroll container. Add `data-panel` to the library, inspector and timeline roots.

## Acceptance criteria

- [ ] The overflow guard passes. Re-adding a long label makes it fail (paste the output).
- [ ] No raw id (camelCase preset, node id) appears in the UI text: an e2e test greps `document.body.innerText` for `/pushIn|heroTilt|isoDrift|row\d+:col\d+/` and finds nothing.
- [ ] Commit before and after screenshots of the Video inspector, Shot inspector, Text inspector, Library and Timeline under `docs/fix-plan/evidence/F08/`.
