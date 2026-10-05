# F01: Image orientation (screenshots, text, cursor, backgrounds, status bar)

**Size:** M · **Depends on:** F00

## Bug

Every screenshot and every title renders **upside down**: in the editor preview, in `/lab`, and in exported MP4/WebM files. This is the "mirrored" look the user reported.

Evidence:
- `../evidence/01-quiet-hero-upside-down.webp`
- `../evidence/02-exported-video-frame-upside-down.webp` (a frame decoded from an exported WebM)
- `../evidence/03-text-upside-down.webp`

## Root cause

WebGL **ignores** `UNPACK_FLIP_Y_WEBGL` (three.js `texture.flipY`) when the source is an `ImageBitmap`. The bitmap is uploaded as stored, so texel row 0 is the **top** of the image (v = 0). The code assumes the opposite:

| Where | What it does | Result |
|---|---|---|
| `src/engine/textures/TextureManager.ts:117-126` | `new THREE.Texture(bitmap)` with the default `flipY = true` (silently ignored) | v = 0 is the image top |
| `src/engine/materials/screen.ts:243-253` | Strip quads from `PlaneGeometry` (v = 1 at the quad top) in a y-up orthographic camera | The image top is drawn at the quad bottom → **upside down** |
| `src/engine/text/TextPass.ts:87-99, 265-275` | UVs written as `v = 1 - y/H`, assuming a flipped upload | **Upside-down glyphs**. Block positions are correct. |
| `src/engine/materials/screen.ts:280-298` | The status-bar pin maps the **whole** first strip into a 5.5% band | The whole page is squashed into the status bar |
| `src/engine/background/BackgroundRenderer.ts` (ambient/image) | Samples `texture2D(map, vUv)` on a full-screen quad | Upside-down background image |
| `src/engine/cursor/CursorSprites.ts` | `CanvasTexture` from `OffscreenCanvas`. Flip behaviour differs between browsers, so don't rely on it. | Risky |

## Required changes

1. **One convention, written down.** Add this to `contracts.md` §7 and as a comment at the top of `TextureManager.ts`:
   > All image textures are created with `flipY = false`. Texel row 0 is the top of the image (v = 0). Every mesh that displays an image maps its top edge to v = 0. Never rely on `flipY` for `ImageBitmap`, `OffscreenCanvas` or `VideoFrame` sources.
2. **`src/engine/textures/TextureManager.ts`:** set `texture.flipY = false` in `createTexture`.
3. **Shared geometry** (`src/engine/geometry/quads.ts`): `createTopLeftQuad()` returns a `PlaneGeometry(1, 1)` translated to [0, 1]² whose UVs map the quad's **top** edge (y = 1 in a y-up orthographic camera) to v = 0. Use it wherever an image is drawn into an orthographic pass. Create it once and share it; do not allocate per frame.
4. **`src/engine/materials/screen.ts`**
   - Strip meshes use the shared top-left quad. Pool one mesh per strip; update position and visibility in `compose()` instead of creating geometry and materials on every scroll change. The current code allocates every frame while scrolling.
   - Status-bar pin: show only the top `sbSourcePx = sbHeight / scaleFactor` source pixels of strip 0. Give it its own geometry whose UVs span v ∈ [0, sbSourcePx / strip.height].
5. **`src/engine/text/TextPass.ts`**
   - Set `flipY = false` on the raster texture.
   - Set `v0 = wordBox.y / raster.height` and `v1 = (wordBox.y + wordBox.h) / raster.height`.
   - Check that `maskReveal` still reveals line by line from below (quality-bar §2.2) and that the clip direction in the fragment shader matches. Fix it if not.
6. **`src/engine/cursor/CursorSprites.ts`:** set `flipY = false` and use the top-left quad convention in `screen.ts` (cursor and ripple meshes). The arrow tip must point up and left at the hotspot.
7. **`src/engine/background/BackgroundRenderer.ts`:** the ambient and image backgrounds sample with `vec2(vUv.x, 1.0 - vUv.y)` (or an equivalent convention-correct mapping). F11 adds cover-fit and blur; this task only fixes orientation.
8. **Find any other cases:** run `grep -rn "new THREE.Texture(\|CanvasTexture(\|DataTexture(\|ImageBitmap" src/engine src/export src/text`. Fix every texture you find, or explain in the PR why it is already correct.

## Tests (start them in F00 as `test.fail`; remove the annotation here)

Create `tests/e2e/orientation.spec.ts`:

1. **Screens, every device:** for `card`, `browser`, `phone`, `tablet` and `laptop`, build a one-shot doc with:
   - camera `static` (intensity 0, float 0)
   - grain 0 and vignette 0
   - asset `quadrants(1600, 1000)` (`quadrants(780, 1688)` for phone and tablet).

   Render at t = 0, 1280×720. Find the screen rectangle (inkBounds against a solid `#808080` background). Sample the centre of each quadrant (inset 20%), and assert top-left ≈ red, top-right ≈ green, bottom-left ≈ blue, bottom-right ≈ yellow (tolerance 40 per channel; the colours only need to be unambiguous).
2. **Scrolled tall image:** `bands(1440, 6000, [red, green, blue, yellow, magenta, cyan])` in a browser with `scroll.enabled`, rendered at a time where the scroll is 0. The top of the screen must be red. Then render where the scroll is 1. The bottom of the screen must be cyan.
3. **Text:** a title layer containing a single `"T"` at `size: 20` (% of frame height), anchor centre, on a `#808080` solid background. Find the ink bounds. The ink count in the top 25% of rows must be greater than 3× the ink count in the bottom 25% (the crossbar is at the top).
4. **Exported video:** export the `card` quadrants doc for 1 s at 640×360 WebM through `window.__exportWithEngine`. Decode t = 0.5 s with Mediabunny (`Input` + `BlobSource` + `CanvasSink` on the primary video track). Run the same quadrant assertions.
5. **Unit:** `TextureManager.createTexture(...)` returns `flipY === false` (`tests/engine.test.ts`).

## Acceptance criteria

- [x] All orientation tests pass. With the fix reverted (`flipY` back to default and the old UVs), the screen, text, and exported-video tests fail at their pixel assertions. See the mutation logs under `docs/fix-plan/evidence/F01/`.
- [x] Commit these stills, rendered at 1200 px wide, under `docs/fix-plan/evidence/F01/`: `quiet-hero`, `phone-spotlight`, `scroll-story` at the end of its scroll, `launch-reel` at its title, and the decoded export frame. Each was inspected; text reads normally.
- [x] The cursor arrow points up-left with the tip at the click point (cursor still under `docs/fix-plan/evidence/F01/`).
- [x] Scrolling a tall screenshot allocates no new geometries per frame (geometry count stays constant over 60 scrolled frames).
