import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  AUDIO_SAMPLE_RATE,
  DEFAULT_FADE_OUT_SEC,
  clampAudioTrack,
  computePeaks,
  defaultAudioTrack,
  gainAt,
  mixTrack,
  previewStart,
  rms,
} from "../src/audio/mix";
import { isSupportedAudioFile } from "../src/audio/decode";
import { prepareExportAudio, withoutAudio, audioCodecFor } from "../src/export/audio-mux";
import { createDoc } from "../src/doc/defaults";
import { sanitizeDoc } from "../src/doc/validate";
import { createEditorStore } from "../src/state/store";
import type { AssetRef, ProjectDoc } from "../src/doc/types";
import { schedule } from "../src/motion";

const SR = AUDIO_SAMPLE_RATE;

/** 1 kHz-ish constant-amplitude tone, `seconds` long. */
function tone(seconds: number, amp = 0.8): Float32Array {
  const out = new Float32Array(Math.round(seconds * SR));
  for (let i = 0; i < out.length; i++) out[i] = amp * Math.sin((2 * Math.PI * 440 * i) / SR);
  return out;
}

const audioRef = (id = "song"): AssetRef => ({
  id,
  kind: "audio",
  name: "song.mp3",
  mime: "audio/mpeg",
  bytes: 1000,
  durationSec: 20,
  peaks: new Array(200).fill(0.5),
});

function docWithAudio(): ProjectDoc {
  const doc = createDoc();
  doc.assets.push(audioRef());
  doc.audio = defaultAudioTrack("song");
  return doc;
}

describe("audio envelope", () => {
  it("defaults to a 1.5 s fade-out so loops don't cut harshly", () => {
    expect(defaultAudioTrack("a").fadeOut).toBe(DEFAULT_FADE_OUT_SEC);
    expect(DEFAULT_FADE_OUT_SEC).toBe(1.5);
  });

  it("clamps volume to 0..1, fades to 0..3 s, and offset to >= 0", () => {
    const c = clampAudioTrack({ assetId: "a", volume: 4, fadeIn: 9, fadeOut: -1, offset: -2 });
    expect(c).toEqual({ assetId: "a", volume: 1, fadeIn: 3, fadeOut: 0, offset: 0 });
  });

  it("fades in from 0 and out to exactly 0 at total", () => {
    const track = { assetId: "a", volume: 1, fadeIn: 1, fadeOut: 2, offset: 0 };
    expect(gainAt(track, 0, 10)).toBe(0);
    expect(gainAt(track, 1, 10)).toBeCloseTo(1, 6);
    expect(gainAt(track, 5, 10)).toBe(1);
    expect(gainAt(track, 10, 10)).toBe(0);
    expect(gainAt(track, 9, 10)).toBeCloseTo(0.5, 6);
  });

  it("is silent before the offset and scales by volume", () => {
    const track = { assetId: "a", volume: 0.5, fadeIn: 0, fadeOut: 0, offset: 2 };
    expect(gainAt(track, 1.99, 10)).toBe(0);
    expect(gainAt(track, 2, 10)).toBe(0.5);
  });
});

describe("waveform peaks", () => {
  it("returns 200 buckets normalised to 0..1 that follow the signal", () => {
    const data = new Float32Array(SR * 2);
    data.fill(0.1);
    data.fill(0.9, SR * 1.5); // loud final quarter
    const peaks = computePeaks([data]);
    expect(peaks).toHaveLength(200);
    expect(Math.max(...peaks)).toBe(1);
    expect(peaks[10]).toBeCloseTo(0.1 / 0.9, 5);
    expect(peaks[190]).toBe(1);
  });

  it("handles empty audio", () => {
    expect(computePeaks([])).toEqual(new Array(200).fill(0));
  });
});

