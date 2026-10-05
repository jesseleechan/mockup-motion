# WP-01: Document model v2, store, storage, and migration

**Milestone:** M1 · **Depends on:** WP-00 · **Parallel with:** 02, 03, 04, 05 · **Size:** M

## Goal

Provide the data backbone for the new editor: defaults and validation for `ProjectDoc` v2, a zustand store with undo/redo, IndexedDB storage that writes each image blob once, support for multiple projects, an automatic migration from v1, and a blob-backed `AssetProvider` the engine can use.

## Context (read first)

- `contracts.md` §2 (types, already in `src/doc/types.ts`), §7 (`AssetProvider`), §8 (templates, for `applyTemplate`)
- Legacy code to port or replace: `src/editor/useEditor.ts`, `src/editor/history.ts` (keep the semantics and tests), `src/storage/projects.ts`, `src/assets/images.ts`, `src/types.ts` (the v1 shapes)
- `audit.md` §2 (blob rewrite on every save, per-keystroke undo)

## Scope

**In**

1. **`src/doc/defaults.ts`:** `createDoc(partial?)`, `defaultStyle()`, `defaultShot(layout)`, `defaultExport()`. Defaults follow `quality-bar.md`: Bone background, `shadow: "soft"`, `grain: 0.25`, `vignette: 0.06`, Inter Display / Inter fonts, 1080p30 `high` MP4, `supersample: 1.5`.
2. **`src/doc/validate.ts`:** `sanitizeDoc(unknown) → { doc, warnings }`. Clamp numbers to their documented ranges, replace unknown enums with defaults, drop shots with missing layouts, guarantee `shots.length ≥ 1`, and remove references to missing assets (replacing them with `""` so the engine shows an empty screen). Run it on every load and import.
3. **`src/doc/migrate.ts`:** migrate v1 `Project` to v2 `ProjectDoc`. Copy the v1 types into this file (the legacy `src/types.ts` will be deleted in WP-12).
   - Layout: `hero` → `single` (device: `browser`/`phone` by `frame.type`; `rounded`/`none` → `card`); `rows` → `rows`; `grid` → `wall`; `columns` → `columns`; `pair` → `pair`.
   - Motion: `zoom` → `pushIn`; `drift` → `riseUp`; `glide` → marquee speed 0.35 (or `dollyRight` for `single`); `still` → `static`. Intensity is the v1 `amount` divided by 40, clamped to 0..1.
   - Background: `solid` and `gradient` map directly; `spotlight` → `gradient` with the same colors; `image` → `image`. Brand title and subtitle become `TextLayer`s with `fadeUp`. `contentMotion` becomes `scroll` (keep `enabled`, map `start`/`end` to `stops`).
   - `presetId` → `templateId` using `LEGACY_PRESET_TO_TEMPLATE` (define the map here, matching WP-11): clean-hero→quiet-hero, soft-studio→quiet-hero, midnight-rows→portfolio-rows, gallery-wall→isometric-wall, angled-gallery→portfolio-rows, phone-columns→phone-parade, phone-spotlight→phone-spotlight, responsive-pair→responsive-pair.
4. **Storage (`src/storage/`, using `idb`)**
   - Use a **new database `mockupmotion-v2`**, so the legacy app (still running until WP-12) keeps working on `mockupmotion` v1. Stores: `projects` (key `id` → `ProjectDoc`), `blobs` (key `assetId` → `Blob`), `thumbs` (key `projectId` → small JPEG `Blob`), `meta` (`lastProjectId`, `migratedFromV1`), `brandKits`, `userTemplates`.
   - API: `listProjects()` returns `{ id, name, updatedAt }[]` sorted by recency. Also `loadProject(id)`, `saveProject(doc)` (doc only, never blobs), `putBlob(assetId, blob)` (called once on import), `getBlob`, `deleteProject(id)` (then garbage-collect blobs referenced by no project), `duplicateProject(id)`, `putThumb`, `getThumb`.
   - **One-time v1 import:** on first open, if `meta.migratedFromV1` is unset and the legacy DB has `projects/current`, read it, write its image blobs to `blobs`, migrate the doc, save it, and set the flag. Never modify the legacy DB.
5. **Store (`src/state/store.ts`, zustand + immer)**
   - State: `doc`, `past`, `future` (limit 100), `saveStatus: "idle" | "saving" | "saved" | "error"`, `saveError?`.
   - Actions: `apply(recipe, { label, coalesceKey? })`. Edits with the same `coalesceKey` within 800 ms merge into one undo step (text typing, project name). Also `begin()` and `end()` transactions (slider drags), `undo`, `redo`, `loadDoc(doc)` (clears history), `newDoc()`, `applyTemplateResult({ style, shots, loop }, templateId)` (one undo step, keeps assets), `addAssets(refs, blobs)`, `replaceAsset(id, ref, blob)`, `removeAsset(id)` (clears references through `sanitizeDoc`).
   - Port the `history.ts` behavior and tests (bounded history, redo invalidation, identical-reference no-op).
   - Autosave: subscribe to `doc`, debounce 600 ms, call `saveProject`. Flush on `visibilitychange: hidden` and `pagehide`. Surface errors such as a full quota.
6. **`src/state/ui-store.ts`** (non-undoable): `selection: { kind: "video" } | { kind: "shot"; id } | { kind: "text"; shotId; id }`, `playhead`, `playing`, `stageZoom`, `panels`, `theme`.
7. **Assets**
   - **`src/assets/decode.ts`:** port the validation (types PNG/JPEG/WebP/AVIF, 35 MB, 80 MP), produce `AssetRef` + `Blob`, and set a basic `role` (aspect < 0.75 → `mobile`, else `desktop`; refined in WP-13).
   - **`src/assets/provider.ts`:** `createAssetProvider(getBlob)` implementing `AssetProvider.getImage(id, maxWidth)` with `createImageBitmap(blob, { resizeWidth, resizeQuality: "high" })`. Fall back to step-down halving on an `OffscreenCanvas` when resize options are unsupported. Cache by `(id, bucketed width)`, with buckets at powers of √2 to limit re-decodes, and evict least-recently-used entries past 512 MB of estimated bitmap memory. `getText` delegates to `src/text/rasterize.ts` (stub that throws "WP-10" until WP-10 lands).

**Out:** any UI, and wiring the store into the legacy `App.tsx` (WP-12 does that).

## Acceptance criteria

- [ ] Unit tests: defaults validate cleanly; `sanitizeDoc` fixes a deliberately broken doc (10 cases); migration of 8 v1 fixtures (one per legacy preset, plus brand text, plus scrolling) produces valid docs with the expected layout, camera, and template ids.
- [ ] Store tests: coalescing (typing 10 chars produces 1 undo step), transactions (one drag produces 1 step), `applyTemplateResult` is 1 step and keeps assets, `removeAsset` clears all references.
- [ ] Storage tests (use `fake-indexeddb` in Vitest): saving a doc 20 times writes each blob exactly once; delete plus garbage collection removes orphaned blobs only; the v1 import runs once and leaves the legacy DB untouched.
- [ ] `AssetProvider` test in a browser context (Playwright component test or `/lab` smoke test): returns a bitmap with `width ≤ maxWidth`, served from cache on a second call.
- [ ] The legacy app still works unchanged.
