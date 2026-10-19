# S04 evidence: contact sheet, loop seam, baseline candidates

Rendered 18 October 2026 on Linux (Playwright Chromium 1194, SwiftShader).

## Contact sheet (`contact-sheet/`)

`npm run contact-sheet -- --templates desktop-stack,mobile-stack --aspects 16:9,9:16,1:1,4:5,4:3 --times 0.6,1.2,1.95`: both presets at all five aspects, early in the first step (0.6 s), mid-step (1.2 s) and settled (1.95 s), 960 px wide. Open `contact-sheet/index.html`. Checked against the quality bar:

- §3.1: no card is cropped sideways; tall screenshots are cropped at the bottom only. Settled cards are colour-exact (S02 e2e, ΔE < 1).
- §2.5: one move per step, the front card leaving and the deck following on `slide`; nothing reverses (S01 unit test).
- §4: the deck at rest is centred with at least 7% of the shortest side clear at every aspect (unit test). **Tuned in this review:** with the preview's deck-height cap of 0.8, the Desktop Stack front card spanned 58% of the frame width at 16:9, under the 62–74% a single desktop device gets. The cap is now 0.86 (recommended in this PR; the coordinating session relayed "go with your recommendation" on 19 October 2026). Measured on the re-rendered 16:9 still: the front card spans 62.4% of the frame width with 9.0% and 9.2% of the frame height clear above and below the deck. 4:3 gets the same larger card (78% of the width); 9:16, 1:1 and 4:5 are unchanged (their width cap binds). The contact sheet, the three Desktop Stack 16:9 candidates and the Desktop Stack gallery preview were re-rendered with it.
- §5: shadow none, grain 0, vignette 0.

## Loop seam

Rendered at 1080 px (4:5) and 1920 px (16:9) for both presets with the 5-screenshot preview documents (10 s loops): the last frame before the loop point (9.9667 s, one 30 fps frame early) against the first (0 s), and the frame before a step boundary (1.9667 s) against the boundary (2.0 s). Maximum per-channel difference: **0** in all eight comparisons. The loop and the steps are pixel-identical across their seams, so there is nothing to pop; the gallery preview WebMs (`public/templates/*-stack.webm`) show the loop playing.

## Baseline candidates (`baseline-candidates/`)

D7's 10 stills, rendered from the same lab fixtures `tests/visual/stills.spec.ts` would use, 1280 px wide, lossless WebP. The owner approved them on 19 October 2026: "I approve the stills and baselines you're waiting on. Go with your recommendation on every open decision." The Linux baselines in `tests/visual/stills.spec.ts-snapshots/` were then rendered by the Visual baselines workflow from the same commit.

| File                                                                              | What it shows                                                                                 |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `desktop-stack_16x9_t1.9.webp`                                                    | At rest: Field Notes in front, Maison Oak and Aurelia peeking below.                          |
| `desktop-stack_16x9_t2.5.webp`                                                    | Mid-step: Field Notes leaving up through the top edge, Maison Oak coming forward.             |
| `desktop-stack_9x16_t1.9.webp`, `desktop-stack_9x16_t2.5.webp`                    | The same at 9:16: the front card 0.84 of the frame width.                                     |
| `mobile-stack_16x9_t1.9.webp`                                                     | At rest: Maison Oak in front, Aurelia and Field Notes peeking right.                          |
| `mobile-stack_16x9_t2.5.webp`                                                     | Mid-step: Maison Oak leaving left, Aurelia coming forward, Studio Kova fading in at the back. |
| `mobile-stack_9x16_t1.9.webp`, `mobile-stack_9x16_t2.5.webp`                      | The same at 9:16.                                                                             |
| `desktop-stack-dark-16x9_16x9_t2.5.webp`, `mobile-stack-dark-16x9_16x9_t2.5.webp` | Onyx, mid-step: the white 8% hairline keeps the dark cards' edges visible.                    |
