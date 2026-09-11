// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    type ListenNote,
    listenPerformanceOf,
    type ListenStep,
    performListenNote,
    performListenStep,
    rollChord,
    shapedByContour,
    spellOutOrnament,
} from "./listenPerformance";
import type { OrnamentKind } from "./ornament";
import { listenStepMs, MIN_STEP_MS } from "./playback";
import { quartersMs } from "./elapsed";

const pitches = fc.integer({ min: 21, max: 108 });

const listenNote: fc.Arbitrary<ListenNote> = fc.record({
    pitch: pitches,
    soundQuarters: fc.double({ min: 0.05, max: 8, noNaN: true }),
    pedalled: fc.boolean(),
    articulation: fc.constantFrom("none", "detachedLegato", "tenuto", "staccato", "staccatissimo"),
    accent: fc.boolean(),
    marcato: fc.boolean(),
    slurred: fc.boolean(),
    hand: fc.constantFrom("left", "right"),
});

const listenStep: fc.Arbitrary<ListenStep> = fc.record({
    notes: fc.uniqueArray(listenNote, { maxLength: 5, selector: (one) => one.pitch }),
    dynamicVolume: fc.option(fc.integer({ min: 1, max: 127 }), { nil: null }),
    lengths: fc.array(fc.double({ min: 0.05, max: 8, noNaN: true }), {
        minLength: 1,
        maxLength: 4,
    }),
    whole: fc.double({ min: 0, max: 100, noNaN: true }),
    measureIndex: fc.nat({ max: 200 }),
    position: fc.nat({ max: 2000 }),
    bpm: fc.integer({ min: 20, max: 300 }),
    stretch: fc.double({ min: 1, max: 3, noNaN: true }),
    soft: fc.boolean(),
    contour: fc.double({ min: 0.5, max: 1, noNaN: true }),
    advancesCursor: fc.boolean(),
    interpretation: fc.double({ min: 0.5, max: 1, noNaN: true }),
    phrase: fc.double({ min: 0, max: 1, noNaN: true }),
});

