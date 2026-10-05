import type { AudioTrack } from "../doc/types";

/** Sample rate every decoded buffer and every export mix uses. */
export const AUDIO_SAMPLE_RATE = 48000;
export const MAX_FADE_SEC = 3;
export const PEAK_BUCKETS = 200;
/** Default fade-out so a looping video does not cut the music harshly (WP-17 §5). */
export const DEFAULT_FADE_OUT_SEC = 1.5;
export const DEFAULT_FADE_IN_SEC = 0.5;

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

export function defaultAudioTrack(assetId: string): AudioTrack {
  return {
    assetId,
    volume: 0.8,
    fadeIn: DEFAULT_FADE_IN_SEC,
    fadeOut: DEFAULT_FADE_OUT_SEC,
    offset: 0,
  };
}

/** Clamp every field into its valid range (volume 0..1, fades 0..3 s, offset >= 0). */
export function clampAudioTrack(track: AudioTrack): AudioTrack {
  return {
    assetId: track.assetId,
    volume: clamp(track.volume, 0, 1),
    fadeIn: clamp(track.fadeIn, 0, MAX_FADE_SEC),
    fadeOut: clamp(track.fadeOut, 0, MAX_FADE_SEC),
    offset: Math.max(0, Number.isFinite(track.offset) ? track.offset : 0),
  };
}

function smoothstep(x: number): number {
  const c = clamp(x, 0, 1);
  return c * c * (3 - 2 * c);
}

/**
 * Gain (0..volume) at timeline time `t` for a track that starts at `offset`
 * on a video of `total` seconds. The fade-out always ends exactly at `total`;
 * the fade-in starts at the track start.
 */
export function gainAt(track: AudioTrack, t: number, total: number): number {
  const tr = clampAudioTrack(track);
  if (t < tr.offset || t > total) return 0;
  const fadeIn = tr.fadeIn > 0 ? smoothstep((t - tr.offset) / tr.fadeIn) : 1;
  const fadeOut = tr.fadeOut > 0 ? smoothstep((total - t) / tr.fadeOut) : 1;
  return tr.volume * fadeIn * fadeOut;
}

/** Reduce planar channel data to `buckets` peak values normalised to 0..1. */
export function computePeaks(channels: Float32Array[], buckets = PEAK_BUCKETS): number[] {
  const length = channels.reduce((m, c) => Math.max(m, c.length), 0);
  const peaks = new Array<number>(buckets).fill(0);
  if (length === 0) return peaks;
  const per = length / buckets;
  for (let b = 0; b < buckets; b++) {
    const from = Math.floor(b * per);
    const to = Math.min(length, Math.max(from + 1, Math.floor((b + 1) * per)));
    let peak = 0;
    for (const ch of channels) {
      for (let i = from; i < to && i < ch.length; i++) {
        const v = Math.abs(ch[i]);
        if (v > peak) peak = v;
      }
    }
    peaks[b] = peak;
  }
  const max = peaks.reduce((m, p) => Math.max(m, p), 0);
  return max > 0 ? peaks.map((p) => p / max) : peaks;
}

export interface MixedAudio {
  sampleRate: number;
  /** Planar channels, each exactly `round(total * sampleRate)` samples. */
  channels: Float32Array[];
}

/**
 * Renders the track into exactly `total` seconds of audio: placed at `offset`,
 * trimmed or zero-padded to the video length, with volume and fades applied.
 * Source is assumed to already be at `sampleRate`. Pure and deterministic, so
 * it runs in Node, the main thread, or a worker.
 */
export function mixTrack(
  source: Float32Array[],
  track: AudioTrack,
  total: number,
  sampleRate = AUDIO_SAMPLE_RATE,
  outChannels = 2,
): MixedAudio {
  const frames = Math.max(1, Math.round(total * sampleRate));
  const out: Float32Array[] = [];
  for (let c = 0; c < outChannels; c++) out.push(new Float32Array(frames));
  if (source.length === 0) return { sampleRate, channels: out };

  const tr = clampAudioTrack(track);
  const startFrame = Math.round(tr.offset * sampleRate);
  for (let c = 0; c < outChannels; c++) {
    const src = source[Math.min(c, source.length - 1)];
    const dst = out[c];
    const end = Math.min(frames, startFrame + src.length);
    for (let i = startFrame; i < end; i++) {
      dst[i] = src[i - startFrame] * gainAt(tr, i / sampleRate, total);
    }
  }
  return { sampleRate, channels: out };
}

export function rms(data: Float32Array, from: number, to: number): number {
  const a = Math.max(0, Math.floor(from));
  const b = Math.min(data.length, Math.floor(to));
  if (b <= a) return 0;
  let sum = 0;
  for (let i = a; i < b; i++) sum += data[i] * data[i];
  return Math.sqrt(sum / (b - a));
}

export interface PreviewStart {
  /** Seconds from "now" to wait before the source starts. */
  delay: number;
  /** Offset into the audio buffer to start at. */
  bufferOffset: number;
  /** Seconds of audio to play (until the video ends). */
  duration: number;
}

/**
 * Where a Web Audio source must start so the track is in sync with the
 * playhead at `time`. Returns null when nothing is audible any more.
 */
export function previewStart(
  track: AudioTrack,
  bufferDuration: number,
  time: number,
  total: number,
): PreviewStart | null {
  const tr = clampAudioTrack(track);
  if (time >= total) return null;
  const into = time - tr.offset;
  if (into >= bufferDuration) return null;
  const delay = Math.max(0, -into);
  const bufferOffset = Math.max(0, into);
  const duration = Math.min(bufferDuration - bufferOffset, total - Math.max(time, tr.offset));
  if (duration <= 0) return null;
  return { delay, bufferOffset, duration };
}
