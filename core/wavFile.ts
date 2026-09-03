// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A rendered take written as a WAV file.
//
// WAV is the one audio format a browser can always produce, because producing it needs no
// encoder at all: the file is a short header followed by the samples themselves. That is
// what makes it the fallback under the compressed export — an engine with no AudioEncoder,
// or none that will take a codec we can mux, can still hand somebody their playing.
//
// It is also why this is pure. Everything here is arithmetic over numbers, so the format
// is testable without a browser, an audio context, or a file on disk — and the parts that
// have historically gone wrong in a hand-written WAV (a chunk size that disagrees with the
// data, channels written in the wrong order) are exactly the parts a test can pin.
//
// Sixteen-bit PCM rather than the float samples the render produces. Float WAV is legal
// and every editor reads it, but half the players a person might drop the file into do
// not, and a take is something you send to somebody. Sixteen bits is the format that
// plays everywhere, and the noise floor it introduces sits far below a piano recording's
// own.

// The header, byte for byte: "RIFF" size "WAVE", a format chunk, then the data chunk.
const HEADER_BYTES = 44;
const BITS_PER_SAMPLE = 16;
// The RIFF code for uncompressed PCM. The only format described here.
const FORMAT_PCM = 1;
// The range a sample is scaled into. 32767 rather than 32768: the positive side of a
// signed 16-bit integer stops one short of the negative, and scaling by the larger number
// makes a full-scale peak wrap to a loud click.
const FULL_SCALE = 32_767;

// The channels of a rendered take. An AudioBuffer satisfies this structurally, so the
// adapter can hand one straight over; so can a hand-built stub in a test.
export type PlanarAudio = {
    sampleRate: number;
    numberOfChannels: number;
    length: number;
    getChannelData(channel: number): Float32Array;
};

// One float sample as a signed 16-bit integer, held inside the range whatever the render
// produced.
//
// Clamping matters: an offline render can overshoot 1.0 where several notes land together,
// and a sample past full scale does not merely distort — it wraps to the opposite
// polarity, which is heard as a crack rather than as loudness.
function pcm(sample: number): number {
    return Math.round(Math.max(-1, Math.min(1, sample)) * FULL_SCALE);
}

export function wavBytes(audio: PlanarAudio): Uint8Array {
    const channels = Math.max(1, audio.numberOfChannels);
    const frames = Math.max(0, audio.length);
    const bytesPerFrame = channels * (BITS_PER_SAMPLE / 8);
    const dataBytes = frames * bytesPerFrame;
    const out = new Uint8Array(HEADER_BYTES + dataBytes);
    const view = new DataView(out.buffer);

    const ascii = (at: number, text: string) => {
        for (let index = 0; index < text.length; index++) {
            out[at + index] = text.charCodeAt(index);
        }
    };

    ascii(0, "RIFF");
    // Everything after this field, which is the whole file less the first eight bytes.
    view.setUint32(4, HEADER_BYTES - 8 + dataBytes, true);
    ascii(8, "WAVE");
    ascii(12, "fmt ");
    // The length of the format chunk that follows: 16 bytes for plain PCM.
    view.setUint32(16, 16, true);
    view.setUint16(20, FORMAT_PCM, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, audio.sampleRate, true);
    // Bytes per second, and bytes per frame: both derivable from the fields above, and both
    // written anyway because the format says so and players read them rather than derive.
    view.setUint32(28, audio.sampleRate * bytesPerFrame, true);
    view.setUint16(32, bytesPerFrame, true);
    view.setUint16(34, BITS_PER_SAMPLE, true);
    ascii(36, "data");
    view.setUint32(40, dataBytes, true);

    // Interleaved, which is what WAV stores and the opposite of how the render holds it:
    // every channel of frame 0, then every channel of frame 1. Read channel by channel so
    // each getChannelData call is made once rather than once per sample.
    for (let channel = 0; channel < channels; channel++) {
        const samples = audio.getChannelData(channel);
        let at = HEADER_BYTES + channel * 2;
        for (let frame = 0; frame < frames; frame++) {
            view.setInt16(at, pcm(samples[frame] ?? 0), true);
            at += bytesPerFrame;
        }
    }
    return out;
}
