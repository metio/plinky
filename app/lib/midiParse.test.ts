// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import type { Composition } from "./composition";
import { toMidiNotes } from "./composition";
import { buildMidiFile } from "./midiFile";
import { parseMidiFile } from "./midiParse";

// Renders a composition to a MIDI file and reads it back, the path a downloaded take
// takes to another device.
function roundTrip(composition: Composition): Composition | null {
    const bytes = buildMidiFile(toMidiNotes(composition), { tempo: composition.tempo });
    return parseMidiFile(bytes);
}

describe("parseMidiFile", () => {
    it("round-trips a composition written by buildMidiFile", () => {
        const composition: Composition = {
            notes: [
                { pitch: 60, startMs: 0, durationMs: 500, velocity: 90 },
                { pitch: 64, startMs: 500, durationMs: 250, velocity: 70 },
                { pitch: 67, startMs: 1000, durationMs: 1000, velocity: 110 },
            ],
            tempo: 120,
            beatsPerBar: 4,
        };
        const parsed = roundTrip(composition);
        expect(parsed).not.toBeNull();
        expect(parsed!.tempo).toBeCloseTo(120, 0);
        expect(parsed!.notes.map((n) => n.pitch)).toEqual([60, 64, 67]);
        expect(parsed!.notes.map((n) => n.velocity)).toEqual([90, 70, 110]);
        for (const [i, note] of parsed!.notes.entries()) {
            expect(note.startMs).toBeCloseTo(composition.notes[i]!.startMs, 0);
            expect(note.durationMs).toBeCloseTo(composition.notes[i]!.durationMs, 0);
        }
    });

    it("anchors the first note at time zero", () => {
        const parsed = roundTrip({
            notes: [{ pitch: 72, startMs: 2000, durationMs: 500, velocity: 80 }],
            tempo: 100,
            beatsPerBar: 4,
        });
        expect(parsed!.notes[0]!.startMs).toBe(0);
    });

    it("preserves a non-default tempo", () => {
        const parsed = roundTrip({
            notes: [{ pitch: 60, startMs: 0, durationMs: 600, velocity: 80 }],
            tempo: 90,
            beatsPerBar: 4,
        });
        expect(parsed!.tempo).toBeCloseTo(90, 0);
    });

    it("returns null for bytes that are not a MIDI file", () => {
        expect(parseMidiFile(new Uint8Array([1, 2, 3, 4]))).toBeNull();
        expect(parseMidiFile(new Uint8Array())).toBeNull();
    });
});
