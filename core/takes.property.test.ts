// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    beginHold,
    endHold,
    fastestTakeOnsets,
    ghostOnsets,
    type Take,
    takeFromStored,
    takeToStored,
} from "./takes";

// A player's saved recordings: what they are stored as, what comes back, and which one
// the ghost races. A take that does not survive the round trip is a performance lost,
// and the shape on disk is untrusted — it is whatever is in the browser's storage,
// which may be from an older version or simply wrong.

const arbNote = fc
    .tuple(
        fc.integer({ min: 21, max: 108 }),
        fc.integer({ min: 0, max: 60_000 }),
        fc.integer({ min: 1, max: 4000 }),
        fc.integer({ min: 1, max: 127 }),
    )
    .map(([pitch, startMs, durationMs, velocity]) => ({ pitch, startMs, durationMs, velocity }));

const arbTake: fc.Arbitrary<Take> = fc
    .tuple(
        fc.string({ minLength: 1, maxLength: 12 }),
        fc.integer({ min: 0, max: 2 ** 40 }),
        fc.constantFrom("S", "A", "B", "C", "D", "E", "F", ""),
        fc.boolean(),
        fc.array(arbNote, { maxLength: 8 }),
        fc.integer({ min: 40, max: 240 }),
        fc.constantFrom(2, 3, 4, 6),
    )
    .map(([id, createdAt, letter, complete, notes, tempo, beatsPerBar]) => ({
        id,
        createdAt,
        letter,
        complete,
        metrics: null,
        composition: {
            notes: [...notes].sort((a, b) => a.startMs - b.startMs),
            tempo,
            beatsPerBar,
        },
    }));

describe("takes, stored and read back", () => {
    it("comes back as it went in", () => {
        fc.assert(
            fc.property(arbTake, (take) => {
                const back = takeFromStored(takeToStored(take));

                expect(back).not.toBeNull();
                expect(back?.id).toBe(take.id);
                expect(back?.createdAt).toBe(take.createdAt);
                expect(back?.letter).toBe(take.letter);
                expect(back?.complete).toBe(take.complete);
                expect(back?.composition.notes.map((note) => note.pitch)).toEqual(
                    take.composition.notes.map((note) => note.pitch),
                );
                expect(back?.composition.notes.map((note) => note.startMs)).toEqual(
                    take.composition.notes.map((note) => note.startMs),
                );
            }),
        );
    });

    it("reads anything else as no take rather than failing the load", () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.anything(),
                    fc.record({ id: fc.string(), code: fc.string() }),
                    fc.record({ id: fc.integer(), code: fc.integer() }),
                ),
                (entry) => {
                    expect(() => takeFromStored(entry)).not.toThrow();
                },
            ),
        );
    });

    it("races the take that played it quickest, and nothing when none is complete", () => {
        fc.assert(
            fc.property(fc.array(arbTake, { maxLength: 5 }), (takes) => {
                const onsets = fastestTakeOnsets(takes);
                const complete = takes.filter(
                    (take) => take.complete && take.composition.notes.length > 0,
                );

                if (complete.length === 0) {
                    expect(onsets).toBeNull();
                    return;
                }
                const span = (take: Take) => {
                    const notes = take.composition.notes;
                    return notes[notes.length - 1]!.startMs - notes[0]!.startMs;
                };
                const quickest = Math.min(...complete.map(span));
                // Whichever take it picked, no complete take was quicker.
                expect(onsets).toEqual(
                    ghostOnsets(complete.find((take) => span(take) === quickest)!),
                );
            }),
        );
    });
});

describe("a key held while a run is recorded", () => {
    it("gives back the note it belongs to and how long it was down", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 21, max: 108 }),
                fc.nat({ max: 20 }),
                fc.integer({ min: 0, max: 10_000 }),
                fc.integer({ min: 0, max: 10_000 }),
                (pitch, index, onMs, extra) => {
                    const holds = new Map();

                    beginHold(holds, pitch, index, onMs);
                    const released = endHold(holds, pitch, onMs + extra);

                    expect(released).toEqual({ index, heldMs: extra });
                    // A key can only come up once: what follows belongs to no note.
                    expect(endHold(holds, pitch, onMs + extra)).toBeNull();
                    expect(holds.size).toBe(0);
                },
            ),
        );
    });

    it("gives back nothing for a key that was never down", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 21, max: 108 }),
                fc.integer({ min: 0, max: 9999 }),
                (pitch, at) => {
                    expect(endHold(new Map(), pitch, at)).toBeNull();
                },
            ),
        );
    });
});
