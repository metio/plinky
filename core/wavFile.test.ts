// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { type PlanarAudio, wavBytes } from "./wavFile";

// A WAV file is only as good as its header: a player reads the sizes rather than deriving
// them, so a chunk size that disagrees with the data is a file that opens and then plays
// silence, noise, or half of itself. Nothing about that is visible from the app, which is
// why these assert the bytes.

const audioOf = (channels: number[][], sampleRate = 48_000): PlanarAudio => ({
    sampleRate,
    numberOfChannels: channels.length,
    length: channels[0]?.length ?? 0,
    getChannelData: (channel) => Float32Array.from(channels[channel] ?? []),
});

const text = (bytes: Uint8Array, at: number, length: number) =>
    String.fromCharCode(...bytes.subarray(at, at + length));

const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

describe("wavBytes", () => {
    it("writes the RIFF/WAVE chunk names a player looks for", () => {
        const bytes = wavBytes(audioOf([[0]]));
        expect(text(bytes, 0, 4)).toBe("RIFF");
        expect(text(bytes, 8, 4)).toBe("WAVE");
        expect(text(bytes, 12, 4)).toBe("fmt ");
        expect(text(bytes, 36, 4)).toBe("data");
    });

    it("sizes the file, the RIFF chunk and the data chunk consistently", () => {
        const frames = 100;
        const bytes = wavBytes(audioOf([new Array(frames).fill(0), new Array(frames).fill(0)]));
        const dataBytes = frames * 2 * 2;
        expect(bytes.length).toBe(44 + dataBytes);
        // The RIFF size counts everything after its own field: the whole file less 8.
        expect(view(bytes).getUint32(4, true)).toBe(bytes.length - 8);
        expect(view(bytes).getUint32(40, true)).toBe(dataBytes);
    });

    it("describes the audio it actually holds", () => {
        const bytes = wavBytes(audioOf([[0], [0]], 44_100));
        const data = view(bytes);
        expect(data.getUint16(20, true)).toBe(1); // uncompressed PCM
        expect(data.getUint16(22, true)).toBe(2); // channels
        expect(data.getUint32(24, true)).toBe(44_100);
        expect(data.getUint16(34, true)).toBe(16); // bits per sample
        // Byte rate and block align are derivable, and players read them rather than derive.
        expect(data.getUint32(28, true)).toBe(44_100 * 4);
        expect(data.getUint16(32, true)).toBe(4);
    });

    it("interleaves the channels, rather than writing one after the other", () => {
        // Left and right are told apart by value, so a file written channel-by-channel —
        // the shape the render holds, and the classic mistake — fails here rather than
        // playing as a take whose hands arrive one after the other.
        const bytes = wavBytes(
            audioOf([
                [1, 1],
                [-1, -1],
            ]),
        );
        const data = view(bytes);
        expect(data.getInt16(44, true)).toBe(32_767); // frame 0, left
        expect(data.getInt16(46, true)).toBe(-32_767); // frame 0, right
        expect(data.getInt16(48, true)).toBe(32_767); // frame 1, left
        expect(data.getInt16(50, true)).toBe(-32_767); // frame 1, right
    });

    it("holds a sample past full scale instead of letting it wrap", () => {
        // Several notes landing together can overshoot 1.0 in an offline render. Wrapping
        // turns a loud moment into a crack of the opposite polarity, which is far more
        // audible than the clipping it replaces.
        const bytes = wavBytes(audioOf([[2, -2]]));
        const data = view(bytes);
        expect(data.getInt16(44, true)).toBe(32_767);
        expect(data.getInt16(46, true)).toBe(-32_767);
    });

    it("writes a valid empty file for a take with no samples", () => {
        const bytes = wavBytes(audioOf([[]]));
        expect(bytes.length).toBe(44);
        expect(view(bytes).getUint32(40, true)).toBe(0);
        expect(view(bytes).getUint32(4, true)).toBe(36);
    });

    it("treats a short channel as silence rather than reading past it", () => {
        // The channels of a real render are the same length; a stub's need not be, and
        // reading past one would write undefined as NaN and produce an unplayable file.
        const bytes = wavBytes({
            sampleRate: 48_000,
            numberOfChannels: 2,
            length: 2,
            getChannelData: (channel) => Float32Array.from(channel === 0 ? [1, 1] : [1]),
        });
        expect(view(bytes).getInt16(50, true)).toBe(0);
    });
});
