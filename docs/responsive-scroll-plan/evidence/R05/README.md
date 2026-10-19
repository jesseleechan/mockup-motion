# R05 evidence: Responsive Scroll template

## Gallery (D1)

![gallery, Mobile tab](gallery-mobile.webp)

The Mobile tab shows Responsive Scroll next to Mobile Slider and Mobile Frames, with the chip "Desktop + mobile". The Desktop tab shows it after Scroll Story, and All shows it last. The poster is the first hold, with Aurelia's hero on both screens (`scripts/template-previews.ts` takes it at 5% of the loop; the usual 35% frame is Aurelia's dark works section, which compressed below the 15 KB placeholder floor).

## Editor

![editor](editor.webp)

Applied with demo content: Aurelia's desktop and mobile full pages as flat cards on Ash. The loop is 9.4 s; the shot is 10.2 s, including the 0.8 s wrap crossfade. The Camera section is hidden (still camera), and the duration is "Set by the scroll stops".

![inspector](inspector.webp)

Scroll stops: the shared sections minus the header (the top is always the first stop), with Works, Materials and Monograph on by default, the hint, and Hold (0.6–1.2 s, quality bar §2.2). Without section data the section shows "Add the capture's JSON file to stop on sections."; with section data that shares nothing it shows "These pages share no sections, so stops are spaced evenly."

## Tests

- `tests/responsive-scroll-template.test.ts` (8): gallery tabs, the built document (Ash, no shadow, grain 0, vignette 0, still camera, fade wrap, 10.18 s), requirements, page names, slot pairing by capture URL and by file name, the fallback, and keeping the user's assignment.
  - With the same-page step disabled: 2 failed (both pairing tests).
- `tests/e2e/responsive-scroll.spec.ts` (R05, 2): the card sits under the Desktop and Mobile tabs with "Desktop + mobile"; applying with demo content builds the responsive shot, the Works switch is on, turning Statement on sets the sections in page order and adds more than a hold to the shot, and "Use default stops" restores the default.
- Shared tests updated for a sixth template: `tests/templates.test.ts` (count, gallery order, the "both" category, the loop seam covers Responsive Scroll through the wrap crossfade), `tests/preset-tone.test.ts` (it has the Light / Dark switch), `tests/template-previews.test.ts` (count), `tests/sections.test.ts` (an explicit scroll template, like Scroll Story), and the e2e counts in `first-run`, `wave5` and `thumbnails`.
