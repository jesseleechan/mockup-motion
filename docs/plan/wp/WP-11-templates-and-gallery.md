# WP-11: Templates, slot filling, previews, and contact sheet

**Milestone:** M1 (single-shot templates) → M2 (Scroll Story and reels) · **Depends on:** WP-04, WP-06, WP-07, WP-08, WP-09 (WP-15 for Scroll Story; WP-10 and WP-14 for reels) · **Size:** L

## Goal

Create 12 curated templates that produce Jitter-quality results with zero tweaking, a reliable way to fill them with the user's screenshots, real animated previews for the gallery, and a contact sheet for review. **This is the user-facing heart of the product.**

## Context (read first)

- `contracts.md` §8 (Template API), §2, §5
- `quality-bar.md` (all of it). Templates are where its defaults become concrete.
- WP-01 `LEGACY_PRESET_TO_TEMPLATE` (keep the ids consistent)

## Scope

**In**

1. **Registry and slot filling (`src/templates/registry.ts`, `slots.ts`)**
   - `fillSlots` per `contracts.md` §8.
   - `applyTemplate(template, doc) → { style, shots, loop }`: fill slots from `doc.assets`, preferring the previous assignments. Keep brand style (fonts, text color, accent) when `ctx.style` is provided.
   - Each template file exports a `Template` and a `previewDoc()` built from the demo manifest.
2. **The 12 templates** (one file each; the defaults below are starting points to tune by eye against the quality bar):

   | Id | Name | Shots | Layout and camera | Look |
   |---|---|---|---|---|
   | `quiet-hero` | Quiet Hero | 1 × 6 s, loop | `single` browser · `pushIn` 0.7, `smooth` · entrance `rise` | Bone, soft shadow |
   | `tilted-showcase` | Tilted Showcase | 1 × 6 s, loop | `single` browser · `heroTilt` 1.0 + float 0.5 | Fog or Graphite, medium shadow |
   | `responsive-pair` | Responsive Pair | 1 × 6 s, loop | `pair overlap` · `orbitRight` 0.6 · entrance `stagger` | Mist mesh |
   | `responsive-trio` | Responsive Trio | 1 × 7 s, loop | `trio` · `dollyLeft` 0.6 · entrance `stagger` | Fog |
   | `phone-spotlight` | Phone Spotlight | 1 × 6 s, loop | `single` phone · `orbitLeft` 0.8 + float 0.6 | Dusk mesh or Ink |
   | `phone-parade` | Phone Parade | 1 × 8 s, loop | `columns` 3, tilt 12°, speed 0.4 · `static` | Fog / Graphite |
   | `portfolio-rows` | Portfolio Rows | 1 × 8 s, loop | `rows` 2, tilt 8°, speed 0.35 · `static` | Graphite, dark frames |
   | `isometric-wall` | Isometric Wall | 1 × 8 s, loop | `wall` 4 cols, speed 0.3 · `isoDrift` | Bone or Ink |
   | `cascade-stack` | Cascade Stack | 1 × 6 s, loop | `stack` 4 · `pullBack` 0.7 · entrance `stagger` | Mist mesh |
   | `scroll-story` *(M2, with WP-15)* | Scroll Story | 1 × 10 s | `single` browser (phone variant if the slot gets a mobile asset) · `pushIn` 0.2 · scroll **enabled** with auto stops | Bone / Fog |
   | `launch-reel` *(M2, with WP-10 + WP-14)* | Launch Reel | title 2.5 s → hero 4 s → pair 4 s → end card 2.5 s | title `fadeUp` · `blur` → `quiet-hero` shot · `push` → `responsive-pair` shot · `fade` → end card with logo and URL | Ambient from the primary screenshot |
   | `case-study-reel` *(M2, with WP-10 + WP-14)* | Case Study Reel | 3–5 pages × 3.5 s + end card | `single` browser per page, cameras alternating `orbitLeft`, `pushIn`, `orbitRight`, `pullBack` · `push` transitions · optional captions | Graphite or Bone |

   - Every template adapts to all 5 aspects. For portrait, `pair` uses the portrait arrangement, rows become 3, and columns become 2.
   - Slots require enough distinct assets for marquee and wall layouts (at least 3). With too few assets, the gallery shows "Needs 3+ desktop screenshots" and disables apply (no repetition fallback in templates).
3. **Template previews (`scripts/template-previews.ts`)**
   - Render each template's `previewDoc()` through `/lab` in Playwright to `public/templates/<id>.webm` (VP9, 640 × 360 or 360 × 640, 24 fps, ≤ 450 KB) plus `public/templates/<id>.webp` (poster).
   - Commit the outputs. A gallery card plays the video on hover and keyboard focus, and shows the poster under `prefers-reduced-motion`.
4. **Contact sheet (`scripts/contact-sheet.ts`, `npm run contact-sheet`):** render every template × 5 aspects × t ∈ {0.1, 0.35, 0.6, 0.85}·total as 1080p PNGs, plus `contact-sheet/index.html` (a grid with labels). Git-ignore the output.
5. **`/lab` gallery** to apply templates to demo or uploaded assets (M1 review surface until WP-12).

**Out:** gallery UI in the editor (WP-12 uses your registry and preview files).

## Acceptance criteria

- [ ] Every M1 template passes the WP-09 framing and full-bleed tests and the WP-02 loop seam test at all 5 aspects (parameterized test over the registry).
- [ ] `fillSlots` tests: role correctness, no cross-role assignment, preference for tall assets, preserving previous assignments, the "needs N" state.
- [ ] Previews are generated within budget for every template, with a reproducible script.
- [ ] **User review gate:** the contact sheet for the 9 single-shot templates is attached to the PR, and the user signs off on the look before M2 UI work builds on it. Include the quality-bar checklist per template.
- [ ] M2 follow-up PR: `scroll-story`, `launch-reel`, and `case-study-reel` meet the same criteria.
