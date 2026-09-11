// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { fluentNotes } from "./flow";
import { type MatchStep, matchNote, startMatch } from "./matcher";
import { performanceNotes } from "./performance";
import { tempoScale, timingDeltas } from "./rhythm";
import { deriveRunOutcome } from "./runOutcome";
import { captureCleared, liveTempo, startCapture } from "./runCapture";
import { speedFactors } from "./shareCard";

// Crotchets at 500 ms, the third never struck: it carries the fourth note's moment.
const SKIP = [
    { targetMs: 0, playedMs: 0, wrongBefore: 0 },
    { targetMs: 500, playedMs: 500, wrongBefore: 0 },
    { targetMs: 1000, playedMs: 1500, wrongBefore: 1, skipped: true },
    { targetMs: 1500, playedMs: 1500, wrongBefore: 0 },
];

describe("the timing readers, across a skip", () => {
    it("time the note after a skip from the last note struck", () => {
        expect(timingDeltas(SKIP)).toEqual([0, 0, 0, 0]);
        expect(tempoScale(SKIP)).toBe(1);
        // The inverse: the same moments with nothing marked read as a late note and an
        // early one, which is what a note that really was struck there would be.
        const unmarked = SKIP.map(({ skipped: _, ...note }) => note);
        expect(timingDeltas(unmarked)).toEqual([0, 0, 500, -500]);
    });

    it("read no pace from a skip", () => {
        expect(speedFactors(SKIP)).toEqual([1, 1, 1, 1]);
        // A crawl after the skip is still a crawl, measured from the last note struck.
        const slow = SKIP.map((note, at) => (at === 3 ? { ...note, playedMs: 3500 } : note));
        expect(speedFactors(slow)[3]).toBeCloseTo(1000 / 3000);
    });

    it("keep a skip a stumble for Flow, and the note after it fluent", () => {
        expect(fluentNotes(SKIP)).toEqual([true, true, false, true]);
    });

    it("read the live tempo from the last two notes struck", () => {
        const capture = startCapture();
        for (const [ordinal, note] of SKIP.entries()) {
            captureCleared(capture, {
                pitches: [60 + ordinal],
                ordinal,
                timestamp: 10_000 + note.playedMs,
                timeMs: note.targetMs,
                velocity: 80,
                wrongBefore: note.wrongBefore,
                staves: [0],
                skipped: note.skipped === true,
            });
        }
        expect(capture.notes.map((note) => note.skipped === true)).toEqual([
            false,
            false,
            true,
            false,
        ]);
        // 500 → 1500 notated over 500 → 1500 played: the tempo it was played at, not
        // the zero gap from the skip.
        expect(liveTempo(capture, 120, 120)).toBe(120);
    });
});

// A position the forgiving advance moves past was never struck, so it has no moment of its
// own to be early or late at. These drive a whole run through the matcher and the capture
// the way the play surface does, then read the timing the grade and the per-note strip see.

const step = (pitch: number, elapsedMs: number, position: number): MatchStep => ({
    pitches: [pitch],
    pitchStaves: [0],
    pitchHands: ["right"],
    staves: [0],
    whole: position / 4,
    elapsedMs,
    holdMs: 0,
    advancesCursor: true,
    position,
    slackMs: 0,
    pedalled: false,
    bar: 0,
    holdQuarters: 0,
});

// Play every position except `skipped`, each struck at its own notated moment scaled by
// `pace`, with Keep going on; record every cleared position as the surface does.
function playSteady(count: number, gapMs: number, pace: number, skipped: ReadonlySet<number>) {
    const steps = Array.from({ length: count }, (_, at) => step(60 + (at % 12), at * gapMs, at));
    let state = startMatch(steps);
    const capture = startCapture();
    for (const [at, current] of steps.entries()) {
        if (skipped.has(at)) {
            continue;
        }
        const strikeAt = 10_000 + current.elapsedMs * pace;
        const result = matchNote(state, current.pitches[0]!, strikeAt, true, 80);
        state = result.state;
        for (const event of result.events) {
            if (event.kind !== "cleared") {
                continue;
            }
            captureCleared(capture, {
                pitches: event.playedPitches,
                ordinal: event.ordinal,
                timestamp: strikeAt,
                timeMs: event.step.elapsedMs,
                velocity: 80,
                wrongBefore: event.wrongBefore,
                staves: event.step.staves,
                skipped: event.skipped,
            });
        }
    }
    return { notes: capture.notes, missed: state.missed };
}

describe("timing across a forgiving skip", () => {
    it("rates a note struck on its beat after a skipped one as on the beat", () => {
        // Crotchets at 500 ms: 1 and 2 on the beat, 3 never played, 4 exactly on its beat.
        const { notes, missed } = playSteady(4, 500, 1, new Set([2]));
        expect(missed).toBe(1);
        expect(notes).toHaveLength(4);
        const strip = performanceNotes(notes);
        expect(strip[3]?.rating).toBe("perfect");
        expect(strip[3]?.deltaMs).toBeCloseTo(0);
        // The skipped position is still a miss on the strip, and only that.
        expect(strip[2]?.hit).toBe(false);
        const outcome = deriveRunOutcome({
            notes,
            correct: 3,
            wrong: 0,
            imprecise: false,
            intendedTempo: 120,
            runTempo: 120,
        });
        expect(outcome.grade.timing).toBe(100);
        // No zero-length gap reaches the tempo curve, and no drag either.
        expect(outcome.tempoCurve?.points.every((point) => Math.abs(point.bpm - 120) < 1e-6)).toBe(
            true,
        );
        expect(outcome.tempoCurve?.hotspots).toEqual([]);
    });

    it("never moves the timing of the notes that were played, whatever was skipped", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 3, max: 16 }),
                fc.integer({ min: 250, max: 1000 }),
                fc.double({ min: 0.5, max: 2, noNaN: true }),
                fc.array(fc.boolean(), { minLength: 16, maxLength: 16 }),
                (count, gapMs, pace, marks) => {
                    // Keep going looks one position ahead, so it can move past a position
                    // only when the next one is struck: never two in a row, never the last.
                    const skipped = new Set<number>();
                    for (let at = 0; at < count - 1; at++) {
                        if (marks[at] && !skipped.has(at - 1)) {
                            skipped.add(at);
                        }
                    }
                    const { notes } = playSteady(count, gapMs, pace, skipped);
                    const strip = performanceNotes(notes);
                    for (const [at, note] of strip.entries()) {
                        if (!skipped.has(at)) {
                            expect(note.rating).toBe("perfect");
                            expect(Math.abs(note.deltaMs)).toBeLessThan(1e-6);
                        }
                    }
                    const outcome = deriveRunOutcome({
                        notes,
                        correct: count - skipped.size,
                        wrong: 0,
                        imprecise: false,
                        intendedTempo: 120,
                        runTempo: 120,
                    });
                    expect(outcome.grade.timing).toBe(100);
                },
            ),
        );
    });
});
