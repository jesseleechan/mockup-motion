# WP-17: Music track (optional)

**Milestone:** M3 · **Depends on:** WP-14, WP-16 · **Size:** S · **Skippable** (README decision D7)

## Goal

Add an optional background music track with fades, previewed in sync and muxed into exports. Most website embeds are muted, so this is for social and presentation videos.

## Scope

**In**

1. Upload mp3, m4a, wav, or ogg as an `AssetRef` (kind `audio`). Decode with `AudioContext.decodeAudioData` to get the duration and a 200-bucket waveform peak array.
2. **Timeline audio lane:** waveform; drag to change `offset`; volume slider; fade-in and fade-out handles (0–3 s); remove.
3. **Preview:** play the track in sync with the playhead (`AudioBufferSourceNode` started at the right offset on play or seek, with `GainNode` envelopes for fades). Mute while scrubbing.
4. **Export:** render the mixed buffer with `OfflineAudioContext` for exactly `total` seconds (fade-out ends at total), then mux with Mediabunny (`AudioBufferSource`): AAC in MP4, Opus in WebM, with a `canEncodeAudio` probe. If the codec is unavailable, warn and export without audio. Web-embed bundles never include audio. GIF ignores it.
5. **Loop docs:** default fade-out of 1.5 s so the video loop does not cut the music harshly.

## Acceptance criteria

- [ ] An exported MP4 or WebM has an audio track of length `total` (±1 audio frame), checked by Mediabunny `Input`. Fades are audible and measurable (RMS of the first and last 100 ms is under 10% of the middle).
- [ ] Preview stays in sync within 40 ms after 5 seeks.
- [ ] A project with no audio produces no audio track.
