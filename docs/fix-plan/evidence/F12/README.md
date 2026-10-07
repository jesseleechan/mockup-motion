# F12 evidence

Before crops come from the captures on `main` (b09b8c9). After crops come from this branch's `npm run demo:capture`. Each pair is cropped at the same element, measured in the page. Desktop crops are 1440-wide captures at 1×. Mobile crops are 390-wide captures at 2×, shown at 50%.

- `01-studio-kova-nav-*.png`: the capture collapsed the sticky header to its content width, so "KOVA® [2026]" ran into "INDEX" (all five sites had this bug). The fix is in `scripts/capture.ts`.
- `02-studio-kova-chronos-*.png`: the "CHRONOS" label now sits centred inside its circle, and the SVG cards no longer show letterbox bands.
- `03-studio-kova-mobile-awards-*.png`: the awards table at 390: three cramped columns become year plus a title and work stack.
- `04-aurelia-hero-image-*.png`: the hero showed a screenshot of another website (its own headline and nav). It is now only the photograph, cropped from the same image.
- `05-aurelia-metric-label-*.png`: the typo "Passive Mass Mass" is now "Passive Cooling".
- `06-aurelia-works-thumbs-*.png`: the work thumbnails match the SVG's 4:3 aspect, so the bands above and below the artwork are gone.
- `07-field-notes-nav-*.png`: the sticky nav sat at half width, left-aligned. It is now full width and centred under the masthead.
- `08-field-notes-mobile-nav-*.png`: at 390 the nav overflowed to 422 px (the old mobile capture was 844 px wide), and the masthead and byline were crushed into three columns.
- `09-field-notes-mobile-footer-*.png`: at 390 the footer wordmark wrapped into the tagline. They now stack.
- `10-field-notes-svg-labels-*.png`: the transect label no longer runs through the sun disc, "TRUE NORTH" no longer touches the compass ring, and the side bands are gone.
- `11-maison-oak-mobile-products-*.png`: four very tall single-column product cards become a 2 × 2 grid.
- `12-northwind-console-*.png`: the console sidebar ended halfway down, leaving an empty column. Two feed items now fill it.
- `13-northwind-mobile-chart-*.png`: the chart kept a fixed 220 px height at phone width and floated in a mostly empty box. It now keeps its aspect.
- `14-northwind-mobile-code-*.png`: the code sample wrapped mid-statement at 390. It is now shorter and fits without wrapping.

Template stills, rendered from `/lab?still=1&fixture=<template>&w=1200&aspect=16:9` at half the schedule after the recapture. All 12 templates were rendered and checked; these two show the fixed captures inside a template:

- `stills/scroll-story-16x9-t50.png`: Studio Kova's full desktop capture mid-scroll, with CHRONOS centred in its circle and no letterbox bands in the cards.
- `stills/responsive-trio-16x9-t50.png`: Field Notes at desktop, tablet and phone, with the nav full width and centred and the phone masthead stacked.
