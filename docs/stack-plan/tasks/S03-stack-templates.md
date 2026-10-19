# S03: Templates, gallery and editor

**Size:** M · **Depends on:** S02

## Required changes

1. `src/templates/desktop-stack.ts` and `mobile-stack.ts` built on `sliderTemplate` (one new spec field for the arrangement), registered in D5's order, paired in `pairs.ts`, exported from `index.ts`.
2. Editor: the Step control and screenshot list already apply to a slider shot; check the media drop, the shot card label and the Video inspector's Light/Dark switch on a deck.
3. Tests: `tests/templates.test.ts` (order, slots, tone switch, native loop with a cut wrap), `template-pairs.test.ts`, an e2e spec for applying Desktop Stack and switching to Mobile Stack, added to the lightest shard in `scripts/e2e-shards.ts`.
4. `README.md` ("Choose a template"), `docs/plan/README.md` status.

## Acceptance criteria

- [ ] Applying either preset gives one looping shot with a still camera and N × 2.0 s duration.
- [ ] Gates pass, including the full e2e suite.
