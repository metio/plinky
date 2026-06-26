// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type CorrectInfo, useScoreMatcher } from "./useScoreMatcher";

// A position is the chord sounding at one cursor step; an empty array is a rest.
// halfTone is OSMD's pitch index, which the matcher maps to MIDI as halfTone + 12.
// A bare number is a right-hand (staff 0) note; {midi, staff} pins the staff so
// hands-separate matching can be exercised.
type Voice = number | { midi: number; staff: number };
type Position = Voice[];

function midiToHalfTone(midi: number): number {
    return midi - 12;
}

// A minimal stand-in for the OSMD cursor the matcher drives: just enough of
// NotesUnderCursor / iterator / next / reset / show / hide to exercise matching.
function fakeOsmd(positions: Position[]): { osmd: OpenSheetMusicDisplay; shown: () => boolean } {
    let index = 0;
    let shown = false;
    const cursor = {
        get iterator() {
            return {
                EndReached: index >= positions.length,
                currentTimeStamp: { RealValue: index * 0.25 },
            };
        },
        NotesUnderCursor() {
            const chord = positions[index] ?? [];
            return chord.map((voice) => {
                const midi = typeof voice === "number" ? voice : voice.midi;
                const staff = typeof voice === "number" ? 0 : voice.staff;
                return {
                    isRest: () => false,
                    halfTone: midiToHalfTone(midi),
                    ParentStaff: { idInMusicSheet: staff },
                };
            });
        },
        next() {
            index += 1;
        },
        reset() {
            index = 0;
        },
        show() {
            shown = true;
        },
        hide() {
            shown = false;
        },
    };
    return { osmd: { cursor } as unknown as OpenSheetMusicDisplay, shown: () => shown };
}

function render(positions: Position[], options: Parameters<typeof useScoreMatcher>[1] = {}) {
    const handle = fakeOsmd(positions);
    const view = renderHook(({ opts }) => useScoreMatcher(() => handle.osmd, opts), {
        initialProps: { opts: options },
    });
    return { ...view, shown: handle.shown };
}

describe("useScoreMatcher", () => {
    it("matches a single-note line to completion", () => {
        const { result } = render([[60], [62]]);
        act(() => result.current.start());
        expect(result.current.practicing).toBe(true);
        expect(result.current.total).toBe(2);
        expect(result.current.expected).toEqual([60]);

        act(() => result.current.registerNote(60));
        expect(result.current.done).toBe(1);
        expect(result.current.expected).toEqual([62]);

        act(() => result.current.registerNote(62));
        expect(result.current.complete).toBe(true);
        expect(result.current.done).toBe(2);
        expect(result.current.practicing).toBe(false);
    });

    it("requires every pitch of a chord and ignores a duplicate press", () => {
        const { result } = render([[60, 64]]);
        act(() => result.current.start());
        act(() => result.current.registerNote(60));
        expect(result.current.complete).toBe(false);
        act(() => result.current.registerNote(60)); // duplicate, no progress, no wrong
        expect(result.current.complete).toBe(false);
        expect(result.current.wrong).toBe(0);
        act(() => result.current.registerNote(64));
        expect(result.current.complete).toBe(true);
    });

    it("counts a wrong note and attributes it to the position being cleared", () => {
        const onCorrect = vi.fn();
        const { result } = render([[60]], { onCorrect });
        act(() => result.current.start());
        act(() => result.current.registerNote(61)); // wrong
        expect(result.current.wrong).toBe(1);
        act(() => result.current.registerNote(60)); // right
        expect((onCorrect.mock.calls[0]![0] as CorrectInfo).wrongBefore).toBe(1);
    });

    it("skips leading rests so the first expected position has notes", () => {
        const { result } = render([[], [60]]);
        act(() => result.current.start());
        expect(result.current.total).toBe(1);
        expect(result.current.expected).toEqual([60]);
    });

    it("does not enter practicing for an all-rests score", () => {
        const { result, shown } = render([[], []]);
        act(() => result.current.start());
        expect(result.current.practicing).toBe(false);
        expect(result.current.complete).toBe(false);
        expect(result.current.total).toBe(0);
        expect(shown()).toBe(false);
    });

    it("drills one hand, skipping positions where only the other hand sounds", () => {
        const positions: Position[] = [
            [{ midi: 60, staff: 0 }], // right only
            [{ midi: 48, staff: 1 }], // left only — skipped when drilling the right
            [
                { midi: 62, staff: 0 },
                { midi: 50, staff: 1 },
            ],
        ];
        const { result } = render(positions, { hand: "right" });
        act(() => result.current.start());
        expect(result.current.total).toBe(2);
        expect(result.current.expected).toEqual([60]);

        act(() => result.current.registerNote(60));
        // The left-only position is skipped; the next right note is the chord's.
        expect(result.current.expected).toEqual([62]);
        act(() => result.current.registerNote(62));
        expect(result.current.complete).toBe(true);
    });

    it("counts the other hand's note as wrong during hands-separate practice", () => {
        const positions: Position[] = [
            [
                { midi: 60, staff: 0 },
                { midi: 48, staff: 1 },
            ],
        ];
        const { result } = render(positions, { hand: "left" });
        act(() => result.current.start());
        expect(result.current.expected).toEqual([48]);
        act(() => result.current.registerNote(60)); // right-hand note, not expected
        expect(result.current.wrong).toBe(1);
        act(() => result.current.registerNote(48));
        expect(result.current.complete).toBe(true);
    });

    it("freezes the tempo at start so a later change doesn't rescale note times", () => {
        const onCorrect = vi.fn();
        const { result, rerender } = render([[60], [62]], { onCorrect, tempo: 100 });
        act(() => result.current.start());
        // Change the tempo mid-run; the captured timing must keep the start tempo.
        rerender({ opts: { onCorrect, tempo: 200 } });
        act(() => result.current.registerNote(60));
        act(() => result.current.registerNote(62));
        const times = onCorrect.mock.calls.map((call) => (call[0] as CorrectInfo).timeMs);
        // RealValue 0.25 * 4 * (60000 / 100) = 600 for the second note at tempo 100.
        expect(times[1]).toBeCloseTo(600);
    });
});
