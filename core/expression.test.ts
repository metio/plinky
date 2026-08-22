// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { DEFAULT_VELOCITY, legatoOverlap, type NoteMarks, performNote } from "./expression";

const plain: NoteMarks = {
    quarters: 1,
    articulation: "none",
    accent: false,
    marcato: false,
    slurred: false,
    dynamicVolume: null,
};

describe("performNote length", () => {
    it("leaves a hair of air after a note the score neither slurs nor articulates", () => {
        // One quarter at 120 BPM is written as half a second, and a note held for exactly
        // that never stops sounding before the next one starts: a run of them is one
        // continuous band of tone rather than a series of notes. A finger lifts.
        //
        // Nearly all of the length, though — this is a lift, not an articulation, and the
        // score has a staccato for when it means one.
        const played = performNote(plain, 120).durationSeconds;
        expect(played).toBeLessThan(0.5);
        expect(played).toBeGreaterThan(0.45);
    });

    it("holds a note the score does mark for exactly as long as it says", () => {
        // The lift is only for notes with nothing written on them. Tenuto means hold it,
        // and a slur means join to the next — inventing a gap in either would be playing
        // against the page.
        expect(performNote({ ...plain, articulation: "tenuto" }, 120).durationSeconds).toBeCloseTo(
            0.5,
        );
        expect(
            performNote({ ...plain, slurred: true }, 120).durationSeconds,
        ).toBeGreaterThanOrEqual(0.5);
    });

    it("clips staccato short and staccatissimo shorter", () => {
        const staccato = performNote({ ...plain, articulation: "staccato" }, 120);
        const staccatissimo = performNote({ ...plain, articulation: "staccatissimo" }, 120);
        expect(staccato.durationSeconds).toBeCloseTo(0.25);
        expect(staccatissimo.durationSeconds).toBeCloseTo(0.125);
        expect(staccatissimo.durationSeconds).toBeLessThan(staccato.durationSeconds);
    });

    it("holds tenuto its full length", () => {
        expect(performNote({ ...plain, articulation: "tenuto" }, 120).durationSeconds).toBeCloseTo(
            0.5,
        );
    });

    it("lets a slur override a clip, and joins the note to the next one", () => {
        // A slurred staccato (portato) is held its full length rather than clipped — and
        // then a little past it, because a note that stops at the very instant the next
        // one starts is a seam and not a join.
        const slurredStaccato = performNote(
            { ...plain, articulation: "staccato", slurred: true },
            120,
        );
        expect(slurredStaccato.durationSeconds).toBeGreaterThan(0.5);
    });

    it("rings a slurred note past its written end, so the notes actually connect", () => {
        // The defect this pins: `slurred` resolved to a length scale of 1, which is what a
        // plain note already gets — so every slur in every score was read, and then did
        // nothing at all.
        const plainNote = performNote(plain, 120);
        const slurred = performNote({ ...plain, slurred: true }, 120);
        expect(slurred.durationSeconds).toBeGreaterThan(plainNote.durationSeconds);
    });

    it("joins a long note by the same amount as a short one", () => {
        // The overlap is a fraction of a beat, not of the note: scaling the note itself
        // would give a slurred whole note an overlap sixteen times a quaver's, and it would
        // still be sounding two notes later.
        const quaver = legatoOverlap({ slurred: true, quarters: 0.5 }, 120);
        const semibreve = legatoOverlap({ slurred: true, quarters: 4 }, 120);
        expect(semibreve).toBeCloseTo(quaver);
    });

    it("never lets the join outlast a quarter of a very short note", () => {
        const tiny = legatoOverlap({ slurred: true, quarters: 0.05 }, 120);
        const full = 0.05 * (60 / 120);
        expect(tiny).toBeCloseTo(full * 0.25);
    });

    it("leaves the last note of a slur alone, and every unslurred note", () => {
        // The slur's end note has nothing to join to — the phrase stops there.
        expect(legatoOverlap({ slurred: false, quarters: 1 }, 120)).toBe(0);
    });

    it("shortens the join as the tempo rises, because a beat is shorter", () => {
        expect(legatoOverlap({ slurred: true, quarters: 1 }, 60)).toBeGreaterThan(
            legatoOverlap({ slurred: true, quarters: 1 }, 120),
        );
    });

    it("scales the whole tie's length for a held tie start", () => {
        // Three quarters at 120 BPM is 1.5 s written, less the lift a plain note gets.
        expect(performNote({ ...plain, quarters: 3 }, 120).durationSeconds).toBeCloseTo(1.5 * 0.94);
    });
});

describe("performNote velocity", () => {
    it("uses the default velocity when the score marks no dynamic", () => {
        expect(performNote(plain, 120).velocity).toBe(DEFAULT_VELOCITY);
    });

    it("follows the marked dynamic", () => {
        expect(performNote({ ...plain, dynamicVolume: 40 }, 120).velocity).toBe(40);
        expect(performNote({ ...plain, dynamicVolume: 112 }, 120).velocity).toBe(112);
    });

    it("gives a tenuto a little weight, since its length is already full", () => {
        // Without this the mark asks for nothing: a tenuto note lasts exactly as long as
        // an unmarked one, so a score could carry it on every note and sound identical.
        const held = performNote({ ...plain, articulation: "tenuto" }, 120).velocity;
        expect(held).toBeGreaterThan(DEFAULT_VELOCITY);
        // An accent is the louder instruction of the two, and they never compound.
        const both = performNote({ ...plain, articulation: "tenuto", accent: true }, 120).velocity;
        expect(both).toBeGreaterThan(held);
        expect(both).toBe(performNote({ ...plain, accent: true }, 120).velocity);
    });

    it("strikes harder for an accent, harder still for a marcato", () => {
        const accent = performNote({ ...plain, accent: true }, 120).velocity;
        const marcato = performNote({ ...plain, marcato: true }, 120).velocity;
        expect(accent).toBeGreaterThan(DEFAULT_VELOCITY);
        expect(marcato).toBeGreaterThan(accent);
    });

    it("clamps a boosted loud dynamic to the MIDI ceiling", () => {
        expect(performNote({ ...plain, dynamicVolume: 120, marcato: true }, 120).velocity).toBe(127);
    });
});
