# F03: Load assets for every layout, engine diffing, and texture cache

**Size:** M · **Depends on:** F01

## Bug

Every layout except `single` shows **black screens**: pair, trio, rows, columns, wall and stack. This affects 7 of the 12 templates, in the preview and in exports. See `../evidence/04-pair-black-screens.webp` and `../evidence/10-wall-black-screens.webp`.

## Root cause and related defects

1. `src/engine/Engine.ts:251-258`: `setDocument` preloads textures only when `shot.layout.kind === "single"`. Other layouts call `getLoadedTexture(...)`, get `null`, and draw the empty fill (`#18181B`). The export worker uses the same `Engine`, so exported videos are black too.
2. `Engine.ts:238-243`: every call to `setDocument` destroys **all** device instances and rebuilds them. The contract says "diff and rebuild only what changed".
3. `TextureManager.getLoadedTexture` (`TextureManager.ts:36-41`) returns the first cache entry for an asset whatever its resolution, and the cache never evicts. Memory grows with every asset you ever loaded.
4. `setDocument` has no protection against overlapping calls. A slow earlier call can overwrite a newer document's state.
5. `textRasters` and `TextPass` textures are never pruned when text layers are removed.
6. Ambient and image background assets and `TextLayer.logoAssetId` are never preloaded.
7. `src/export/engine-export.ts:47-80` (`collectNeededAssetIds`) duplicates the asset-walk logic, and decodes every image at `width × supersample` regardless of how large it appears on screen.

## Required changes

1. **One pure asset walker** in `src/doc/assets.ts`:
   - `collectAssetIds(doc): Set<string>` covers:
     - `single.assetId`, `pair.desktopId` and `mobileId`, `trio.desktopId`, `tabletId` and `mobileId`
     - `rows`, `columns`, `wall` and `stack` `assetIds`
     - an `ambient` or `image` background `assetId` (in the doc style and in every `shot.styleOverrides`)
     - every `TextLayer.logoAssetId`
     - `audio.assetId` is excluded (images only).
   - Use it in the engine and in export. Delete `collectNeededAssetIds`.
2. **Texture size per asset** in `src/engine/textures/sizing.ts`. For each shot, call `resolveLayout` at the shot's start. For each node, compute its on-screen width in px: `node.width / stageWidthUnits × outputWidthPx × supersample`, divided by the shot's smallest camera distance over the shot (sample 5 times). Multiply by 1.5 (`master` quality: 2.0). Take the maximum per asset, clamp to the asset's real width, round up to a multiple of 256, with a minimum of 256. Use the same function to decide the export decode widths.
3. **`TextureManager`**
   - `getLoadedTexture(assetId)` returns the largest loaded entry.
   - Add `retainOnly(assetIds)`, which disposes textures for assets the current document no longer uses. Close only the strip bitmaps that `TextureManager` created itself; bitmaps owned by the provider stay open.
4. **Device diffing** in `Engine.setDocument`. Key each device instance by `${node.id}|${node.device}|${styleKey}`, where `styleKey` covers `frameAppearance`, `deviceFinish`, `browserChrome`, `browserUrl` and `shadow`. Keep instances whose key still exists and dispose the rest. Node size changes go through `dev.update()` and `compositor.resize()`.
5. **Generation guard.** Increment `this.generation` at the start of `setDocument`. After every `await`, return early if the generation has changed.
6. **Text:** rebuild `textRasters` per document and add `TextPass.retainOnly(layerIds)`.
7. **Debug API** (cheap, always on). `engine.debugInfo()` returns `{ nodes: { id, device, assetId, textureLoaded }[], textures, geometries, setDocumentCalls, renderCalls }`. F05 uses the counters.

## Tests (start them in F00 as `test.fail`; remove the annotation here)

1. **Unit** (`tests/doc-assets.test.ts`): `collectAssetIds` for every layout kind, both background kinds, overrides and logos.
2. **E2E** (`tests/e2e/assets.spec.ts`): for every template in `BUILTIN_TEMPLATES` with its `previewDoc()` (F04 makes these use real files), render at 50% of the total duration and assert that `debugInfo().nodes.every(n => !n.assetId || n.textureLoaded)`. For `responsive-pair`, also sample the centre of the browser screen and the phone screen: neither may be the empty fill colour.
3. **E2E memory:** alternate `setDocument` between `quiet-hero` and `isometric-wall` 20 times. Texture and geometry counts after the 20th cycle equal those after the 2nd.
4. **E2E race:** call `setDocument(A)` and then immediately `setDocument(B)` without awaiting the first. The final render shows B's nodes only.
5. **Export:** export `responsive-pair` for 1 s at 640×360 and decode t = 0.5. The phone screen centre is not the empty fill colour.

## Acceptance criteria

- [ ] All tests above pass. With the old `kind === "single"` guard restored, test 2 fails (paste the output).
- [ ] Commit stills (1200 px) under `docs/fix-plan/evidence/F03/`: `responsive-pair`, `responsive-trio`, `portfolio-rows`, `isometric-wall`, `cascade-stack` and `phone-parade` (9:16). Each must show real screenshots in every device.
