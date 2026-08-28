// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    type ClipNote,
    type ClipWindow,
    clipCut,
    clipEnd,
    ENDING_MS,
    LOOKAHEAD_MS,
    PAUSE_MS,
    PROMO_WINDOW,
    RING_MS,
} from "./clipEnd";

const note = (startMs: number, durationMs: number): ClipNote => ({ startMs, durationMs });
const WINDOW: ClipWindow = { earliestMs: 20_000, latestMs: 30_000, targetMs: 25_000 };
// The music carrying on just past the window, so a fixture does not accidentally end
// inside it — the end of a piece is itself a silence, and it would win tests meant to be
// about a pause mid-phrase. It sits close to the far edge rather than far beyond it,
// because a distant note would leave a huge silence inside the window and win them the
// other way. A real reading stops a few seconds past the window for the same reason.
const CONTINUES = note(30_500, 1_000);

describe("clipEnd", () => {
    it("stops in a silence rather than on the clock", () => {
        const notes = [note(23_000, 2_000), note(26_000, 1_000), CONTINUES];
        expect(clipEnd(notes, WINDOW)).toEqual({ endMs: 27_000, pauseMs: 3_500 });
    });

    it("takes a wider silence a little early over a hairline exactly on the mark", () => {
        const notes = [
            note(22_500, 500), // ends 23_000, and a 400ms breath follows
            note(23_400, 1_600), // ends 25_000, and 10ms of nothing follows
            note(25_010, 500), // ends 25_510
            note(25_600, 5_000),
        ];
        expect(clipEnd(notes, WINDOW).endMs).toBe(23_000);
    });

    it("takes a hairline on the mark over one four seconds early", () => {
        // The same 10ms of silence in both places, so only the timing separates them —
        // which is what keeps a batch of clips averaging where it was asked to.
        const notes = [
            note(20_000, 500), // ends 20_500, 10ms of nothing
            note(20_510, 4_480), // ends 24_990, 10ms of nothing
            note(25_000, 5_600),
        ];
        expect(clipEnd(notes, WINDOW).endMs).toBe(24_990);
    });

    it("breaks a tie toward the wider silence", () => {
        // 24s and 26s are equally near the target; the longer breath is the better ending.
        const notes = [
            note(23_500, 500), // ends 24_000, 1_000ms gap
            note(25_000, 1_000), // ends 26_000, 3_000ms gap
            note(29_000, 100),
            CONTINUES,
        ];
        expect(clipEnd(notes, WINDOW).endMs).toBe(26_000);
    });

    it("uses a gap too short to be a breath only when there is nothing better", () => {
        // Staccato right across the window and out the far side, so the only silences in it
        // are the 150ms between notes — real silence, and none of it an ending. A cut there
        // still lands where nothing sounds, which beats cutting through a note.
        const notes = Array.from({ length: 160 }, (_, i) => note(19_000 + i * 250, 100));
        const end = clipEnd(notes, WINDOW);
        expect(end.pauseMs).toBe(150);
        expect(end.endMs).toBe(25_100);
    });

    it("measures from the longest note still sounding, not the last one started", () => {
        // A held bass under a short melody note: the melody stops early and nothing is
        // silent until the bass lets go.
        const notes = [
            note(21_000, 4_000),
            note(21_500, 100),
            note(26_000, 500),
            note(26_600, 3_900),
        ];
        expect(clipEnd(notes, WINDOW)).toEqual({ endMs: 25_000, pauseMs: 1_000 });
    });

    it("will end where the piece does, when that is the nearest pause", () => {
        const notes = [note(20_000, 500), note(24_000, 1_000)];
        const found = clipEnd(notes, WINDOW);
        expect(found.endMs).toBe(25_000);
        expect(found.pauseMs).toBe(Number.POSITIVE_INFINITY);
    });

    it("cuts at the latest bound when the window holds no pause", () => {
        expect(clipEnd([note(0, 60_000)], WINDOW)).toEqual({ endMs: 30_000 });
    });

    it("does not choose a pause outside the window, at either end", () => {
        expect(clipEnd([note(0, 40_000), note(45_000, 500)], WINDOW).endMs).toBe(30_000);
        expect(clipEnd([note(0, 1_000), note(15_000, 20_000), CONTINUES], WINDOW).endMs).toBe(
            30_000,
        );
    });

    it("reads notes in any order, since a performance is not sorted", () => {
        const jumbled = [CONTINUES, note(26_000, 1_000), note(23_000, 2_000)];
        const ordered = [note(23_000, 2_000), note(26_000, 1_000), CONTINUES];
        expect(clipEnd(jumbled, WINDOW)).toEqual(clipEnd(ordered, WINDOW));
    });

    it("answers the latest bound for a piece with no notes", () => {
        expect(clipEnd([], WINDOW)).toEqual({ endMs: 30_000 });
    });

    it("treats a window with no room as its own bound", () => {
        const shut = { earliestMs: 30_000, latestMs: 30_000, targetMs: 25_000 };
        expect(clipEnd([note(0, 100)], shut).endMs).toBe(30_000);
    });

    it("survives a note with no length rather than sounding backwards", () => {
        // The zero-length note must not pull the running clock back to its own onset: the
        // silence after it starts where it starts, and the note at 24s still sounds through.
        const notes = [note(21_000, 0), note(24_000, 500), CONTINUES];
        expect(clipEnd(notes, WINDOW).endMs).toBe(24_500);
        expect(clipEnd([note(24_000, 500), note(21_000, 0), CONTINUES], WINDOW).endMs).toBe(24_500);
    });

    it("lands near the target across a spread of pieces, which is the point of it", () => {
        // Twenty pieces whose pauses fall at different places; the mean should sit near
        // twenty-five seconds rather than at either end of the window.
        const ends = Array.from({ length: 20 }, (_, i) => {
            const phrase = 1_800 + i * 130;
            const notes: ClipNote[] = [];
            for (let at = 0; at < 40_000; at += phrase) {
                notes.push(note(at, phrase - 400));
            }
            return clipEnd(notes, WINDOW).endMs;
        });
        const mean = ends.reduce((sum, end) => sum + end, 0) / ends.length;
        expect(mean).toBeGreaterThan(23_500);
        expect(mean).toBeLessThan(26_500);
    });
});

