/** 24 kHz PCM config for speaker raw playback (matches xiaozhi example). */
export interface AudioConfig {
  pcm: string;
  channels: number;
  bits_per_sample: number;
  sample_rate: number;
  period_size: number;
  buffer_size: number;
}

export const kPlayAudioConfig: AudioConfig = {
  pcm: "noop",
  channels: 1,
  bits_per_sample: 16,
  sample_rate: 24000,
  period_size: 360,
  buffer_size: 1440,
};

/** Generate a sine tone as s16le PCM. */
export function generateSinePcm(
  frequencyHz: number,
  sampleRate: number,
  durationSec: number,
  volume = 0.3
): Uint8Array {
  const sampleCount = Math.floor(sampleRate * durationSec);
  const bytes = new Uint8Array(sampleCount * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < sampleCount; i++) {
    const sample =
      Math.sin((2 * Math.PI * frequencyHz * i) / sampleRate) * volume * 32767;
    view.setInt16(i * 2, Math.round(sample), true);
  }
  return bytes;
}

export function chunkPcm(
  pcm: Uint8Array,
  chunkBytes = 960
): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < pcm.length; i += chunkBytes) {
    chunks.push(pcm.subarray(i, i + chunkBytes));
  }
  return chunks;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
