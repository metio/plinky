// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    type ListenNote,
    type ListenStep,
    listenPerformanceOf,
    performListenNote,
    rollChord,
    shapedByContour,
    spellOutOrnament,
} from "./listenPerformance";
import type { OrnamentKind } from "./ornament";

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
    bpm: fc.integer({ min: 20, max: 300 }),
    stretch: fc.double({ min: 1, max: 3, noNaN: true }),
    soft: fc.boolean(),
    contour: fc.double({ min: 0.5, max: 1, noNaN: true }),
    advancesCursor: fc.boolean(),
    interpretation: fc.double({ min: 0.5, max: 1, noNaN: true }),
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

    it("rolls a chord without lengthening or shortening the position", () => {
        fc.assert(
            fc.property(listenStep, (step) => {
                const rolled = rollChord(step);
                const filled = rolled.reduce((total, one) => total + (one.lengths[0] ?? 0), 0);
                expect(filled).toBeCloseTo(step.lengths[0] ?? 0, 6);
                expect(rolled.flatMap((one) => one.notes.map((note) => note.pitch)).sort()).toEqual(
                    step.notes.map((note) => note.pitch).sort(),
                );
            }),
        );
    });
});
