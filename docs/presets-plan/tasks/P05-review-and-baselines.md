# P05: Gallery order, previews, contact sheet review, visual baselines

**Size:** S · **Depends on:** P03 and P04 · **Owner review gate**

## Why

The presets are meant to be the ones people reach for first, so they lead the gallery. Nothing here is done until the owner has seen every aspect and approved the baselines.

## Required changes

1. **Gallery order (D1).** Put Desktop Slider, Mobile Slider and Frames first in `BUILTIN_TEMPLATES`. `BUILTIN_TEMPLATES[0]` is the first-run default and the gallery's initial selection, so update the first-run tests (`tests/first-run.test.ts`, the related e2e specs) to the new default. Don't weaken them: they should check the new default as strictly as they checked the old one.
2. **Previews.** Run `npm run template-previews` and commit the three new `public/templates/<id>.webm` and `.webp` files. Look at each one; a preview that shows a still or an empty card doesn't count.
3. **Contact sheet.** Run `npm run contact-sheet` and commit the sheet for the three presets (3 templates × 5 aspects × 3 times) under `docs/presets-plan/evidence/P05/`. Choose the times so the sheet shows a slider at rest, mid-step and settling.
4. **Owner review.** Post the contact sheet and the reference strips from P02 and P04 in the PR and wait for the owner's written sign-off. Quote it in the PR. Fix anything they raise in this PR.
5. **Visual baselines.** Add the three templates to `TEMPLATES` in `tests/visual/stills.spec.ts`. For the sliders, add a mid-step time (step start + 0.5 s) as well as the rest pose. Generate the Linux baselines with the Visual baselines workflow (`tests/visual/README.md`) and get the owner's written approval of the rendered stills before committing them.
6. **Status.** Mark P00–P05 Done in the plan README with links to their PRs and evidence. Add anything left over to `docs/plan/follow-ups.md`.

## Acceptance criteria

- [ ] The gallery opens with the three presets first; the first-run flow starts with the D1 default (e2e).
- [ ] Template previews exist for all three and were looked at.
- [ ] The owner's sign-off on the contact sheet and approval of the baselines are quoted in the PR.
- [ ] CI's `unit`, `e2e` and `visual` jobs are green.
