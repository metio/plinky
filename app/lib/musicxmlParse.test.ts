// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import type { Composition } from "./composition";
import { toMusicXml } from "./composition";
import { parseMusicXml } from "./musicxmlParse";

describe("parseMusicXml", () => {
    it("round-trips the pitches of a toMusicXml sketch", () => {
        const composition: Composition = {
            notes: [
                { pitch: 60, startMs: 0, durationMs: 500, velocity: 90 },
                { pitch: 62, startMs: 500, durationMs: 500, velocity: 90 },
                { pitch: 64, startMs: 1000, durationMs: 500, velocity: 90 },
            ],
            tempo: 120,
            beatsPerBar: 4,
        };
        const parsed = parseMusicXml(toMusicXml(composition));
        expect(parsed).not.toBeNull();
        expect(parsed!.tempo).toBe(120);
        expect(parsed!.beatsPerBar).toBe(4);
        expect(parsed!.notes.map((n) => n.pitch)).toEqual([60, 62, 64]);
        // Snapped onsets land on the quarter-note grid.
        expect(parsed!.notes.map((n) => Math.round(n.startMs))).toEqual([0, 500, 1000]);
    });

    it("reads a block chord back as simultaneous notes", () => {
        const composition: Composition = {
            notes: [
                { pitch: 60, startMs: 0, durationMs: 500, velocity: 90 },
                { pitch: 64, startMs: 0, durationMs: 500, velocity: 90 },
                { pitch: 67, startMs: 0, durationMs: 500, velocity: 90 },
            ],
            tempo: 120,
            beatsPerBar: 4,
        };
        const parsed = parseMusicXml(toMusicXml(composition));
        const atZero = parsed!.notes.filter((n) => Math.round(n.startMs) === 0);
        expect(atZero.map((n) => n.pitch).sort((a, b) => a - b)).toEqual([60, 64, 67]);
    });

    it("merges a note tied across a barline into one held note", () => {
        // Four seconds at 120bpm/4-4 spans two whole bars as a tied whole note.
        const composition: Composition = {
            notes: [{ pitch: 60, startMs: 0, durationMs: 4000, velocity: 90 }],
            tempo: 120,
            beatsPerBar: 4,
        };
        const parsed = parseMusicXml(toMusicXml(composition));
        expect(parsed!.notes.length).toBe(1);
        expect(parsed!.notes[0]!.durationMs).toBeCloseTo(4000, 0);
    });

    it("reads tempo and time signature from the score", () => {
        const composition: Composition = {
            notes: [{ pitch: 67, startMs: 0, durationMs: 500, velocity: 90 }],
            tempo: 96,
            beatsPerBar: 3,
        };
        const parsed = parseMusicXml(toMusicXml(composition));
        expect(parsed!.beatsPerBar).toBe(3);
        expect(parsed!.tempo).toBe(96);
    });

    it("returns null for non-score XML", () => {
        expect(parseMusicXml("<html><body>nope</body></html>")).toBeNull();
        expect(parseMusicXml("not xml at all <<<")).toBeNull();
    });
});
