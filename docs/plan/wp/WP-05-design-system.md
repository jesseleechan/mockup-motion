# WP-05: Design system and UI primitives

**Milestone:** M2 (can start in wave 2) · **Depends on:** WP-00 · **Parallel with:** 01–04 · **Size:** M

## Goal

Build a quiet, professional component kit in the spirit of Jitter, Linear, and Figma, so the editor rebuild (WP-12) is assembly rather than invention. The UI is neutral and dark by default, so the canvas carries the color.

## Context (read first)

- `audit.md` §3 (what is wrong with the current look), README §6 decision D1
- Current UI: `src/index.css`, `src/editor/Controls.tsx` (to be replaced in WP-12; do not edit)

## Scope

**In**

1. **Dependencies:** `@radix-ui/react-{slider,popover,select,tabs,dialog,tooltip,toggle-group,dropdown-menu,context-menu,switch,scroll-area}`, `react-colorful`, `clsx`.
2. **Tokens (`src/ui/theme.css`, Tailwind v4 `@theme`).** Dark is the default; light via `[data-theme="light"]`.

   | Token | Dark | Light |
   |---|---|---|
   | `--color-bg` (app) | `#0B0B0D` | `#F5F5F7` |
   | `--color-panel` | `#121215` | `#FFFFFF` |
   | `--color-raised` (controls) | `#1A1A1F` | `#F0F0F3` |
   | `--color-hover` | `#222228` | `#E9E9ED` |
   | `--color-line` | `#26262C` | `#E4E4E9` |
   | `--color-line-strong` | `#34343C` | `#D3D3DA` |
   | `--color-text` | `#EDEDF0` | `#111114` |
   | `--color-text-2` | `#A1A1AB` | `#5C5C66` |
   | `--color-text-3` | `#6B6B75` | `#8E8E98` |
   | `--color-accent` (selection, focus) | `#7C93FF` | `#3D5AF1` |
   | `--color-accent-soft` | `rgb(124 147 255 / 0.16)` | `rgb(61 90 241 / 0.10)` |
   | `--color-danger` | `#FF6B6B` | `#D93636` |
   | `--color-stage` (behind canvas) | `#08080A` | `#E9E9EC` |

   - Primary button: `--color-text` background with `--color-bg` text (white on dark), not the accent.
   - Radii 6, 8, and 12. Spacing on a 4 px grid. UI type: Inter Variable at 13 px (body), 12 px (labels), 11 px (meta), with `font-variant-numeric: tabular-nums` for values and letter-spacing −0.005em.
   - UI motion: 120, 180, and 240 ms with `cubic-bezier(0.2, 0.8, 0.2, 1)`. Respect `prefers-reduced-motion`.
3. **Components (`src/ui/`)**, each a typed wrapper with variants, states, and focus rings (2 px accent, 2 px offset):
   - `Button` (primary, secondary, ghost, danger; sm/md), `IconButton`, `Tooltip` (with shortcut `Kbd`)
   - `Slider` + **`ScrubLabel`**: drag the label horizontally to change the value, Shift for 10× steps, Alt for 0.1×. Double-click resets to the default. Clicking the value opens inline numeric entry.
   - `NumberField`, `SegmentedControl`, `Select`, `Switch`, `Tabs`
   - `Popover`, `DropdownMenu`, `ContextMenu`, `Dialog`, `Toast` (bottom-center, auto-dismiss 4 s, action slot)
   - **`ColorField`**: swatch + hex input. The popover has `react-colorful`, the project's palette swatches, the brand kit swatches, and an `EyeDropper` button when the API exists.
   - `Section` (collapsible inspector group with an optional reset action), `Field` (label + control row, 96 px label column), `ThumbnailCard` (image or video thumb, title, selected and hover states, optional badge), `EmptyState`, `Spinner`, `ProgressBar`, `Divider`, `Kbd`
4. **Icons:** keep `lucide-react` at 16 px with 1.5 stroke, and wrap it in an `Icon` component that sets defaults.
5. **Gallery:** `/lab/ui` (dev only) shows every component in every state, in dark and light.

**Out:** the editor layout and any feature wiring (WP-12).

## Acceptance criteria

- [ ] `/lab/ui` shows every component and state in both themes. Attach screenshots.
- [ ] Every interactive component works with the keyboard alone (Tab, arrows, Enter, Esc). Verified with a Playwright spec per component group.
- [ ] `ScrubLabel` has tests for drag delta, modifiers, reset, and clamping.
- [ ] Contrast: `--color-text-2` on `--color-panel` is at least 4.5:1, and `--color-text-3` is used only for non-essential meta text.
- [ ] Bundle: the UI kit adds 45 KB gzip or less (report it).
