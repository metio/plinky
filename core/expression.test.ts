// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { DEFAULT_VELOCITY, type NoteMarks, performNote } from "./expression";

const plain: NoteMarks = {
    quarters: 1,
    articulation: "none",
    accent: false,
    marcato: false,
    slurred: false,
    dynamicVolume: null,
};

describe("performNote length", () => {
    it("sounds a plain note its full written length at the tempo", () => {
        // One quarter at 120 BPM is half a second, unchanged from flat playback.
        expect(performNote(plain, 120).durationSeconds).toBeCloseTo(0.5);
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

    it("lets a slur override a clip so the note connects", () => {
        const slurredStaccato = performNote(
            { ...plain, articulation: "staccato", slurred: true },
            120,
        );
        expect(slurredStaccato.durationSeconds).toBeCloseTo(0.5);
    });

    it("scales the whole tie's length for a held tie start", () => {
        expect(performNote({ ...plain, quarters: 3 }, 120).durationSeconds).toBeCloseTo(1.5);
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
