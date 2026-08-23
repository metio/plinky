// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type PlayOptions, playOptionsQuery, readPlayOptions } from "./playOptions";

const from = (query: string) => {
    const params = new URLSearchParams(query);
    return readPlayOptions((key) => params.get(key));
};

describe("readPlayOptions", () => {
    it("asks for nothing when the link says nothing", () => {
        expect(from("")).toEqual({});
    });

    it("reads a full request", () => {
        expect(from("speed=0.6&hands=left&transpose=-3&loop=5-8")).toEqual({
            speed: 0.6,
            hands: "left",
            transpose: -3,
            loop: { from: 5, to: 8 },
        });
    });

    it("holds speed inside the range a person could practise at", () => {
        expect(from("speed=100").speed).toBe(2);
        expect(from("speed=0.01").speed).toBe(0.25);
    });

    it("refuses a speed of zero rather than clamping it up to a quarter", () => {
        // Zero is silence, not slowness — nobody who wrote it meant the minimum.
        expect(from("speed=0").speed).toBeUndefined();
        expect(from("speed=-1").speed).toBeUndefined();
    });

    it("ignores a hand it does not have", () => {
        expect(from("hands=third").hands).toBeUndefined();
        expect(from("hands=LEFT").hands).toBeUndefined();
    });

    it("keeps transpose whole and within the control's own reach", () => {
        expect(from("transpose=99").transpose).toBe(12);
        expect(from("transpose=-99").transpose).toBe(-12);
        expect(from("transpose=1.5").transpose).toBeUndefined();
    });

    it("ignores what it does not honour, so a stale link still opens the piece", () => {
        // The metronome and blank noteheads are saved preferences, deliberately not
        // reachable from a link.
        expect(from("metronome=1&blank=1&nonsense=x")).toEqual({});
    });

    it("reads a single bar as a loop of one", () => {
        expect(from("loop=7").loop).toEqual({ from: 7, to: 7 });
    });

    it("reads a backwards range the way it was meant", () => {
        expect(from("loop=8-5").loop).toEqual({ from: 5, to: 8 });
    });

    it("drops a loop that could not be bars", () => {
        expect(from("loop=0-4").loop).toBeUndefined();
        expect(from("loop=2.5-4").loop).toBeUndefined();
        expect(from("loop=1-2-3").loop).toBeUndefined();
        expect(from("loop=bars").loop).toBeUndefined();
    });

    it("never throws on whatever a chat client did to the link", () => {
        fc.assert(
            fc.property(fc.string(), fc.string(), (key, value) => {
                const params = new URLSearchParams();
                params.set(key, value);
                expect(() => readPlayOptions((k) => params.get(k))).not.toThrow();
            }),
        );
    });
});

describe("playOptionsQuery", () => {
    it("writes nothing for a request that asks for nothing", () => {
        expect(playOptionsQuery({})).toBe("");
    });

    it("names only the fields that were asked for", () => {
        expect(playOptionsQuery({ speed: 0.6, hands: "left" })).toBe("?speed=0.6&hands=left");
    });

    it("survives a round trip", () => {
        const options: PlayOptions = {
            speed: 0.75,
            hands: "right",
            transpose: 2,
            loop: { from: 3, to: 9 },
        };
        expect(from(playOptionsQuery(options))).toEqual(options);
    });

    it("round-trips anything the reader would accept", () => {
        fc.assert(
            fc.property(
                fc.record(
                    {
                        speed: fc.double({ min: 0.25, max: 2, noNaN: true }),
                        hands: fc.constantFrom("both" as const, "left" as const, "right" as const),
                        transpose: fc.integer({ min: -12, max: 12 }),
                        loop: fc
                            .tuple(
                                fc.integer({ min: 1, max: 400 }),
                                fc.integer({ min: 1, max: 400 }),
                            )
                            .map(([a, b]) => ({ from: Math.min(a, b), to: Math.max(a, b) })),
                    },
                    { requiredKeys: [] },
                ),
                (options) => {
                    expect(from(playOptionsQuery(options))).toEqual(options);
                },
            ),
        );
    });
});
