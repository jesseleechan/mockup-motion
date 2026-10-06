# F09 evidence

Captured at 1600×1000, device scale 1, Chrome with SwiftShader, from a cleared project with demo content.

- `before-settings.png`: the dialog on main (b86747f). Website is selected but Format says MP4; the summary prints "MP4", a 3-column grid, an empty header gap, and the Start export icon sits above its label.
- `after-settings.png`: the 600 px dialog. Two columns of stacked fields with every value on one line, and a summary of what will be written ("Web bundle · MP4 + WebM", 1920 × 1080 · 30 fps · 6.0 s, ≈ 7.0 MB).
- `after-progress.png`: a 720p WebM export rendering frame 13 of 60, with the real container ("WebM · VP9") and Cancel export.
- `after-result.png`: Export complete, with the decoded preview right side up, "Verified WebM · 1280 × 720 · 2.00 s · vp9", and a `.webm` download.
- `verify-webm.json`: `verifyExportBlob` output for the downloaded 2 s 720p WebM: valid, no warnings.
- `verify-mp4.json`: the same for a 2 s 720p MP4 (this Chrome encodes H.264): valid, codec avc, no warnings.
