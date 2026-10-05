# F02 colour pipeline evidence

Implementation checkpoint: explicit final sRGB transfer; linear gradient/mesh output; exact coverage-colour text and generic linear-premultiplied raster fallback; One/One half-float accumulation; bounded grain/dither; CSS angles with legacy-document and user-template compatibility. F01 UVs and pooled geometry are preserved. Full gates and the final prerequisite lifecycle commit are pending; this task is not marked Done.

## Pixel verification

- The inherited annotated negative suite reproduced four accepted expected failures (`before-tests.txt`). Its line reporter labels accepted expected failures as passes; the strict tests below remove those annotations.
- Expanded strict suite: 17/17 passed (`colour-glyph-tests.txt`), including three solids ±1, independent constant gradient/mesh ±1, ordered screenshot band centres ±2 at camera distance 0.7, both CSS directions, all RGB grain channels plus determinism, linear fade, 2/4/8-sample accumulation identity, synthetic white/coloured alpha plateaus, real glyph edges, partial opacity, blur, and 8-digit hex fill alpha. Restored focused suite: 28/28 passed (`restored-focused-tests.txt`): 18 F02 cases including short-phone bottom-fill, plus all 10 F01 regressions. After extracting the glyph oracle into a helper without changing assertions, all 4 glyph/fill cases passed again (`oracle-refactor-tests.txt`).
- Migration/storage suite: 31/31 passed (`migration-tests.txt`). Compatibility covers document style and shot overrides, one-time normalization/idempotency, historical v1 CSS angles, raw legacy user-template load/list/fill/save/rename, and durable markers.
- First F01 regression run: 9 passed, one 60-frame scroll test timed out at the inherited 45-second limit while sharing SwiftShader (`focused-tests.txt`). No pixel/geometry assertion failed. The restored run passed all 10 F01 cases using a run-level 120-second timeout and preserving every assertion.

## Fail-without-fix evidence

Each mutation was restored in `finally`; logs contain actual assertion failures, not browser launch or timeout failures.

| Mutation log | Guarded behavior |
|---|---|
| `mutation-transfer.txt` | Solids, screenshot band centres, linear fade fail without final transfer. |
| `mutation-background-transfer.txt` | Both constant gradient and constant mesh fail if their output is encoded twice. |
| `mutation-angles.txt` | 90° and 180° direction checks fail under old math directions. |
| `mutation-grain-mean.txt`, `mutation-grain-channels.txt` | Grain mean and monochrome RGB agreement reject biased/channel-specific noise. |
| `mutation-dither.txt` | Exact byte-centre pixels reject the old ±1-LSB dither. |
| `mutation-glyph-alpha.txt`, `mutation-generic-alpha.txt` | Independent coverage oracles reject double alpha and decoding encoded-premultiplied RGB. |
| `mutation-accumulation.txt` | Static accumulated colour rejects extra SrcAlpha weighting. |
| `mutation-canvas-colour.txt` | Alpha hex colour rejects unnormalized THREE.Color input. |
| `mutation-bottom-fill.txt` | Removing explicit SRGBColorSpace rejects `(124,170,231)` versus the required `(51,102,204)` ±2. |
| `mutation-angle-normalization.txt`, `mutation-v1-marker.txt` | Legacy direction/idempotency assertions fail without conversion or the v1 discriminator. |
| `mutation-template-load.txt`, `mutation-template-list.txt`, `mutation-template-fill.txt`, `mutation-template-save.txt`, `mutation-template-rename.txt` | Each user-template persistence boundary is independently disabled and rejected by its assertion. |

## Inspected stills

All full-frame PNGs are 1280×720, generated from `/lab?still=1&fixture=...&w=1280`. Evidence capture overrides use actual bitmaps and decoded dimensions; production lab assignment remains F04 scope. `source-dimensions.json` records actual files and the same crop coordinates.

- `tilted-showcase.png`: inspected upright screenshot content, visible Graphite separation and device edges, restrained grain/shadow, and preserved composition.
- `phone-spotlight.png`: inspected upright real 780×1688 mobile content, visible dark phone rim/background, and no newly introduced horizontal crop.
- `quiet-hero.png`: inspected upright desktop content and the template's retained warm `#F5F3EF` background.
- `quiet-hero-bone.png`: inspected the explicitly requested Bone `#F1EDE6` variant without changing the built-in template's art direction.
- `screenshot-crop-comparison.png` (1280×440): inspected the same real Aurelia crop side by side; wood, mountain and sky mid-tones visually match. The render is softer from existing texture/mipmap resampling; this is not a whole-image exactness claim. Strict synthetic band-centre tests supply numeric ±2 evidence.
- `transparent-glyph-edges.png`: inspected upright white text on Graphite with clean antialiased edges; independent edge/blur oracles supply quantitative alpha evidence.
- `before-tilted-showcase.png`: inspected the missing-transfer fault reenacted after initial reproduction, retaining F01 orientation and the same real asset; background and screenshot mid-tones darken markedly.

## Shader audit

Nine distinct custom programs across ten constructor sites; no RawShaderMaterial/onBeforeCompile shaders were found.

| Shader/site | Inputs, output and alpha result |
|---|---|
| Background solid | THREE.Color supplies linear RGB; opaque linear output. |
| Background gradient | OKLab converts to linear sRGB primaries; final pass performs the sole transfer. |
| Background mesh | Same linear conversion as gradient; constant-mesh numeric guard passes. |
| Background image/ambient | sRGB texture decoding supplies linear RGB; dim multiplies linear values; opaque output. F01 top-down sampling retained. |
| Screen rounded material | sRGB byte target samples linear; border endpoints are linear 0/1; straight-alpha coverage with normal blending. Bottom-row encoded RGB now enters THREE.Color with explicit SRGBColorSpace. |
| Text | Bitmap creation explicitly premultiplies. Production glyph RGB is canonical opaque sRGB metadata converted by THREE.Color; shader samples alpha coverage and outputs linear premultiplied RGB. Generic rasters convert each unpremultiplied Canvas texel to linear premultiplied half-float before filtering/blur. One/OneMinusSrcAlpha blending applies alpha exactly once. |
| Shadow contact and ambient (two sites) | Existing shadowTintFor background tint passes through THREE.Color; linear RGB with straight alpha/normal blending; retained. |
| Accumulation | Samples linear shot targets, multiplies by sample weight once; custom One/One additive blending into linear RGBA16F before final pass. Auto-clear and clear-colour state are restored. |
| Final | Linear transition/downsample and vignette; exact piecewise transfer; zero-mean monochrome grain; ±0.5-LSB triangular dither; clamp. No colorspace_fragment include. |
| Cursor and ripple (built-in materials) | CanvasTexture sRGB inputs and THREE.Color material tint; built-in renderer performs target colour handling and normal straight-alpha blending. F01 orientation/hotspot preserved; intentional cursor outline/shadow retained. |

## Scope and remaining verification

Byte sRGB targets are retained for dark-colour precision; shader writes, blending and sampled values are linear. Camera distance 0.7 is a development-only lab fixture override, never serialized. CSS angle migration preserves normalized-frame direction, not full aspect-dependent CSS gradient length. Accumulation still excludes incoming transition layers (F09). Screen material does not yet consume device material.opacity. Production lab ordinary asset IDs still map to Aurelia (F04), and existing crop resampling softness is retained. Required full gates will be recorded after rebasing onto the final F01 lifecycle checkpoint.
