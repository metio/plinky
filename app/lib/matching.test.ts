// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { initialMatchState, matchNote, type MatchState } from "./matching";

const mono = [{ pitches: [60] }, { pitches: [62] }];
const chord = [{ pitches: [60, 64, 67] }];

describe("matchNote — single notes", () => {
    it("advances on the expected note", () => {
        const { state, event } = matchNote(initialMatchState, mono, 60);
        expect(event).toEqual({ kind: "correct", index: 0, complete: false });
        expect(state.cursor).toBe(1);
    });

    it("flags a wrong note without advancing", () => {
        const { state, event } = matchNote(initialMatchState, mono, 61);
        expect(event).toEqual({ kind: "wrong", note: 61 });
        expect(state.cursor).toBe(0);
        expect(state.wrongNote).toBe(61);
    });

    it("reports completion on the last step", () => {
        const afterFirst = matchNote(initialMatchState, mono, 60).state;
        const { event } = matchNote(afterFirst, mono, 62);
        expect(event).toEqual({ kind: "correct", index: 1, complete: true });
    });

    it("ignores input once the phrase is complete", () => {
        const done: MatchState = { cursor: 2, pressed: [], wrongNote: null };
        expect(matchNote(done, mono, 60).event).toEqual({ kind: "ignored" });
    });
});

describe("matchNote — chords", () => {
    it("waits for every pitch before advancing", () => {
        let state = initialMatchState;
        const first = matchNote(state, chord, 60);
        expect(first.event).toEqual({ kind: "progress" });
        expect(first.state.pressed).toEqual([60]);

        state = first.state;
        expect(matchNote(state, chord, 64).event).toEqual({ kind: "progress" });
        state = matchNote(state, chord, 64).state;

        const last = matchNote(state, chord, 67);
        expect(last.event).toEqual({ kind: "correct", index: 0, complete: true });
        expect(last.state.cursor).toBe(1);
        expect(last.state.pressed).toEqual([]);
    });

    it("accepts the chord pitches in any order", () => {
        let state = initialMatchState;
        for (const note of [67, 60]) {
            state = matchNote(state, chord, note).state;
        }
        expect(matchNote(state, chord, 64).event).toEqual({
            kind: "correct",
            index: 0,
            complete: true,
        });
    });

    it("ignores a duplicate press of an already-held pitch", () => {
        const afterC = matchNote(initialMatchState, chord, 60).state;
        const again = matchNote(afterC, chord, 60);
        expect(again.event).toEqual({ kind: "progress" });
        expect(again.state.pressed).toEqual([60]);
    });

    it("flags a wrong note mid-chord but keeps the held pitches", () => {
        const afterC = matchNote(initialMatchState, chord, 60).state;
        const wrong = matchNote(afterC, chord, 61);
        expect(wrong.event).toEqual({ kind: "wrong", note: 61 });
        expect(wrong.state.pressed).toEqual([60]);
        // The chord can still be completed afterward.
        const afterE = matchNote(wrong.state, chord, 64).state;
        expect(matchNote(afterE, chord, 67).event).toEqual({
            kind: "correct",
            index: 0,
            complete: true,
        });
    });
});