describe("the listening performance, whatever the page says", () => {
    it("never strikes a key before the one before it", () => {
        fc.assert(
            fc.property(
                fc.array(listenStep, { maxLength: 30 }),
                fc.integer({ min: 20, max: 300 }),
                (steps, startBpm) => {
                    const onsets = listenPerformanceOf(steps, { startBpm }).map(
                        (one) => one.startMs,
                    );
                    for (const [index, onset] of onsets.entries()) {
                        expect(onset).toBeGreaterThanOrEqual(onsets[index - 1] ?? 0);
                    }
                },
            ),
        );
    });

    it("strikes every note of a position within the position, touch or no touch", () => {
        fc.assert(
            fc.property(
                fc.array(listenStep, { minLength: 1, maxLength: 20 }),
                fc.integer({ min: 20, max: 300 }),
                fc.boolean(),
                (steps, tempo, shaped) => {
                    for (const index of steps.keys()) {
                        const { played, advanceMs } = performListenStep(
                            steps,
                            index,
                            tempo,
                            shaped,
                        );
                        for (const one of played) {
                            expect(one.delayMs).toBeGreaterThanOrEqual(0);
                            expect(one.delayMs).toBeLessThanOrEqual(Math.max(0, advanceMs / 2));
                            expect(one.voiced).toBeGreaterThanOrEqual(1);
                            expect(one.voiced).toBeLessThanOrEqual(127);
                        }
                    }
                },
            ),
        );
    });

    it("gives every note a real length, a playable touch and a finger", () => {
        fc.assert(
            fc.property(
                fc.array(listenStep, { maxLength: 20 }),
                fc.integer({ min: 20, max: 300 }),
                (steps, startBpm) => {
                    for (const played of listenPerformanceOf(steps, { startBpm })) {
                        expect(played.durationMs).toBeGreaterThan(0);
                        expect(played.velocity).toBeGreaterThanOrEqual(1);
                        expect(played.velocity).toBeLessThanOrEqual(127);
                        expect(Number.isInteger(played.velocity)).toBe(true);
                        expect(played.finger).toBeGreaterThanOrEqual(1);
                        expect(played.finger).toBeLessThanOrEqual(5);
                    }
                },
            ),
        );
    });

    it("keeps a clip inside the window it was asked for", () => {
        fc.assert(
            fc.property(
                fc.array(listenStep, { maxLength: 30 }),
                fc.integer({ min: 20, max: 300 }),
                fc.integer({ min: 1, max: 20_000 }),
                (steps, startBpm, withinMs) => {
                    const clip = listenPerformanceOf(steps, { startBpm, withinMs });
                    const whole = listenPerformanceOf(steps, { startBpm });
                    expect(clip.length).toBeLessThanOrEqual(whole.length);
                    expect(clip).toEqual(whole.slice(0, clip.length));
                },
            ),
        );
    });

    it("never lifts a note above what the page asked of it", () => {
        fc.assert(
            fc.property(listenStep, fc.integer({ min: 20, max: 300 }), (step, tempo) => {
                for (const note of step.notes) {
                    const { velocity, voiced } = performListenNote(step, note, tempo);
                    expect(voiced).toBeGreaterThanOrEqual(1);
                    expect(voiced).toBeLessThanOrEqual(Math.max(1, velocity));
                }
            }),
        );
    });

    it("shapes a line without ever asking for more than it is written at", () => {
        fc.assert(
            fc.property(fc.array(listenStep, { maxLength: 40 }), (steps) => {
                for (const shaped of shapedByContour(steps)) {
                    expect(shaped.contour).toBeGreaterThan(0);
                    expect(shaped.contour).toBeLessThanOrEqual(1);
                }
            }),
        );
    });

    it("spells an ornament out into exactly the written length", () => {
        const kinds = fc.constantFrom<OrnamentKind>(
            "trill",
            "mordent",
            "inverted-mordent",
            "turn",
            "inverted-turn",
        );
        fc.assert(
            fc.property(
                listenStep.filter((step) => step.notes.length > 0),
                kinds,
                fc.integer({ min: -7, max: 7 }),
                (step, kind, fifths) => {
                    const figure = spellOutOrnament(step, kind, fifths);
                    const written = step.lengths[0] ?? step.notes[0]!.soundQuarters;
                    const filled = figure.reduce((total, one) => total + (one.lengths[0] ?? 0), 0);
                    expect(filled).toBeCloseTo(written, 6);
                    // The cursor stays on the note the sign is printed over until the figure
                    // ends, so the page and the ear part company nowhere else.
                    expect(figure.filter((one) => one.advancesCursor).length).toBe(
                        step.advancesCursor ? 1 : 0,
                    );
                },
            ),
        );
    });

    // The written onsets are what a graded run and Keep up count against, so Listen may
    // not drift from them: however a position is spelled out, and at any tempo, its
    // sub-steps hold exactly as long as the position struck plainly.
    it("holds a rolled chord exactly as long as the same chord struck together", () => {
        fc.assert(
            fc.property(
                listenStep.filter((step) => step.notes.length > 1),
                fc.integer({ min: 20, max: 400 }),
                fc.boolean(),
                (plain, tempo, shaped) => {
                    // A position after it in a later bar, so the last bar's broadening
                    // reads the same for the chord whether it is rolled or not.
                    const after = { ...plain, measureIndex: plain.measureIndex + 1, position: -1 };
                    const rolled = rollChord({ ...plain, advancesCursor: true });
                    const split = [...rolled, after];
                    const held = rolled.reduce(
                        (sum, _, index) =>
                            sum + performListenStep(split, index, tempo, shaped).advanceMs,
                        0,
                    );
                    const struck = performListenStep(
                        [{ ...plain, advancesCursor: true }, after],
                        0,
                        tempo,
                        shaped,
                    ).advanceMs;
                    expect(held).toBeCloseTo(struck, 6);
                },
            ),
        );
    });

    it("holds a rolled chord in the last bar exactly as long as the same chord struck", () => {
        // The last bar broadens as it goes, and a position spelled out into sub-steps is
        // still one place in that bar: every sub-step takes the broadening of the chord.
        fc.assert(
            fc.property(
                listenStep.filter((step) => step.notes.length > 1),
                fc.integer({ min: 20, max: 400 }),
                (plain, tempo) => {
                    const rolled = rollChord({ ...plain, advancesCursor: true });
                    const held = rolled.reduce(
                        (sum, _, index) =>
                            sum + performListenStep(rolled, index, tempo, true).advanceMs,
                        0,
                    );
                    const struck = performListenStep(
                        [{ ...plain, advancesCursor: true }],
                        0,
                        tempo,
                        true,
                    ).advanceMs;
                    expect(held).toBeCloseTo(struck, 6);
                },
            ),
        );
    });

    it("holds any position's sub-steps for their written time together, never less than zero", () => {
        fc.assert(
            fc.property(
                fc.array(fc.double({ min: 0, max: 2, noNaN: true }), {
                    minLength: 2,
                    maxLength: 12,
                }),
                fc.integer({ min: 20, max: 400 }),
                fc.double({ min: 1, max: 3, noNaN: true }),
                (lengths, tempo, stretch) => {
                    const split: ListenStep[] = lengths.map((length, index) => ({
                        notes: [],
                        dynamicVolume: null,
                        lengths: [length],
                        whole: 0,
                        measureIndex: 0,
                        position: 7,
                        bpm: tempo,
                        stretch,
                        soft: false,
                        contour: 1,
                        advancesCursor: index === lengths.length - 1,
                        interpretation: 1,
                        phrase: 0,
                    }));
                    const held = split.map(
                        (_, index) => performListenStep(split, index, tempo, false).advanceMs,
                    );
                    const written = lengths.reduce(
                        (sum, length) => sum + length * quartersMs(1, tempo) * stretch,
                        0,
                    );
                    const total = held.reduce((sum, ms) => sum + ms, 0);
                    expect(total).toBeCloseTo(Math.max(MIN_STEP_MS, written), 6);
                    for (const ms of held) {
                        expect(ms).toBeGreaterThanOrEqual(0);
                    }
                    // Where no sub-step is short of the floor, each keeps its own length.
                    if (
                        lengths.every(
                            (length) => listenStepMs([length], tempo, stretch) > MIN_STEP_MS,
                        )
                    ) {
                        for (const [index, length] of lengths.entries()) {
                            expect(held[index]).toBeCloseTo(
                                listenStepMs([length], tempo, stretch),
                                9,
                            );
                        }
                    }
                },
            ),
        );
    });

    it("rolls a chord without lengthening or shortening the position", () => {
        fc.assert(
            fc.property(listenStep, (step) => {
                const rolled = rollChord(step);
                // A chord of one note is nothing to roll and comes back untouched; a rolled one
                // fits inside the position's advance, which ends with its shortest note,
                // whichever staff that note is on.
                if (rolled.length > 1) {
                    const filled = rolled.reduce((total, one) => total + (one.lengths[0] ?? 0), 0);
                    expect(filled).toBeCloseTo(Math.min(...step.lengths), 6);
                } else {
                    expect(rolled[0]).toBe(step);
                }
                expect(rolled.flatMap((one) => one.notes.map((note) => note.pitch)).sort()).toEqual(
                    step.notes.map((note) => note.pitch).sort(),
                );
            }),
        );
    });
});
