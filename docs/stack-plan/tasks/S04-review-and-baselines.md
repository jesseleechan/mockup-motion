# S04: Previews, contact sheet, baselines (owner review gate)

**Size:** S · **Depends on:** S03

## Required changes

1. `npm run template-previews` for the two presets (no placeholders).
2. `npm run contact-sheet` for both presets at all five aspects and three times, light and dark, committed under `evidence/S04/`. Tune the §1 numbers here if needed and record the final ones in quality bar §4 and `reference.md`.
3. A WebM of three loops of each preset at 4:5 and 16:9; watch them for a pop at the seam.
4. Show the owner the contact sheet and the D7 stills. **Only after their written approval**, render the Linux baselines through the Visual baselines workflow and add the stills to `tests/visual/stills.spec.ts`.

## Acceptance criteria

- [ ] The owner's approval is quoted in the PR.
- [ ] CI `unit`, `e2e` and `visual` are green.
