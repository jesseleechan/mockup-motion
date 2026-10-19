# R02 evidence: section data on assets

No visual change; the evidence is the tests.

- `tests/capture-json.test.ts` (11 tests): parsing and its errors, section keys, CSS px → image px (Aurelia mobile works: 1602 CSS px → 3204 image px at 2×), file stems, the 2 px size fit, matching by stem and by size (one fit only, never a same-name image of another size), a capture added later attaching to its library screenshot, validation keeping well-formed sections and dropping the rest, and demo full pages carrying their sections.
  - Fails with validation bypassed (`ref.meta = a.meta`): "keeps well-formed section data through validation and drops the rest", 1 failed | 10 passed.
- `tests/e2e/responsive-scroll.spec.ts` (3 tests, Chromium): Aurelia's two full pages dropped with their capture JSON files keep sections in image px (desktop works 1664, mobile works 3204), a JSON added later attaches to its screenshot, and an unmatched JSON shows "aurelia-desktop-1440.json: no screenshot matches this capture file."
  - Fails with the media tab's `applyCaptures` call removed: 3 failed (Expected 1664, Received undefined; Expected 3204, Received undefined; toast not visible).