describe("clipCut", () => {
    it("lets the last note ring before it stops", () => {
        const notes = [note(23_000, 2_000), note(26_000, 1_000), CONTINUES];
        expect(clipCut(notes, WINDOW).durationMs).toBe(27_000 + RING_MS);
    });

    it("is a whole number of milliseconds, which is what an exporter takes", () => {
        const notes = [note(23_000, 2_000.4), note(26_000, 1_000), CONTINUES];
        expect(Number.isInteger(clipCut(notes, WINDOW).durationMs)).toBe(true);
    });

    it("keeps only the notes that start before the cut", () => {
        const notes = [note(23_000, 2_000), note(26_000, 1_000), CONTINUES];
        expect(clipCut(notes, WINDOW).notes).toEqual([note(23_000, 2_000), note(26_000, 1_000)]);
    });

    it("plays the whole piece when there is no window", () => {
        const notes = [note(23_000, 2_000), note(26_000, 1_000), CONTINUES];
        const cut = clipCut(notes, null);
        expect(cut.notes).toEqual(notes);
        expect(cut.durationMs).toBe(31_500 + ENDING_MS);
    });

    it("rings longer at the end of a piece than at a cut", () => {
        expect(ENDING_MS).toBeGreaterThan(RING_MS);
    });
});

describe("the promo window", () => {
    it("aims at twenty-five seconds, between twenty and thirty", () => {
        expect(PROMO_WINDOW).toEqual({ earliestMs: 20_000, latestMs: 30_000, targetMs: 25_000 });
    });

    it("sits the pause threshold above articulation and below a breath", () => {
        expect(PAUSE_MS).toBeGreaterThan(100);
        expect(PAUSE_MS).toBeLessThan(500);
    });
});

describe("music with no breath in it", () => {
    // Legato under the pedal: every note is still sounding when the next arrives, so the
    // window holds nothing that clears the pause threshold.
    const legato = (): ClipNote[] => {
        const notes: ClipNote[] = [];
        for (let at = 0; at < 40_000; at += 500) {
            // 600ms of sound every 500ms — always overlapping, never a silence.
            notes.push(note(at, 600));
        }
        return notes;
    };

    it("cuts inside the window rather than letting a held note run past it", () => {
        const cut = clipCut(legato(), WINDOW);
        expect(cut.durationMs).toBeLessThanOrEqual(WINDOW.latestMs + RING_MS);
    });

    it("says no pause decided it, so a report can tell the two apart", () => {
        expect(clipEnd(legato(), WINDOW).pauseMs).toBeUndefined();
    });

    it("takes a narrow separation over none at all", () => {
        // A single 120ms hole at 24s — under the threshold, but the one moment in the
        // window where nothing is sounding.
        const notes: ClipNote[] = [];
        for (let at = 0; at < 40_000; at += 500) {
            notes.push(note(at, at === 23_500 ? 380 : 600));
        }
        const end = clipEnd(notes, WINDOW);
        expect(end.endMs).toBe(23_880);
        expect(end.pauseMs).toBe(120);
    });

    it("prefers a real breath to a narrow separation, even a less well-timed one", () => {
        const notes = [
            note(20_000, 500),
            // A proper pause at 20.5s, four and a half seconds shy of the target.
            note(23_000, 600),
            // Hairline separations either side of the target, none of them a breath.
            note(23_700, 1_300),
            note(25_100, 500),
            note(25_700, 20_000),
        ];
        const end = clipEnd(notes, WINDOW);
        expect(end.pauseMs).toBeGreaterThanOrEqual(PAUSE_MS);
        expect(end.endMs).toBe(20_500);
    });
});

describe("an ending and a stop", () => {
    it("treats the piece running out inside the window as the best ending there is", () => {
        const notes = [note(20_000, 500), note(24_000, 800)];
        const end = clipEnd(notes, WINDOW);
        expect(end.endMs).toBe(24_800);
        expect(end.pauseMs).toBe(Number.POSITIVE_INFINITY);
    });

    it("gives that ending an ending's room rather than a cut's", () => {
        const notes = [note(20_000, 500), note(24_000, 800)];
        expect(clipCut(notes, WINDOW).durationMs).toBe(24_800 + ENDING_MS);
    });

    it("reads far enough past the window to tell an ending from a stop", () => {
        // A reading that halted at the window's far edge would look exactly like a piece
        // ending there. The lookahead is what separates them, so it has to be real room.
        expect(LOOKAHEAD_MS).toBeGreaterThan(1_000);
    });
});
