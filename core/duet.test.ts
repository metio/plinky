// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { type AccompanyVoice, accompanimentForGap, gapsForRun } from "./duet";

// 120 BPM: 500 ms per quarter, so 2000 ms per whole note — the spacing every
// delay below is a multiple of.
const BPM = 120;

// A note of yours, for the walks gapsForRun merges. Elapsed time is what decides which
// gap a note of theirs falls in, so it is what these carry.
const mine = (elapsedMs: number) => ({ elapsedMs });

// The accompanying hand. `elapsedMs` defaults to the printed onset read as whole notes at
// 120, which is what a score with no repeat and no tempo change gives.
const them = (whole: number, pitch: number, quarters = 1, elapsedMs = whole * 2000) => ({
    pitch,
    whole,
    elapsedMs,
    quarters,
});

const voices: AccompanyVoice[] = [
    them(-0.25, 40, 1), // a pickup before your first note
    them(0, 48, 2), // together with your note at whole 0
    them(0.5, 50, 1), // halfway through the gap
    them(1, 52, 1), // your next note's onset — the next gap's
];

// Your two notes, printed at whole 0 and whole 1 — two seconds apart at 120.
const MY_WHOLES = [0, 1];
const MY_RUN = MY_WHOLES.map((whole) => mine(whole * 2000));

// The gap opened by your note at `index`, laid out — selection and scheduling together,
// which is how the hook uses them.
const gap = (index: number, bpm = BPM) =>
    accompanimentForGap(gapsForRun(MY_RUN, voices)[index] ?? [], MY_WHOLES[index]!, bpm);

describe("accompanimentForGap", () => {
    it("sounds a note on your onset with you (delay 0)", () => {
        expect(gap(0).find((v) => v.pitch === 48)?.delayMs).toBe(0);
    });

    it("spaces a note inside the gap at the live tempo", () => {
        // Half a whole note past your onset -> half of 2000 ms.
        expect(gap(0).find((v) => v.pitch === 50)?.delayMs).toBe(1000);
    });

    it("leaves a note on your next onset for the next gap", () => {
        expect(gap(0).some((v) => v.pitch === 52)).toBe(false);
        expect(gap(1).some((v) => v.pitch === 52)).toBe(true);
    });

    it("sweeps a pickup into the first gap, sounding it with your first note", () => {
        // Printed before your first note, so its delay clamps to nothing.
        expect(gap(0).find((v) => v.pitch === 40)?.delayMs).toBe(0);
    });

    it("carries the tail of the piece in the final gap", () => {
        expect(gap(1).map((v) => v.pitch)).toEqual([52]);
    });

    it("scales the delay with the tempo — twice as fast halves the wait", () => {
        expect(gap(0, 60).find((v) => v.pitch === 50)?.delayMs).toBe(2000);
        expect(gap(0, 120).find((v) => v.pitch === 50)?.delayMs).toBe(1000);
    });

    it("holds a note for its written length at the tempo", () => {
        // Two quarters at 500 ms each = 1 s.
        expect(gap(0).find((v) => v.pitch === 48)?.durationSec).toBe(1);
    });

    it("gives a length-less note an audible quarter-note tail", () => {
        const one = [them(0, 60, 0)];
        expect(accompanimentForGap(one, 0, BPM)[0]?.durationSec).toBe(0.5);
    });
});

describe("a duet over a written repeat", () => {
    // Three bars, the first two inside a repeat, so both hands are walked C D C D E. The
    // printed onsets rewind; the elapsed times do not.
    const THEIRS = [
        them(0, 48, 4, 0),
        them(1, 50, 4, 2000),
        them(0, 48, 4, 4000),
        them(1, 50, 4, 6000),
        them(2, 52, 4, 8000),
    ];
    const MINE = [mine(0), mine(2000), mine(4000), mine(6000), mine(8000)];

    it("plays each pass's note once, not both passes' in one gap", () => {
        // Two notes are printed at 0, one per pass. Reading the gap as a range of printed
        // onsets matched both and sounded the accompaniment twice.
        for (const index of [0, 1, 2, 3, 4]) {
            expect(gapsForRun(MINE, THEIRS)[index]).toHaveLength(1);
        }
    });

    it("keeps playing across the repeat barline", () => {
        // Your note before the barline is printed at 1; the next one you reach is printed
        // at 0. Read as a range that is [1, 0) — empty — and the accompaniment fell silent
        // at exactly the turn.
        const atBarline = accompanimentForGap(gapsForRun(MINE, THEIRS)[1] ?? [], 1, BPM);
        expect(atBarline).toHaveLength(1);
        expect(atBarline[0]?.pitch).toBe(50);
    });

    it("hands the second pass its own notes, in order", () => {
        const buckets = gapsForRun(MINE, THEIRS);
        expect(buckets.map((b) => b[0]?.pitch)).toEqual([48, 50, 48, 50, 52]);
    });
});

describe("gapsForRun", () => {
    it("gives every note of yours a bucket, even an empty one", () => {
        expect(gapsForRun([mine(0), mine(1000)], [])).toEqual([[], []]);
    });

    it("has nothing to bucket into when you play nothing", () => {
        expect(gapsForRun([], [them(0, 60)])).toEqual([]);
    });

    it("puts everything before your first note in the first gap", () => {
        const buckets = gapsForRun([mine(1000)], [them(-0.5, 40, 1, 0), them(0, 41, 1, 1000)]);
        expect(buckets[0]?.map((v) => v.pitch)).toEqual([40, 41]);
    });
});
