// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createActivitySignal, holdWhile } from "./activity";

// The signal that holds a service-worker reload while the player is mid-run. What it
// gets wrong is arithmetic: an end called twice, or a cleanup that runs after its
// component already unmounted, drives the count below zero and the app reads as idle
// while a run is going — which is a reload over an unfinished take. So the laws are
// counting laws, over any interleaving of begins and ends.

type Step = { begin: true } | { end: number } | { endAgain: number };

const arbSteps = fc.array(
    fc.oneof(
        { weight: 3, arbitrary: fc.constant<Step>({ begin: true }) },
        { weight: 2, arbitrary: fc.nat({ max: 8 }).map((end) => ({ end })) },
        { weight: 1, arbitrary: fc.nat({ max: 8 }).map((endAgain) => ({ endAgain })) },
    ),
    { maxLength: 30 },
);

describe("the in-progress signal, under any interleaving", () => {
    it("is active exactly while something it was told about is unfinished", () => {
        fc.assert(
            fc.property(arbSteps, (steps) => {
                const signal = createActivitySignal();
                const open: Array<() => void> = [];
                const spent: Array<() => void> = [];
                let flips = 0;
                let edges = 0;
                signal.subscribe(() => {
                    flips += 1;
                });

                for (const step of steps) {
                    const wasActive = signal.active();
                    if ("begin" in step) {
                        open.push(signal.begin());
                    } else if ("end" in step && open.length > 0) {
                        const [end] = open.splice(step.end % open.length, 1) as [() => void];
                        end();
                        spent.push(end);
                    } else if ("endAgain" in step && spent.length > 0) {
                        // A cleanup that runs twice releases once: the second call is
                        // the one that would make the app read as idle mid-run.
                        (spent[step.endAgain % spent.length] as () => void)();
                    }

                    expect(signal.active()).toBe(open.length > 0);
                    if (wasActive === signal.active()) {
                        // A count that moves without changing the answer is nobody's
                        // business — only the edges are.
                        expect(flips).toBe(edges);
                    } else {
                        edges += 1;
                        expect(flips).toBe(edges);
                    }
                }

                for (const end of open) {
                    end();
                }
                expect(signal.active()).toBe(false);
            }),
        );
    });

    it("stops telling a subscriber that let go", () => {
        fc.assert(
            fc.property(fc.nat({ max: 5 }), (rounds) => {
                const signal = createActivitySignal();
                let heard = 0;
                const off = signal.subscribe(() => {
                    heard += 1;
                });
                signal.begin()();
                expect(heard).toBe(2);

                off();
                for (let round = 0; round < rounds; round += 1) {
                    signal.begin()();
                }

                expect(heard).toBe(2);
            }),
        );
    });
});

describe("holding the signal for the length of a job", () => {
    it("holds while it runs and lets go however it ends", async () => {
        await fc.assert(
            fc.asyncProperty(fc.boolean(), fc.boolean(), async (fails, sync) => {
                const signal = createActivitySignal();
                const work = () => {
                    expect(signal.active()).toBe(true);
                    if (fails && sync) {
                        // A throw before the first await must not leave the app busy for
                        // the rest of the session.
                        throw new Error("no encoder");
                    }
                    return fails ? Promise.reject(new Error("no encoder")) : Promise.resolve(7);
                };

                if (fails) {
                    await expect(holdWhile(signal, work)).rejects.toThrow("no encoder");
                } else {
                    await expect(holdWhile(signal, work)).resolves.toBe(7);
                }

                expect(signal.active()).toBe(false);
            }),
        );
    });

    it("stays held while several jobs overlap", async () => {
        const signal = createActivitySignal();
        let releaseFirst = () => {};
        const first = holdWhile(
            signal,
            () =>
                new Promise<void>((done) => {
                    releaseFirst = done;
                }),
        );
        let releaseSecond = () => {};
        const second = holdWhile(
            signal,
            () =>
                new Promise<void>((done) => {
                    releaseSecond = done;
                }),
        );

        releaseFirst();
        await first;

        expect(signal.active()).toBe(true);
        releaseSecond();
        await second;
        expect(signal.active()).toBe(false);
    });
});
