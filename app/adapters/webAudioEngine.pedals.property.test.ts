// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeAudioContext } from "../testing/fakeAudioContext";

afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
});

const engineWith = async (fake: ReturnType<typeof fakeAudioContext>) => {
    // A named function expression, so `new` on it yields the returned fake.
    const FakeContext = function FakeContext() {
        return fake.context as unknown as AudioContext;
    } as unknown as typeof AudioContext;
    vi.stubGlobal("AudioContext", FakeContext);
    vi.resetModules();
    const { webAudioEngine } = await import("./webAudioEngine");
    return webAudioEngine;
};

type Move = { kind: "pedal"; down: boolean } | { kind: "panic" };

const moves: fc.Arbitrary<Move[]> = fc.array(
    fc.oneof(
        fc.boolean().map((down): Move => ({ kind: "pedal", down })),
        fc.constant<Move>({ kind: "panic" }),
    ),
    { maxLength: 12 },
);

describe("the sustain pedal across panics", () => {
    it("is wherever the foot last put it, however many panics came since", async () => {
        const fake = fakeAudioContext();
        const engine = await engineWith(fake);
        engine.resume();
        fc.assert(
            fc.property(moves, (sequence) => {
                // A clean slate: foot up, nothing sounding.
                engine.setPedal("sustain", false);
                engine.allNotesOff();
                for (const move of sequence) {
                    if (move.kind === "pedal") {
                        engine.setPedal("sustain", move.down);
                    } else {
                        engine.allNotesOff();
                    }
                }
                const pedals = sequence.filter((move) => move.kind === "pedal");
                const footDown = pedals.at(-1)?.down ?? false;

                // A note let go of rings on exactly when the pedal is down.
                engine.press(60, 0.3, 90);
                engine.release(60);
                expect(fake.ringingAt(1) > 0).toBe(footDown);
            }),
            { numRuns: 60 },
        );
    });
});
