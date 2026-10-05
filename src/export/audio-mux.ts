import { AudioSample, AudioSampleSource, canEncodeAudio, QUALITY_HIGH } from "mediabunny";
import type { Output } from "mediabunny";
import type { ProjectDoc } from "../doc/types";
import { decodeAudioBlob } from "../audio/decode";
import { AUDIO_SAMPLE_RATE, mixTrack, type MixedAudio } from "../audio/mix";

export type ExportAudioCodec = "aac" | "opus";

export interface ExportAudio {
  mix: MixedAudio;
  codec: ExportAudioCodec;
}

export interface PreparedExportAudio {
  audio?: ExportAudio;
  /** Human-readable reasons the music was skipped. Empty when audio is fine or absent. */
  warnings: string[];
}

export function audioCodecFor(container: "mp4" | "webm"): ExportAudioCodec {
  return container === "mp4" ? "aac" : "opus";
}

export async function canEncodeExportAudio(codec: ExportAudioCodec): Promise<boolean> {
  try {
    return await canEncodeAudio(codec, {
      numberOfChannels: 2,
      sampleRate: AUDIO_SAMPLE_RATE,
      bitrate: 192_000,
    });
  } catch (error) {
    console.warn("Audio encoder capability probe failed:", error);
    return false;
  }
}

/** Returns a copy of the doc with no music track (web-embed bundles never include audio). */
export function withoutAudio(doc: ProjectDoc): ProjectDoc {
  if (!doc.audio) return doc;
  const copy: ProjectDoc = { ...doc };
  delete copy.audio;
  return copy;
}

/**
 * Decodes and mixes the project's music into exactly `total` seconds, after
 * probing the encoder. Never throws: if anything is unavailable the export
 * continues without audio and the reason is returned as a warning.
 */
export async function prepareExportAudio(
  doc: ProjectDoc,
  getAudio: ((assetId: string) => Promise<Blob | null>) | undefined,
  total: number,
  container: "mp4" | "webm",
): Promise<PreparedExportAudio> {
  const track = doc.audio;
  if (!track) return { warnings: [] };

  const asset = doc.assets.find((a) => a.id === track.assetId && a.kind === "audio");
  let blob: Blob | null = null;
  if (asset && getAudio) {
    try {
      blob = await getAudio(asset.id);
    } catch (error) {
      console.warn("Could not read project audio asset:", error);
    }
  }
  if (!blob) {
    return { warnings: ["The music file is missing, so the video was exported without audio."] };
  }

  const codec = audioCodecFor(container);
  if (!(await canEncodeExportAudio(codec))) {
    return {
      warnings: [
        `This browser can't encode ${codec === "aac" ? "AAC" : "Opus"} audio, so the video was exported without music.`,
      ],
    };
  }

  try {
    const decoded = await decodeAudioBlob(blob);
    const mix = mixTrack(decoded.channels, track, total, decoded.sampleRate);
    return { audio: { mix, codec }, warnings: [] };
  } catch (error) {
    console.warn("Could not decode project audio:", error);
    return {
      warnings: ["The music file couldn't be decoded, so the video was exported without audio."],
    };
  }
}

/** Registers the audio track on the output. Must be called before `output.start()`. */
export function addAudioTrackToOutput(output: Output, audio: ExportAudio): AudioSampleSource {
  const source = new AudioSampleSource({ codec: audio.codec, quality: QUALITY_HIGH });
  output.addAudioTrack(source);
  return source;
}

/** Feeds the mixed buffer to the encoder in 1-second chunks, then closes the source. */
export async function writeAudio(source: AudioSampleSource, audio: ExportAudio): Promise<void> {
  const { channels, sampleRate } = audio.mix;
  const frames = channels[0]?.length ?? 0;
  const chunk = sampleRate;
  for (let start = 0; start < frames; start += chunk) {
    const n = Math.min(chunk, frames - start);
    const planar = new Float32Array(n * channels.length);
    channels.forEach((ch, c) => planar.set(ch.subarray(start, start + n), c * n));
    const sample = new AudioSample({
      data: planar,
      format: "f32-planar",
      numberOfChannels: channels.length,
      sampleRate,
      timestamp: start / sampleRate,
    });
    await source.add(sample);
    sample.close();
  }
  source.close();
}
