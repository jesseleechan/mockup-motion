import type { AssetRef } from "../doc/types";
import { AUDIO_SAMPLE_RATE, computePeaks } from "./mix";

const AUDIO_EXTENSIONS = ["mp3", "m4a", "wav", "ogg"];
const AUDIO_MIME_BY_EXT: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
};
const AUDIO_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/aac",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/ogg",
  "application/ogg",
]);

const MAX_BYTES = 60 * 1024 * 1024;
const MAX_DURATION_SEC = 15 * 60;

/** Accept string for `<input type="file">`. */
export const AUDIO_ACCEPT = ".mp3,.m4a,.wav,.ogg,audio/mpeg,audio/mp4,audio/wav,audio/ogg";

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function isSupportedAudioFile(file: { name: string; type: string }): boolean {
  return AUDIO_MIME_TYPES.has(file.type) || AUDIO_EXTENSIONS.includes(extensionOf(file.name));
}

export interface DecodedAudio {
  sampleRate: number;
  channels: Float32Array[];
  durationSec: number;
}

/** Decodes any supported audio blob to planar float channels at 48 kHz. */
export async function decodeAudioBlob(blob: Blob): Promise<DecodedAudio> {
  if (typeof OfflineAudioContext === "undefined") {
    throw new Error("This browser can't decode audio.");
  }
  // OfflineAudioContext resamples decoded audio to its own sample rate.
  const ctx = new OfflineAudioContext(2, 1, AUDIO_SAMPLE_RATE);
  const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }
  return { sampleRate: buffer.sampleRate, channels, durationSec: buffer.duration };
}

/** Validates a music file and builds its `AssetRef` (duration + 200-bucket waveform). */
export async function validateAndDecodeAudio(
  file: File,
  id: string = crypto.randomUUID(),
): Promise<{ ref: AssetRef; blob: Blob }> {
  if (!isSupportedAudioFile(file)) {
    throw new Error(`${file.name}: use MP3, M4A, WAV, or OGG.`);
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`${file.name}: audio must be below 60 MB.`);
  }

  let decoded: DecodedAudio;
  try {
    decoded = await decodeAudioBlob(file);
  } catch {
    throw new Error(`${file.name}: this audio file couldn't be read.`);
  }
  if (decoded.durationSec <= 0) {
    throw new Error(`${file.name}: this audio file is empty.`);
  }
  if (decoded.durationSec > MAX_DURATION_SEC) {
    throw new Error(`${file.name}: audio must be shorter than 15 minutes.`);
  }

  const mime = file.type || AUDIO_MIME_BY_EXT[extensionOf(file.name)] || "audio/mpeg";
  const ref: AssetRef = {
    id,
    kind: "audio",
    name: file.name,
    mime,
    bytes: file.size,
    durationSec: decoded.durationSec,
    peaks: computePeaks(decoded.channels),
  };
  return { ref, blob: file };
}
