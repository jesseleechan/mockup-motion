# F04: `/lab` and template previews use real demo assets

**Size:** S · **Depends on:** F03

## Bug

`src/lab/asset-provider.ts:13` loads `/demo/aurelia.png` for **every** asset id that is not a URL. As a result, every template preview, contact sheet and visual test shows the same single image, at dimensions that don't match the asset metadata. The lab fixtures also declare false sizes: `aurelia.png` is declared as 1440×3600 but is actually 1586×992. Layout and screen-aspect decisions are therefore made on wrong numbers, and the five demo sites in `public/demo/*` are never shown.

## Required changes

1. **`src/lab/demo-assets.ts`:** build the id → `{ url, width, height, role }` map from `public/demo/manifest.json`. That file is the single source of truth, so import the JSON; do not duplicate it.
   - Ids follow `demo-<site>-<desktop|mobile>-<hero|full>`, for example `demo-northwind-desktop-full`.
   - Export `demoAssetRef(id): AssetRef` so fixtures and templates build `AssetRef`s with the true dimensions.
2. **`src/lab/asset-provider.ts`**
   - Resolve ids through the map.
   - Ids that are http, absolute or `blob:` URLs still load directly.
   - An unknown id **throws** `Error("Unknown demo asset: <id>")`. Remove the Aurelia fallback and the "Asset: <id>" placeholder canvas.
3. **`src/templates/demo-preview.ts`:** rewrite the preview asset list using `demoAssetRef`. Use varied sites:
   - rows, wall and stack: 4–6 different desktop captures (Aurelia, Northwind, Maison Oak, Field Notes, Studio Kova)
   - phone parade: 4–5 different mobile captures
   - pair and trio: desktop and mobile from the **same** site
   - scroll story: a `desktop-full` capture
4. **Fixtures** (`src/lab/fixtures/*.json`): switch them to the new demo ids with correct dimensions, or fix the declared `width`/`height` to the real file sizes.
5. **Editor "Try with demo content"** (`src/editor/stage/Stage.tsx`): load from the same map, choosing assets that fill the current template's slots.

## Tests

- **Unit** (`tests/demo-assets.test.ts`, Node). For every `BUILTIN_TEMPLATES` `previewDoc()` and every lab fixture: every asset id resolves through the map, the file exists under `public/`, and the declared width and height equal the real image size (read with `sharp`).
- **E2E:** `/lab?fixture=portfolio-rows` at 50% renders at least 3 visually different screens. Compare the mean colour of 3 screen centres; they must not all be within ±6 of each other.

## Acceptance criteria

- [ ] The tests pass. Changing one declared width in `demo-preview.ts` makes the unit test fail (paste the output).
- [ ] Commit stills under `docs/fix-plan/evidence/F04/`: `portfolio-rows` and `isometric-wall`, showing different sites.
