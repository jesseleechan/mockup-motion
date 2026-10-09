# PF04: Gallery order, previews, contact sheet review, visual baselines

**Size:** S · **Depends on:** PF01 and PF03 · **Owner review gate** (D11)

## Why

The gallery should open on the four presets the owner will use, and nothing here is done until the owner has seen Mobile Frames at every aspect next to Desktop Frames and approved its baselines.

## Required changes

1. **Gallery order (D12).** `BUILTIN_TEMPLATES` is Desktop Slider, Mobile Slider, Desktop Frames, Mobile Frames, then Scroll Story. Desktop Slider stays `BUILTIN_TEMPLATES[0]`, the first-run default. Check the first-run and gallery tests still assert the order as strictly as before.
2. **Preview.** PF03 committed `public/templates/mobile-frames.webm` and `.webp`. Regenerate them here if the review changed anything. Watch the clip: the columns must move (a still or empty card doesn't count), and the poster frame must show settled, readable screenshots. The WebM must stay under the 450 KiB limit in `tests/template-previews.test.ts`. The preview lasts the whole 15 s loop, as Desktop Frames' does, so `scripts/template-previews.ts` re-encodes it toward its 440 KiB long-preview budget. Today `frames.webm` is 440,884 bytes, close to the limit. If Mobile Frames doesn't fit, tune that template's re-encode in the script. Never raise the limit or shorten the clip below the loop, because the test checks the clip's duration against `schedule(doc).total`. Re-run the Desktop Frames preview only if its name or description changed in the gallery card (D4); the video itself doesn't change.
3. **Contact sheet.** Run `npm run contact-sheet` and commit the sheet for Desktop Frames and Mobile Frames side by side: 2 templates × 5 aspects × 3 times (0, 5 and 10 s), plus the two sliders at their usual times, under `docs/phone-frames-plan/evidence/PF04/`. For each Mobile Frames aspect, write one sentence on: card size against §3, margins or crop, whether any column looks sparse or crowded, and whether a screenshot repeats in a column.
4. **Watched loops.** Export each of the four presets at 4:5 with the demo content and watch three loops of each (quality bar §8). Say in the PR that you watched them and what you saw at the seam. This also settles the open "no one has watched three loops" note in the presets plan.
5. **Owner review.** Post the contact sheet and the four loop exports in the PR and wait for the owner's written sign-off. Quote it. Fix anything they raise in this PR. If the fix changes a §3 number, update `quality-bar.md` §4 and the plan README in the same PR.
6. **Visual baselines (D11).** Add Mobile Frames to `tests/visual/stills.spec.ts` the way Frames is declared (per-aspect fixtures): `mobile-frames-16x9` and `mobile-frames-9x16` at t = 0.8 and 2.4, plus `mobile-frames-4x5` at t = 0.8. Generate the Linux baselines with the Visual baselines workflow (`tests/visual/README.md`). Post the five rendered stills and get the owner's written approval before committing them.
7. **Status.** Mark PF00–PF04 Done in the plan README with links to their PRs and evidence. Move anything left over to `docs/plan/follow-ups.md`.

## Acceptance criteria

- [ ] The gallery opens with Desktop Slider, Mobile Slider, Desktop Frames and Mobile Frames first; the first-run flow starts with Desktop Slider (e2e).
- [ ] The Mobile Frames preview exists, is under 450 KB, and was watched.
- [ ] The contact sheet is committed with one sentence per Mobile Frames aspect.
- [ ] Three loops of each of the four presets were watched and reported.
- [ ] The owner's sign-off on the contact sheet and approval of the five baselines are quoted in the PR.
- [ ] CI's `unit`, `e2e` and `visual` jobs are green.
