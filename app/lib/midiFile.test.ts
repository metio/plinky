// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { buildMidiFile, type MidiNote } from "./midiFile";

const ascii = (bytes: Uint8Array, from: number, length: number) =>
    String.fromCharCode(...bytes.slice(from, from + length));

const u16 = (bytes: Uint8Array, at: number) => (bytes[at]! << 8) | bytes[at + 1]!;

describe("buildMidiFile", () => {
    it("writes a well-formed format-0 header with one track", () => {
        const file = buildMidiFile([{ midi: 60, startQuarters: 0, durationQuarters: 1 }]);
        expect(ascii(file, 0, 4)).toBe("MThd");
        expect(u16(file, 8)).toBe(0); // format 0
        expect(u16(file, 10)).toBe(1); // one track
        expect(u16(file, 12)).toBe(480); // default ppq
        expect(ascii(file, 14, 4)).toBe("MTrk");
    });

    it("declares the track length to match the bytes that follow", () => {
        const file = buildMidiFile([{ midi: 60, startQuarters: 0, durationQuarters: 1 }]);
        const declared = (file[18]! << 24) | (file[19]! << 16) | (file[20]! << 8) | file[21]!;
        expect(declared).toBe(file.length - 22);
    });

    it("encodes the tempo as microseconds per quarter note", () => {
        const file = buildMidiFile([{ midi: 60, startQuarters: 0, durationQuarters: 1 }], {
            tempo: 120,
        });
        // The track opens with delta 0 then the tempo meta FF 51 03.
        const metaAt = 22;
        expect([file[metaAt], file[metaAt + 1], file[metaAt + 2], file[metaAt + 3]]).toEqual([
            0x00, 0xff, 0x51, 0x03,
        ]);
        const mpq = (file[metaAt + 4]! << 16) | (file[metaAt + 5]! << 8) | file[metaAt + 6]!;
        expect(mpq).toBe(500_000); // 60_000_000 / 120
    });

    it("emits a note-on and a note-off for every note", () => {
        const notes: MidiNote[] = [
            { midi: 60, startQuarters: 0, durationQuarters: 1 },
            { midi: 64, startQuarters: 1, durationQuarters: 1 },
        ];
        const file = buildMidiFile(notes);
        const ons = [...file].filter((b) => b === 0x90).length;
        const offs = [...file].filter((b) => b === 0x80).length;
        expect(ons).toBe(2);
        expect(offs).toBe(2);
        // The file ends with the end-of-track meta event.
        expect([...file.slice(-3)]).toEqual([0xff, 0x2f, 0x00]);
    });

    it("uses a variable-length delta when an onset lands past 127 ticks", () => {
        // A note at quarter 1 with ppq 480 starts at tick 480, whose VLQ is 0x83 0x60.
        const file = buildMidiFile([{ midi: 60, startQuarters: 1, durationQuarters: 1 }]);
        expect([...file].some((b, i) => b === 0x83 && file[i + 1] === 0x60)).toBe(true);
    });

    it("clamps pitch and velocity into the MIDI range", () => {
        const file = buildMidiFile([
            { midi: 200, startQuarters: 0, durationQuarters: 1, velocity: 999 },
        ]);
        const onIndex = [...file].indexOf(0x90);
        expect(file[onIndex + 1]).toBe(127); // key clamped
        expect(file[onIndex + 2]).toBe(127); // velocity clamped
    });
});
