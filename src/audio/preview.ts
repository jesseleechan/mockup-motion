import type { AudioTrack } from "../doc/types";
import { clampAudioTrack, gainAt, previewStart } from "./mix";

const CURVE_HZ = 50;

/**
 * Web Audio preview of the music track, kept in sync with the editor playhead.
 * `start()` is idempotent: calling it again re-syncs to the supplied time
 * (used after seeks, loop wraps, and volume/fade edits).
 */
export class AudioPreview {
  private ctx: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private anchor: { ctxTime: number; timeline: number; delay: number } | null = null;

  get loaded(): boolean {
    return this.buffer !== null;
  }

  get duration(): number {
    return this.buffer?.duration ?? 0;
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof AudioContext === "undefined") return null;
    this.ctx = new AudioContext();
    return this.ctx;
  }

  async load(blob: Blob): Promise<void> {
    this.stop();
    const ctx = this.ensureContext();
    if (!ctx) throw new Error("Web Audio is not available.");
    this.buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
  }

  clear(): void {
    this.stop();
    this.buffer = null;
  }

  /** Starts (or restarts) playback so the audio matches timeline time `time`. */
  start(track: AudioTrack, total: number, time: number): void {
    this.stop();
    const ctx = this.ctx;
    const buffer = this.buffer;
    if (!ctx || !buffer) return;
    void ctx.resume();

    const tr = clampAudioTrack(track);
    const plan = previewStart(tr, buffer.duration, time, total);
    if (!plan) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();

    const now = ctx.currentTime;
    const begin = now + plan.delay;
    const steps = Math.max(2, Math.ceil(plan.duration * CURVE_HZ) + 1);
    const curve = new Float32Array(steps);
    const timelineStart = Math.max(time, tr.offset);
    for (let i = 0; i < steps; i++) {
      const t = timelineStart + (i / (steps - 1)) * plan.duration;
      curve[i] = gainAt(tr, t, total);
    }
    gain.gain.setValueAtTime(curve[0], now);
    gain.gain.setValueCurveAtTime(curve, begin, plan.duration);

    source.connect(gain).connect(ctx.destination);
    source.start(begin, plan.bufferOffset, plan.duration);

    this.source = source;
    this.gainNode = gain;
    this.anchor = { ctxTime: now, timeline: time, delay: plan.delay };
  }

  stop(): void {
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        // already stopped
      }
      this.source.disconnect();
    }
    this.gainNode?.disconnect();
    this.source = null;
    this.gainNode = null;
    this.anchor = null;
  }

  /** Timeline time the audio clock is currently at, or null when silent. */
  position(): number | null {
    if (!this.ctx || !this.anchor) return null;
    return this.anchor.timeline + (this.ctx.currentTime - this.anchor.ctxTime);
  }

  dispose(): void {
    this.clear();
    void this.ctx?.close();
    this.ctx = null;
  }
}
