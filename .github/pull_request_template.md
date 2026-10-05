## Summary

<!-- Brief description of the changes -->

## WP

<!-- WP-XX: Title -->

## Acceptance criteria evidence

<!-- Show how each acceptance criterion was verified: test output, screenshots, etc. -->

## Quality-bar checklist

<!-- For visual work, copied from docs/plan/quality-bar.md §8 -->

- [ ] Screenshot content is not cropped horizontally, and colors match the source.
- [ ] No reversing motion. Each shot has one dominant move, and the easing comes from §2.1.
- [ ] Safe margins (§4) hold at all 5 aspects. Checked on the contact sheet.
- [ ] Shadow, grain, and vignette are within §5 ranges. No banding visible on the gradient frame at 1080p export.
- [ ] Text is at least 1.6% of frame height, with contrast that passes.
- [ ] The loop is seamless: frame(0) equals frame(total) (unit test), and there is no visible pop when watching 3 loops.
- [ ] No shimmer on screenshot text during camera moves in a 1080p30 export.

## Follow-ups

<!-- List anything you noticed but did not do (out of scope) -->
