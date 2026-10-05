# WP-16: Export v2, destinations, web-embed bundle, and GIF

**Milestone:** M3 · **Depends on:** WP-03 (engine export), WP-08 (supersample, motion blur) · **Size:** M

## Goal

Make exporting effortless and correct for where the designer actually puts videos: their own website, Dribbble, social, and presentations. Output is verified after encoding.

## Context (read first)

- `contracts.md` §2 (`ExportSettings`, `DestinationId`), §9 (worker protocol)
- Existing code: `src/export/engine-export.ts`, `engine-worker.ts` (WP-03), `encode.ts`, and the legacy `probeExport` logic (now in `probe.ts`)
- `audit.md` §2 (MediaRecorder removal), `quality-bar.md` §5 (grain prevents banding)

## Scope

**In**

1. **Destinations (`src/export/destinations.ts`).** Each one presets aspect (a suggestion; ask before changing the project aspect), resolution, fps, quality, format, and supersample. Verify current platform specs at implementation time and record the source and date in a comment.

   | Destination | Defaults |
   |---|---|
   | Website embed | Project aspect · 1080 · 30 fps · `web` · bundle (MP4 H.264 + WebM AV1/VP9 + poster + snippet) |
   | Dribbble | 4:3 · 1200 tall (1600 × 1200) · 30 fps · `high` · MP4 |
   | Instagram feed | 4:5 · 1080 wide (1080 × 1350) · 30 fps · `high` · MP4 |
   | Instagram / TikTok story | 9:16 · 1080 × 1920 · 30 fps · `high` · MP4 |
   | LinkedIn / X | 16:9 · 1080 · 30 fps · `high` · MP4 |
   | Presentation 4K | 16:9 · 2160 · 30 fps · `master` · MP4 |
   | Custom | Everything editable |

   - `resolution` is the short side (`contracts.md` §2), so Dribbble is 4:3 at 1200 → 1600 × 1200. Implement `outputDimensions(aspect, resolution)` to match, rounding to even numbers.
2. **Probe (`src/export/probe.ts`):** Mediabunny `canEncodeVideo` for `avc`, `vp9`, and `av1` at the exact dimensions, fps, and bitrate. Gate 4K on the probe plus a memory estimate. Label any fallback clearly ("MP4 isn't available at 4K in this browser; exporting WebM").
3. **Bitrates (screen content, before supersample):** H.264 at 1080p30: `web` 6 Mbps, `high` 16 Mbps, `master` 28 Mbps. AV1/VP9 is 55% of those. Scale by pixel count and `(fps/30)^0.75`. Keyframe interval 2 s (`web`: 4 s). Use MP4 `fastStart: "in-memory"`.
4. **No MediaRecorder or legacy worker code remains.** WP-12 deletes the legacy export path with the old UI; remove anything left over. All exports go through the engine worker. Text and images are pre-rasterized and decoded on the main thread at export size.
5. **Export dialog** (WP-05 primitives)
   - Destination cards, then a settings row (resolution, fps, quality, format, supersample, motion blur).
   - A summary line ("1600 × 1200 · 30 fps · 8.0 s · MP4 · ≈ 14 MB").
   - Progress with a live thumbnail of the current frame, the stage name, and Cancel.
   - Result: a player, a "Download MP4" button (real filename), and for the bundle, "Download .zip" plus "Copy embed code".
6. **Web-embed bundle (`src/export/bundle.ts`, `fflate`):** `name.mp4`, `name.webm`, `name-poster.webp` (frame at 35% of total, or a user-chosen frame), and `embed.html` containing:
   ```html
   <video autoplay muted loop playsinline preload="metadata" poster="name-poster.webp" width="1920" height="1080">
     <source src="name.webm" type='video/webm; codecs="av01.0.08M.08"'>
     <source src="name.mp4" type="video/mp4">
   </video>
   ```
   Include a comment about `prefers-reduced-motion` (pause via a small script) and use the correct codec string for VP9 when AV1 is unavailable.
7. **GIF (`src/export/gif.ts`, `gifenc`):** max 960 px wide, 15 or 20 fps, global palette from sampled frames, Floyd-Steinberg dither, size estimate and warning above 15 MB.
8. **PNG:** the current frame at any export resolution.
9. **Verify (`src/export/verify.ts`):** read the result back with Mediabunny `Input` (`BlobSource`), check the dimensions, duration (±1 frame), and codec, and show a warning if they mismatch.

**Out:** audio muxing (WP-17), transparent video.

## Acceptance criteria

- [ ] An E2E per destination (Chromium: the WebM path where H.264 is unavailable) verifies dimensions and duration. The bundle zip contains 4 files and a valid snippet.
- [ ] Cancel at 10%, 50%, and 95% leaves no running worker and no leaked object URLs, and the editor stays responsive.
- [ ] 5 consecutive 1080p exports show stable memory (performance heap snapshots, reported).
- [ ] The actual file size is within ±35% of the estimate for the 12 templates at 1080p `high`.
- [ ] The GIF of a 6 s template is under 15 MB at 960 px / 15 fps with no visible banding on gradients (attach it).
- [ ] No MediaRecorder code remains.
