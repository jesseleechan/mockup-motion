# Polish plan: the Export dialog

**Status: in progress.** Written 19 October 2026 from the editor audit the owner approved that day. On 19 October 2026 the owner approved every recommendation, including the six destination cards in §3, and added §4. The coordinating session reviews these PRs and gives each a turn in the merge queue. Items build on the cuts that edit the same files: #63 (music), #65 (GIF export and motion blur) and #67 (MP4 default).

Each item is its own PR, with before and after screenshots of the dialog at 1440 × 900 and 1280 × 800 and a check that nothing in it overflows.

| Item                         | PR      | Status      |
| ---------------------------- | ------- | ----------- |
| 1. Advanced section          | #80     | Merged      |
| 2. Remember the last choice  | pending | In review   |
| 3. Destinations              |         | Not started |
| 4. Export every size at once |         | Not started |

## 1. An Advanced section

After #65, Encoding holds Format, Resolution, Quality, Frame rate and Anti-aliasing in a two-column grid (`EncodingSettings.tsx`).

- Encoding keeps **Format, Resolution and Quality**. Quality stays visible because it is the main size trade-off and the summary's file size follows it.
- **Frame rate and Anti-aliasing** move under an "Advanced" disclosure below Encoding, collapsed by default. Its closed row shows the current values ("30 fps · Crisp 1.5×") so a non-default setting is never hidden.
- The disclosure is a native `<details>` or the existing UI primitive, keyboard-operable, styled with the tokens in `src/ui/theme.css`.
- Tests: none new. The export dialog layout guard opens Advanced first, so it still checks all five fields.

## 2. Remember the last choice

Today `doc.export` is sanitised on load (`validate.ts`) but the dialog never reads or writes it (follow-up from F09), and it starts from a preset every time.

- **Open on `doc.export`.** The dialog's state is initialised from `doc.export` each time it opens.
- **Save on export.** Starting an export writes the settings to `doc.export` without an undo step (it is not an edit of the video), and to `localStorage` (`mockupmotion.lastExport`) as this browser's last choice. Changing a setting without exporting does not save it.
- **New projects** take the browser's last choice if there is one, else the MP4 default from #67. This lives in the store's new-project path, so `src/doc/defaults.ts` stays pure. Storage reads and writes are wrapped so a blocked `localStorage` falls back to the default; they do not swallow other errors.
- **Old documents keep loading.** `sanitizeDoc` already fills missing fields. It also maps values that no longer exist: `gif` (#65) to `mp4`, `motionBlur` dropped (#65), an unknown destination to `custom`, and any destination §3 removes to its replacement.
- **Built:** `sanitizeExport` in `validate.ts` now keeps every value the dialog offers (web bundle, PNG, 15 fps were dropped before) and validates the destination. `defaultExport()` matches the Custom preset (supersample 1, was 1.5). Undo and redo keep the remembered settings.
- Tests: `tests/export-memory.test.ts` (sanitising, the browser store, the store's new-project path and `rememberExport`). The dialog's side, which needs a browser, is three assertions added to the existing cancel test in `export-dialog.spec.ts`, not a new test.

## 3. Destinations

**Decided (owner, 19 October 2026): the recommendation below, six cards.**

Seven cards today, in a 4 + 3 grid: Website, Dribbble, Instagram, Story, LinkedIn & X, 4K presentation, Custom. After #67 the dialog opens on **Custom** (MP4, 16:9, 1080p), and any setting change also switches to Custom.

What the presets actually are:

| Card            | Aspect | Size        | Format     | Notes                                                 |
| --------------- | ------ | ----------- | ---------- | ----------------------------------------------------- |
| Website         | 16:9   | 1920 × 1080 | Web bundle | MP4 + WebM + poster + embed code, web quality         |
| Dribbble        | 4:3    | 1600 × 1200 | MP4        |                                                       |
| Instagram       | 4:5    | 1080 × 1350 | MP4        |                                                       |
| Story           | 9:16   | 1080 × 1920 | MP4        |                                                       |
| LinkedIn & X    | 16:9   | 1920 × 1080 | MP4        | **Identical to Custom's defaults**                    |
| 4K presentation | 16:9   | 3840 × 2160 | MP4        | Master quality                                        |
| Custom          | 16:9   | 1920 × 1080 | MP4        | The default after #67; also what any edit switches to |

**Recommendation: six cards, video first, the web bundle last.**

1. **Video** (16:9 · 1080p MP4). LinkedIn & X and the default become one card. It is the default, so a new user's first export is a plain landscape MP4 under a name that says so, not "Custom".
2. **Dribbble** (4:3)
3. **Instagram** (4:5)
4. **Story** (9:16)
5. **4K presentation**
6. **Web bundle** (renamed from "Website", which reads like a video size): last, with "MP4, WebM, poster and embed code" under its name so it reads as a different kind of output.

- **LinkedIn & X merges into Video.** Same settings; the card's description keeps "for LinkedIn, X and presentations" so the use is still findable.
- **Custom stops being a card.** It is a state, not a destination: when a setting differs from the selected preset, no card is selected and the Encoding heading shows "Custom". Picking a card resets to its preset, as today.
- Six cards fit a 3 × 2 grid, so there is no lone row of three at 1280 × 800.
- **Kept:** the "Switch to 4:3" (or any aspect) offer under the cards when the project's aspect differs from the preset's.
- **Saved projects:** `linkedin`, `x` and `custom` load as Video when the settings match it, otherwise as Custom. The `DestinationId` values stay readable on load.

## 4. Export every size at once

Added by the owner on 19 October 2026, from the audit's "Add" list.

- Pick any of 16:9, 4:3, 4:5 and 9:16 and get one file per aspect in one export: a site, Dribbble, an Instagram post and a Story.
- The presets already re-fit to each aspect, so this is an export queue: each aspect renders in turn from a copy of the document at that aspect (`changeAspect`), and the project's own aspect never changes.
- Progress shows per file, cancel stops the whole queue, and each file is offered as it finishes, the way a single export is today.
- Tests: unit tests for the queue (order, cancel, the document is not changed); at most one e2e test, for a two-aspect export.

## Follow-ups

None yet.
