// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { collectSteps, type CorrectInfo, useScoreMatcher } from "./useScoreMatcher";

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
                // Four quarter-note positions per 4/4 bar.
                CurrentMeasureIndex: Math.floor(index / 4),
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

describe("collectSteps", () => {
    it("returns playable positions in order, filtered by hand", () => {
        const { osmd } = fakeOsmd([
            [
                { midi: 60, staff: 0 },
                { midi: 48, staff: 1 },
            ],
            [{ midi: 62, staff: 0 }],
            [], // rest — never collected
            [{ midi: 50, staff: 1 }],
        ]);
        expect(collectSteps(osmd, "both")).toEqual([[60, 48], [62], [50]]);
        expect(collectSteps(osmd, "right")).toEqual([[60], [62]]);
        expect(collectSteps(osmd, "left")).toEqual([[48], [50]]);
    });
});

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

    it("reports the staves each cleared position sits on, for per-hand scoring", () => {
        const onCorrect = vi.fn();
        // A grand-staff chord (both hands) then a right-hand-only note.
        const { result } = render(
            [
                [
                    { midi: 60, staff: 0 },
                    { midi: 48, staff: 1 },
                ],
                [{ midi: 62, staff: 0 }],
            ],
            { onCorrect },
        );
        act(() => result.current.start());
        act(() => result.current.registerNote(60));
        act(() => result.current.registerNote(48));
        act(() => result.current.registerNote(62));
        expect((onCorrect.mock.calls[0]![0] as CorrectInfo).staves).toEqual([0, 1]);
        expect((onCorrect.mock.calls[1]![0] as CorrectInfo).staves).toEqual([0]);
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

    it("forgiving mode advances past a slip when you move to the next note", () => {
        const positions: Position[] = [
            [
                { midi: 60, staff: 0 }, // right
                { midi: 48, staff: 1 }, // left
            ],
            [
                { midi: 62, staff: 0 },
                { midi: 50, staff: 1 },
            ],
        ];
        const { result } = render(positions, { forgiving: true });
        act(() => result.current.start());
        expect(result.current.expected).toEqual([60, 48]);

        // Right hand of the first chord lands; the left hand is fluffed, so a strict run
        // would freeze here.
        act(() => result.current.registerNote(60));
        expect(result.current.done).toBe(0);

        // Playing the next chord's right note means the player has moved on: the first
        // position is credited with what was played and the cursor advances.
        act(() => result.current.registerNote(62));
        expect(result.current.done).toBe(1);
        expect(result.current.expected).toEqual([62, 50]);

        act(() => result.current.registerNote(50));
        expect(result.current.complete).toBe(true);
        expect(result.current.done).toBe(2);
    });

    it("strict mode does not advance on the next note, so a slip blocks", () => {
        const positions: Position[] = [[60], [62]];
        const { result } = render(positions); // strict (default)
        act(() => result.current.start());
        act(() => result.current.registerNote(62)); // the next note, played early
        expect(result.current.wrong).toBe(1);
        expect(result.current.done).toBe(0);
    });

    it("resumes from a given onset, grading only the positions from there on", () => {
        // The fake cursor puts position i at whole time i * 0.25, so 0.5 is the third.
        const { result } = render([[60], [62], [64], [65]]);
        act(() => result.current.start(0.5));
        expect(result.current.practicing).toBe(true);
        expect(result.current.total).toBe(2);
        expect(result.current.expected).toEqual([64]);

        act(() => result.current.registerNote(64));
        act(() => result.current.registerNote(65));
        expect(result.current.complete).toBe(true);
        expect(result.current.done).toBe(2);
    });

    it("does not practice when the resume point is past the last note", () => {
        const { result, shown } = render([[60], [62]]);
        act(() => result.current.start(99));
        expect(result.current.practicing).toBe(false);
        expect(result.current.total).toBe(0);
        expect(shown()).toBe(false);
    });

    it("laps a section loop instead of completing the run", () => {
        // Two 4/4 bars of quarter notes; the loop confines the run to bar 1.
        const { result } = render([[60], [62], [64], [65], [67], [69], [71], [72]]);
        act(() => result.current.start(0, { from: 1, to: 1 }));
        expect(result.current.total).toBe(4);
        for (const note of [60, 62, 64, 65]) {
            act(() => result.current.registerNote(note));
        }
        // Clearing the range's last position rewinds to its first for another pass:
        // the drill never completes, and the per-lap progress starts over.
        expect(result.current.complete).toBe(false);
        expect(result.current.practicing).toBe(true);
        expect(result.current.done).toBe(0);
        expect(result.current.expected).toEqual([60]);
        act(() => result.current.registerNote(60));
        expect(result.current.done).toBe(1);
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

describe("whole-piece step indexing (the reveal/ghost address space)", () => {
    it("reports absolute indices when a run resumes mid-piece", () => {
        const { osmd } = fakeOsmd([[60], [62], [64], [65]]);
        const correct: CorrectInfo[] = [];
        const { result } = renderHook(() =>
            useScoreMatcher(() => osmd, { onCorrect: (info) => correct.push(info) }),
        );
        // Resume at the third position (0.5 whole notes in): its ordinal within
        // the run is 0, but its index among the piece's steps is 2.
        act(() => result.current.start(0.5));
        act(() => result.current.registerNote(64));
        expect(correct[0]?.ordinal).toBe(0);
        expect(correct[0]?.index).toBe(2);
    });

    it("reports the wrong-attempt count and the absolute index of the stuck position", () => {
        const { osmd } = fakeOsmd([[60], [62]]);
        const wrongs: { index: number; misses: number }[] = [];
        const { result } = renderHook(() =>
            useScoreMatcher(() => osmd, { onWrong: (info) => wrongs.push(info) }),
        );
        act(() => result.current.start());
        act(() => result.current.registerNote(61));
        act(() => result.current.registerNote(61));
        act(() => result.current.registerNote(60));
        act(() => result.current.registerNote(61));
        // Two misses at the first position (counting up), then one at the second.
        expect(wrongs).toEqual([
            { index: 0, misses: 1 },
            { index: 0, misses: 2 },
            { index: 1, misses: 1 },
        ]);
    });

    it("anchors a section loop's indices at the loop's first step", () => {
        // Two 4/4 bars of quarters; loop bar 2 (positions 4..7).
        const { osmd } = fakeOsmd([[60], [60], [60], [60], [64], [65], [67], [69]]);
        const correct: CorrectInfo[] = [];
        const { result } = renderHook(() =>
            useScoreMatcher(() => osmd, { onCorrect: (info) => correct.push(info) }),
        );
        act(() => result.current.start(0, { from: 2, to: 2 }));
        act(() => result.current.registerNote(64));
        expect(correct[0]?.index).toBe(4);
    });
});