describe("export mix", () => {
  it("renders exactly `total` seconds, trimming long audio and padding short audio", () => {
    const track = { assetId: "a", volume: 1, fadeIn: 0, fadeOut: 0, offset: 0 };
    const long = mixTrack([tone(10)], track, 6);
    expect(long.channels).toHaveLength(2);
    expect(long.channels[0].length).toBe(6 * SR);
    const short = mixTrack([tone(2)], track, 6);
    expect(short.channels[0].length).toBe(6 * SR);
    expect(rms(short.channels[0], 4 * SR, 6 * SR)).toBe(0);
  });

  it("duplicates mono to both channels", () => {
    const track = { assetId: "a", volume: 1, fadeIn: 0, fadeOut: 0, offset: 0 };
    const m = mixTrack([tone(1)], track, 1);
    expect(m.channels[1]).toEqual(m.channels[0]);
  });

  it("starts the audio at the offset", () => {
    const track = { assetId: "a", volume: 1, fadeIn: 0, fadeOut: 0, offset: 1 };
    const m = mixTrack([tone(5)], track, 4);
    expect(rms(m.channels[0], 0, SR * 0.99)).toBe(0);
    expect(rms(m.channels[0], SR * 1.1, SR * 2)).toBeGreaterThan(0.4);
  });

  it("fades measurably: first and last 100 ms are under 10% of the middle RMS", () => {
    const track = { assetId: "a", volume: 0.9, fadeIn: 1, fadeOut: 1.5, offset: 0 };
    const total = 8;
    const m = mixTrack([tone(20)], track, total);
    const ch = m.channels[0];
    const hundredMs = SR * 0.1;
    const middle = rms(ch, (total / 2) * SR - hundredMs / 2, (total / 2) * SR + hundredMs / 2);
    const first = rms(ch, 0, hundredMs);
    const last = rms(ch, ch.length - hundredMs, ch.length);
    expect(middle).toBeGreaterThan(0.4);
    expect(first / middle).toBeLessThan(0.1);
    expect(last / middle).toBeLessThan(0.1);
  });
});

describe("preview sync", () => {
  const track = { assetId: "a", volume: 1, fadeIn: 0, fadeOut: 0, offset: 2 };

  it("starts mid-buffer at the playhead time after any number of seeks", () => {
    for (const t of [3, 7.25, 0.5, 11, 4.04]) {
      const plan = previewStart(track, 30, t, 12);
      expect(plan).not.toBeNull();
      // The audio position at the moment of start equals the timeline time exactly.
      const audioTimeline = track.offset + plan!.bufferOffset - plan!.delay;
      expect(audioTimeline).toBeCloseTo(t, 9);
    }
  });

  it("delays the start when seeking before the offset", () => {
    const plan = previewStart(track, 30, 0.5, 12)!;
    expect(plan.delay).toBeCloseTo(1.5, 9);
    expect(plan.bufferOffset).toBe(0);
  });

  it("returns null past the end of the video or the track", () => {
    expect(previewStart(track, 30, 12, 12)).toBeNull();
    expect(previewStart(track, 3, 6, 12)).toBeNull();
  });

  it("never plays past the end of the video", () => {
    const plan = previewStart(track, 30, 10, 12)!;
    expect(plan.duration).toBeCloseTo(2, 9);
  });
});

describe("audio asset rules", () => {
  it("accepts mp3, m4a, wav, and ogg by mime or extension", () => {
    expect(isSupportedAudioFile({ name: "a.mp3", type: "audio/mpeg" })).toBe(true);
    expect(isSupportedAudioFile({ name: "a.M4A", type: "" })).toBe(true);
    expect(isSupportedAudioFile({ name: "a.wav", type: "audio/x-wav" })).toBe(true);
    expect(isSupportedAudioFile({ name: "a.ogg", type: "" })).toBe(true);
    expect(isSupportedAudioFile({ name: "a.png", type: "image/png" })).toBe(false);
    expect(isSupportedAudioFile({ name: "a.flac", type: "audio/flac" })).toBe(false);
  });

  it("uses AAC for MP4 and Opus for WebM", () => {
    expect(audioCodecFor("mp4")).toBe("aac");
    expect(audioCodecFor("webm")).toBe("opus");
  });
});

