// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Composition } from "../../core/composition";
import { MAX_TAKES_PER_SONG, type Take } from "../../core/takes";
import { memoryStore } from "../adapters/memoryStore";
import { quotaStore } from "../testing/quotaStore";
import { createTakesStore } from "./takesStore";

// A player's own recordings of a piece. They are the one thing here that cannot be
// recomputed — a run they liked is gone for good if the shelf drops it — and the list
// is capped, so every save is also a decision about what to throw away. The laws are
// over sequences: the cap holds however many arrive, an id appears once, the newest is
// first, and a write the device refuses changes nothing and says so.

const composition = (starts: number[]): Composition => ({
    notes: starts.map((startMs, index) => ({
        pitch: 60 + index,
        startMs,
        durationMs: 200,
        velocity: 90,
    })),
    tempo: 120,
    beatsPerBar: 4,
});

const SONGS = ["fur-elise", "gymnopedie", "prelude"];
const IDS = ["a", "b", "c", "d", "e", "f", "g"];

const arbOps = fc.array(
    fc.oneof(
        {
            weight: 4,
            arbitrary: fc
                .tuple(
                    fc.constantFrom(...SONGS),
                    fc.constantFrom(...IDS),
                    fc.constantFrom("S", "A", "B", "C"),
                )
                .map(([song, id, letter]) => ({ kind: "save" as const, song, id, letter })),
        },
        {
            weight: 1,
            arbitrary: fc
                .tuple(fc.constantFrom(...SONGS), fc.constantFrom(...IDS))
                .map(([song, id]) => ({ kind: "remove" as const, song, id })),
        },
    ),
    { maxLength: 40 },
);

// The list as the shelf should hold it: the take just saved in front, an id kept once,
// and no more than the cap — the oldest falling off the end.
const afterSave = (current: Take[], take: Take): Take[] =>
    [take, ...current.filter((other) => other.id !== take.id)].slice(0, MAX_TAKES_PER_SONG);

describe("the takes shelf, over any run of saves and removals", () => {
    it("keeps the newest takes, each once, and never more than the cap", () => {
        fc.assert(
            fc.property(arbOps, (ops) => {
                const store = createTakesStore(memoryStore());
                const expected = new Map<string, Take[]>();
                let clock = 1;

                for (const op of ops) {
                    const current = expected.get(op.song) ?? [];
                    if (op.kind === "save") {
                        clock += 1;
                        const take: Take = {
                            id: op.id,
                            createdAt: clock,
                            letter: op.letter,
                            complete: true,
                            metrics: null,
                            composition: composition([0, 500, 1000]),
                        };

                        const result = store.save(op.song, take);

                        expect(result.stored).toBe(true);
                        expected.set(op.song, afterSave(current, take));
                        expect(result.takes.map((one) => one.id)).toEqual(
                            (expected.get(op.song) ?? []).map((one) => one.id),
                        );
                    } else {
                        const result = store.remove(op.song, op.id);

                        expect(result.stored).toBe(true);
                        expected.set(
                            op.song,
                            current.filter((one) => one.id !== op.id),
                        );
                        expect(result.takes.map((one) => one.id)).toEqual(
                            (expected.get(op.song) ?? []).map((one) => one.id),
                        );
                    }

                    for (const song of SONGS) {
                        const held = store.list(song);
                        const want = expected.get(song) ?? [];
                        expect(held.map((one) => one.id)).toEqual(want.map((one) => one.id));
                        expect(held.map((one) => one.letter)).toEqual(
                            want.map((one) => one.letter),
                        );
                        expect(held.length).toBeLessThanOrEqual(MAX_TAKES_PER_SONG);
                        expect(new Set(held.map((one) => one.id)).size).toBe(held.length);
                    }
                }

                // The shelf shows every piece that has a recording, most recent first.
                const shelf = store.all();
                expect(shelf.map((entry) => entry.songId)).toEqual(
                    [...expected]
                        .filter(([, takes]) => takes.length > 0)
                        .sort((a, b) => (b[1][0]?.createdAt ?? 0) - (a[1][0]?.createdAt ?? 0))
                        .map(([song]) => song),
                );
                for (const entry of shelf) {
                    expect(entry.takes.length).toBeGreaterThan(0);
                }
            }),
        );
    });

    it("keeps a full device honest: nothing written, nothing claimed", () => {
        fc.assert(
            fc.property(arbOps, fc.integer({ min: 0, max: 3000 }), (ops, capacity) => {
                // A device that runs out partway through, which is what a real one does.
                const store = createTakesStore(quotaStore({}, capacity));
                const expected = new Map<string, Take[]>();
                let clock = 1;

                for (const op of ops) {
                    const current = expected.get(op.song) ?? [];
                    clock += 1;
                    const want =
                        op.kind === "save"
                            ? afterSave(current, {
                                  id: op.id,
                                  createdAt: clock,
                                  letter: op.letter,
                                  complete: true,
                                  metrics: null,
                                  composition: composition([0, 500]),
                              })
                            : current.filter((one) => one.id !== op.id);
                    const result =
                        op.kind === "save"
                            ? store.save(op.song, want[0] as Take)
                            : store.remove(op.song, op.id);

                    if (result.stored) {
                        expected.set(op.song, want);
                    }
                    // Stored or refused, what comes back is what the device really holds
                    // — never an optimistic list the next reload would contradict.
                    expect(result.takes.map((one) => one.id)).toEqual(
                        store.list(op.song).map((one) => one.id),
                    );
                    expect(store.list(op.song).map((one) => one.id)).toEqual(
                        (expected.get(op.song) ?? []).map((one) => one.id),
                    );
                }
            }),
        );
    });

    it("reads a shelf it cannot make sense of as empty rather than crashing", () => {
        fc.assert(
            fc.property(fc.string({ maxLength: 30 }), (junk) => {
                const store = createTakesStore(memoryStore({ "plinky:takes:song": junk }));

                expect(() => store.list("song")).not.toThrow();
                expect(store.list("song")).toEqual([]);
                expect(store.all()).toEqual([]);
            }),
        );
    });
});
