# Browser matrix

Checked 5 Oct 2026 from this Windows 11 machine. Safari and Firefox are not installed here, so those rows are code review only. No blocking issue was found in the code paths below.

| Check                              | Chrome (Windows)                                                                                                       | Edge (Windows)                       | Firefox                    | Safari 17+                                            |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------- | ----------------------------------------------------- |
| H.264 / VP9 / AV1 encode           | Probe via `canEncodeVideo`; MP4 uses AVC, WebM uses VP9, with a warning and a silent export if audio encode is missing | Same probe. Not re-run in this wave. | Same probe. Not installed. | Same probe. Not available on this host.               |
| `OffscreenCanvas` + WebGL2 worker  | Export tries the worker, then falls back to the main thread                                                            | Same code path                       | Same code path             | Safari 17+ supports the worker path; fallback remains |
| `createImageBitmap` resize options | Used, with a full-size decode if resize options throw                                                                  | Same                                 | Same                       | Same fallback                                         |
| `EyeDropper`                       | Button hidden when the API is missing (`ColorField`)                                                                   | Same                                 | Hidden (no API)            | Hidden (no API)                                       |
| Font loading                       | Self-hosted via `@fontsource`. Lab waits for `document.fonts.ready`                                                    | Same                                 | Same                       | Same                                                  |
| Clipboard paste                    | Embed snippet uses the clipboard API and falls back to a selectable field                                              | Same                                 | Same                       | Same                                                  |
| Drag and drop                      | Stage and media library accept dropped screenshots                                                                     | Same                                 | Same                       | Same                                                  |
| IndexedDB quota                    | `QuotaExceededError` sets the save indicator to “Storage is full” and leaves the editor usable                         | Same                                 | Same                       | Same                                                  |

Audio encode is probed separately (`canEncodeAudio`). If AAC or Opus is unavailable, the video exports without music and the dialog says why. GIF and web-embed bundles never include audio.

**Follow-up:** run this table in Firefox current and Safari 17/18 on macOS before calling the matrix closed. Edge on this PC was not launched in this wave.
