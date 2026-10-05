# WP-12: Editor shell and contextual inspector

**Milestone:** M2 · **Depends on:** WP-01, WP-03, WP-05 (uses WP-11's registry when available) · **Size:** L

## Goal

Replace the v0.1 editor with a calm, canvas-first pro tool: a dark shell, a template-first start, a large stage, a timeline area, and an inspector that only shows what applies to the current selection. Delete the legacy UI and renderer.

## Context (read first)

- `audit.md` §3, README §6 (D1, D5), `quality-bar.md` (the inspector exposes only quality-bar-safe ranges)
- WP-05 components (`/lab/ui`), WP-01 store and ui-store, WP-03 `EngineCanvas`, WP-11 registry and previews
- Legacy files to delete when done: `src/App.tsx`, `src/editor/*`, `src/rendering/*`, `src/presets/*`, `src/types.ts`, `src/index.css`, `src/storage/projects.ts`, `src/assets/images.ts`, `src/export/video.ts` + `video.worker.ts` (keep `encode.ts` helpers that `engine-export.ts` uses), `tests/core.test.ts` (keep the history tests WP-01 ported)

## Layout (desktop, 1280 px and wider)

```
┌ TopBar 52px ─ mark · Project name ▾ · saved ✓ ───── ⟲ ⟳ · [16:9 9:16 1:1 4:5 4:3] · [Export] ┐
├ Library 272px ┬──────────────── Stage ────────────────────┬ Inspector 304px ┤
│ Templates|Media│        (canvas fit, output boundary)       │ contextual panel │
│ cards / media  │                                            │                  │
│                ├─ transport: ▶ 00:02.4 / 00:08.0 · loop · zoom ─┤                  │
├────────────────┴── Timeline area (WP-14) 148px ─────────────┴──────────────────┤
```

- **Stage:** the canvas fits inside with 32 px padding on `--color-stage`, with a 1 px `--color-line` output boundary. Zoom: Fit, 50%, 100%. A safe-area overlay toggle shows the central 80% for vertical formats. A dropped file anywhere shows a full-window drop target.
- **Library** (collapsible with `[`): Templates tab (WP-11 cards with video previews, categories as chips, a "Needs N" disabled state, applying is one undo step); Media tab (basic list until WP-13).
- **Inspector** (collapsible with `]`), following ui-store selection:
  - **Video** (nothing selected): aspect, loop, total duration (read-only), **Style** (background picker: palettes grid + "From your screenshot" suggestions + custom; frame appearance; device finish; browser chrome + URL; shadow preset; grain; vignette), **Fonts** (display and body pickers with specimen previews).
  - **Shot**: layout kind (visual chips), slot pickers (thumbnail dropdowns per slot), device (when relevant), **Camera** (preset chips with tiny looping SVG previews of the move, intensity, easing, float), entrance, duration, transition in (WP-14 popover reuse), and section hooks for Scroll and Cursor (WP-15) and Text layers (list + add).
  - **Text**: content (textarea), role, font (display or body), size, anchor (3 × 3 grid), align, color (auto or custom), animation, delay.
  - Controls use quality-bar ranges (for example, intensity 0–1 as 0–100%, grain 0–100% mapped to the allowed amplitude).
- **Empty state (first run / new project):** a centered sheet with "Start with a template" (gallery), "Drop screenshots", and "Try with demo content". Copy is plain and short.

## Scope

**In**

1. Shell, TopBar (project name inline edit with coalesced undo, save status from the store, project menu with New, Duplicate, and Projects…, opening WP-13's dialog later), Stage, Library (Templates tab), Inspector (Video, Shot, Text panels), transport bar, and a timeline container with a simple scrubber (WP-14 replaces it).
2. **Keyboard:** Space play/pause; ← / → step 1 frame at 30 fps; Shift + ← / → 1 s; Home/End; ⌘Z / ⇧⌘Z; ⌘E export; ⌘D duplicate shot; Delete removes the selected shot or text (with undo); `[` and `]` toggle panels; `?` opens a shortcuts sheet. Ignore shortcuts while typing in inputs.
3. **Minimal export dialog** using `exportWithEngine` (1080p, MP4 or WebM, progress, cancel, download). WP-16 replaces it.
4. **Below 1024 px:** stage + template carousel + export only, with a "Best edited on a larger screen" note (D5).
5. **Theme toggle** (dark/light) in the project menu, persisted per device.
6. **Delete the legacy code** listed above once the new shell reaches parity. On boot, run WP-01's v1 migration.

**Out:** media library features (WP-13), the storyboard timeline (WP-14), scroll and cursor editing (WP-15), the full export dialog (WP-16).

## Acceptance criteria

- [ ] **E2E:** first run → template → demo content → change background palette → change camera preset → undo/redo → export 1080p → the file is verified (dimensions and duration).
- [ ] **E2E:** a v1 project in the legacy DB opens migrated, with assets intact.
- [ ] The inspector shows only relevant controls (snapshot tests per layout kind: no phone finish for a browser-only shot, and so on).
- [ ] Keyboard-only walkthrough of the whole flow is possible (Playwright spec). Axe reports 0 serious or critical issues.
- [ ] No legacy files remain, the bundle has no `src/rendering` code, and there are no console errors during the E2E run.
- [ ] Attach screenshots of the shell (empty, editing, export) in dark and light.
