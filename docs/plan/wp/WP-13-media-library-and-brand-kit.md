# WP-13: Media library, roles, brand kit, and projects

**Milestone:** M2 · **Depends on:** WP-01, WP-05, WP-12 · **Parallel with:** 14 · **Size:** M

## Goal

Make managing screenshots effortless and studio-ready: smart roles, drag to assign, reordering, a reusable brand kit, and multiple projects.

## Context (read first)

- WP-01 storage and store asset actions, `src/assets/decode.ts`, and `roles.ts` (basic role)
- WP-12 Library and Inspector slot pickers; `contracts.md` §2 (`AssetRef`, `Style`)

## Scope

**In**

1. **Role detection (`src/assets/roles.ts`)**
   - Width 1,300 px or less with aspect < 0.75 → `mobile`. Aspect 0.65–0.85 with width ≥ 1,500 → `tablet`. A small image (≤ 1,024 px) with an alpha channel and ≤ 20% opaque pixels → `logo`. Otherwise `desktop`.
   - Flag `tall` when aspect < 0.5 (desktop) or < 0.4 (mobile).
   - **Status-bar detection:** a uniform top strip of 40–60 px at @3× with high-contrast small glyph clusters at the left and right. When detected, set `AssetRef.meta.hasStatusBar` and the phone skips its safe zone (WP-06 reads it). Also set `meta.tall` and `meta.bottomColor` (bottom-row average, used for the short-screenshot fill).
2. **Media tab:** a 2-column thumbnail grid with role badge, tall indicator, dimensions, and a "used in Shot 2" dot.
   - Drop files anywhere, paste, or browse.
   - `@dnd-kit/sortable` reorder (order is the default slot preference).
   - Context menu: Replace…, Set role ▸, Duplicate, Remove (warns when the asset is in use, then clears references through the store).
3. **Drag to assign:** drag a media card onto an inspector slot, or onto a device in the stage. The engine raycasts the drop point to a node id with `Engine.pick` (`contracts.md` §7; implement it here if WP-15 has not), then maps the node to its slot. Highlight the hovered device.
4. **Brand kit (`src/storage/brand-kits.ts` + Library tab "Brand")**
   - A kit holds name, logo assets (light/dark), up to 6 colors, display and body fonts (built-in or uploaded), and a default URL.
   - "Apply to project" sets `Style.fonts`, `textColor`, `accent`, `browserUrl`, and end-card logos in one undo step.
   - Mark one kit as default; new projects start with it.
5. **Projects dialog:** a grid of project thumbnails (generated with the engine at 35% of total duration, 480 px JPEG, refreshed at most once per 30 s while editing), with name, last edited time, Open, Duplicate, Rename, and Delete (confirm; garbage-collect blobs).
6. **My templates:** "Save as template" in the project menu stores `{ style, shots }` in `userTemplates`, with every asset id replaced by a slot key (role inferred from the asset), so it behaves like a built-in `Template` with `fillSlots`. These appear in the Templates tab under "My templates", with rename and delete. They have no preview video; use a poster rendered with demo assets.
7. **"Capture a website" help sheet**, explaining `npm run capture` and how to take a full-size screenshot in Chrome DevTools, with the recommended widths (1440 desktop, 390 mobile @2× or @3×).

**Out:** timeline and audio (WP-14, WP-17).

## Acceptance criteria

- [ ] `roles.ts` unit tests on 12 fixtures (the demo assets plus synthetic logo, tablet, and status-bar images), with 100% correct classification for the fixtures.
- [ ] **E2E:** upload 4 files → reorder → replace one → assign by dragging onto a stage device → remove an in-use asset (references cleared, undo restores them).
- [ ] The brand kit persists across reloads, applies in one undo step, and the default kit applies to new projects.
- [ ] Deleting a project removes only its unshared blobs (storage test).
- [ ] A saved user template re-applies to a different project with different assets (slots fill correctly) and survives a reload.
- [ ] Attach screenshots of the Media tab, Brand tab, and Projects dialog.
