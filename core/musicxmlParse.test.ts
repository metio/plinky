// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// @vitest-environment jsdom

import { domXmlCodec } from "../app/adapters/domXmlCodec";
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
        const parsed = parseMusicXml(domXmlCodec, toMusicXml(composition));
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
        const parsed = parseMusicXml(domXmlCodec, toMusicXml(composition));
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
        const parsed = parseMusicXml(domXmlCodec, toMusicXml(composition));
        expect(parsed!.notes.length).toBe(1);
        expect(parsed!.notes[0]!.durationMs).toBeCloseTo(4000, 0);
    });

    it("reads tempo and time signature from the score", () => {
        const composition: Composition = {
            notes: [{ pitch: 67, startMs: 0, durationMs: 500, velocity: 90 }],
            tempo: 96,
            beatsPerBar: 3,
        };
        const parsed = parseMusicXml(domXmlCodec, toMusicXml(composition));
        expect(parsed!.beatsPerBar).toBe(3);
        expect(parsed!.tempo).toBe(96);
    });

    it("keeps earlier notes in time when a later measure restates divisions", () => {
        // Measure 1 counts in 1 division per quarter; measure 2 switches to 4. Both
        // notes are written as duration 4, but that means a whole note then a quarter.
        // Timing each duration against the divisions in force when it's read keeps the
        // first note four beats long and the second on beat five; scaling everything by
        // the final divisions would collapse the first note and pull the second early.
        const xml = `<?xml version="1.0"?>
            <score-partwise version="3.1">
                <part-list><score-part id="P1"><part-name>M</part-name></score-part></part-list>
                <part id="P1">
                    <measure number="1">
                        <attributes>
                            <divisions>1</divisions>
                            <time><beats>4</beats><beat-type>4</beat-type></time>
                        </attributes>
                        <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
                    </measure>
                    <measure number="2">
                        <attributes><divisions>4</divisions></attributes>
                        <note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration></note>
                    </measure>
                </part>
            </score-partwise>`;
        const parsed = parseMusicXml(domXmlCodec, xml);
        expect(parsed).not.toBeNull();
        // Default tempo 120 → 500ms per quarter. The whole note runs four beats…
        const c = parsed!.notes.find((n) => n.pitch === 60)!;
        const e = parsed!.notes.find((n) => n.pitch === 64)!;
        expect(c.durationMs).toBeCloseTo(2000, 0);
        // …and the second-measure quarter starts on beat five, not pulled back to beat two.
        expect(e.startMs).toBeCloseTo(2000, 0);
    });

    it("returns null for non-score XML", () => {
        expect(parseMusicXml(domXmlCodec, "<html><body>nope</body></html>")).toBeNull();
        expect(parseMusicXml(domXmlCodec, "not xml at all <<<")).toBeNull();
    });
});