describe("export without audio", () => {
  it("a project with no audio produces no audio track and no warnings", async () => {
    const prepared = await prepareExportAudio(createDoc(), undefined, 6, "mp4");
    expect(prepared.audio).toBeUndefined();
    expect(prepared.warnings).toEqual([]);
  });

  it("falls back to no audio with a warning when the music blob is missing", async () => {
    const prepared = await prepareExportAudio(docWithAudio(), async () => null, 6, "mp4");
    expect(prepared.audio).toBeUndefined();
    expect(prepared.warnings[0]).toMatch(/music file is missing/i);
  });

  it("falls back with a warning when the browser can't encode the codec", async () => {
    // Node has no WebCodecs AudioEncoder, so the probe reports unsupported.
    const prepared = await prepareExportAudio(
      docWithAudio(),
      async () => new Blob([new Uint8Array(4)]),
      6,
      "webm",
    );
    expect(prepared.audio).toBeUndefined();
    expect(prepared.warnings[0]).toMatch(/can't encode Opus/);
  });

  it("withoutAudio strips the track without mutating the original (web-embed bundles)", () => {
    const doc = docWithAudio();
    const stripped = withoutAudio(doc);
    expect(stripped.audio).toBeUndefined();
    expect(doc.audio).toBeDefined();
    expect(withoutAudio(createDoc())).toBeTruthy();
  });
});

describe("doc validation", () => {
  it("round-trips a valid audio track and the asset's peaks", () => {
    const { doc } = sanitizeDoc(JSON.parse(JSON.stringify(docWithAudio())));
    expect(doc.audio).toEqual(defaultAudioTrack("song"));
    expect(doc.assets.find((a) => a.id === "song")?.peaks).toHaveLength(200);
  });

  it("clamps out-of-range values and drops tracks whose asset is gone", () => {
    const raw = JSON.parse(JSON.stringify(docWithAudio()));
    raw.audio = { assetId: "song", volume: 5, fadeIn: 10, fadeOut: 10, offset: -3 };
    expect(sanitizeDoc(raw).doc.audio).toEqual({
      assetId: "song",
      volume: 1,
      fadeIn: 3,
      fadeOut: 3,
      offset: 0,
    });

    raw.assets = [];
    const res = sanitizeDoc(raw);
    expect(res.doc.audio).toBeUndefined();
    expect(res.warnings.some((w) => w.includes("Music asset"))).toBe(true);
  });

  it("does not let audio extend the schedule", () => {
    expect(schedule(docWithAudio()).total).toBe(schedule(createDoc()).total);
  });
});

describe("store music actions", () => {
  it("sets, edits (clamped), undoes, and removes the music track", async () => {
    const store = createEditorStore();
    await store.getState().setMusic(audioRef("one"), new Blob(["x"]));
    expect(store.getState().doc.audio?.assetId).toBe("one");
    expect(store.getState().doc.audio?.fadeOut).toBe(1.5);

    store.getState().updateMusic({ volume: 2, fadeIn: 1 });
    expect(store.getState().doc.audio?.volume).toBe(1);
    expect(store.getState().doc.audio?.fadeIn).toBe(1);

    store.getState().undo();
    expect(store.getState().doc.audio?.volume).toBe(0.8);

    // Replacing music keeps exactly one audio asset
    await store.getState().setMusic(audioRef("two"), new Blob(["y"]));
    expect(
      store
        .getState()
        .doc.assets.filter((a) => a.kind === "audio")
        .map((a) => a.id),
    ).toEqual(["two"]);

    store.getState().removeMusic();
    expect(store.getState().doc.audio).toBeUndefined();
    expect(store.getState().doc.assets.some((a) => a.kind === "audio")).toBe(false);
  });

  it("removing the audio asset directly also clears the track", async () => {
    const store = createEditorStore();
    await store.getState().setMusic(audioRef("one"), new Blob(["x"]));
    await store.getState().removeAsset("one");
    expect(store.getState().doc.audio).toBeUndefined();
  });
});
