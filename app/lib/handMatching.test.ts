// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { handsNextPitches, type HandsEvent, initialHandsState, matchHands } from "./handMatching";

// Right hand plays 72 then 74; left hand plays 60 then 64.
const hands = [
    { staff: 0, label: "Right", steps: [{ pitches: [72] }, { pitches: [74] }] },
    { staff: 1, label: "Left", steps: [{ pitches: [60] }, { pitches: [64] }] },
];

function play(steps: typeof hands, notes: number[]) {
    let state = initialHandsState(steps.length);
    const events: HandsEvent[] = [];
    for (const note of notes) {
        const result = matchHands(state, steps, note);
        state = result.state;
        events.push(result.event);
    }
    return { state, events };
}

describe("matchHands", () => {
    it("advances each hand independently", () => {
        const { state, events } = play(hands, [72, 74]);
        expect(events).toEqual([
            { kind: "correct", hand: 0, index: 0, complete: false },
            { kind: "correct", hand: 0, index: 1, complete: false },
        ]);
        expect(state.hands[0].cursor).toBe(2);
        expect(state.hands[1].cursor).toBe(0);
    });

    it("routes each note to the hand expecting it", () => {
        const { events } = play(hands, [60, 72]);
        expect(events[0]).toEqual({ kind: "correct", hand: 1, index: 0, complete: false });
        expect(events[1]).toEqual({ kind: "correct", hand: 0, index: 0, complete: false });
    });

    it("flags a note no hand expects", () => {
        const { events, state } = play(hands, [99]);
        expect(events[0]).toEqual({ kind: "wrong", note: 99 });
        expect(state.wrongNote).toBe(99);
    });

    it("completes only once every hand reaches its end", () => {
        const { events } = play(hands, [72, 74, 60, 64]);
        expect(events.filter((event) => event.kind === "correct" && event.complete)).toHaveLength(
            1,
        );
        expect(events.at(-1)).toEqual({ kind: "correct", hand: 1, index: 1, complete: true });
    });

    it("requires every pitch of a hand's chord before advancing", () => {
        const chord = [
            { staff: 0, label: "Right", steps: [{ pitches: [60, 64] }] },
            { staff: 1, label: "Left", steps: [{ pitches: [36] }] },
        ];
        let state = initialHandsState(2);
        let result = matchHands(state, chord, 60);
        expect(result.event).toEqual({ kind: "progress", hand: 0 });
        state = result.state;
        result = matchHands(state, chord, 64);
        expect(result.event).toEqual({ kind: "correct", hand: 0, index: 0, complete: false });
    });

    it("routes a shared pitch to the nearer hand's register", () => {
        // Both hands expect 50 right now, but their registers differ.
        const overlap = [
            { staff: 0, label: "Right", steps: [{ pitches: [50] }, { pitches: [79] }] },
            { staff: 1, label: "Left", steps: [{ pitches: [50] }, { pitches: [40] }] },
        ];
        const result = matchHands(initialHandsState(2), overlap, 50);
        // register: right ≈ 64.5, left ≈ 45 → 50 is closer to the left hand.
        expect(result.event).toEqual({ kind: "correct", hand: 1, index: 0, complete: false });
    });

    it("degenerates to a single cursor for one hand", () => {
        const solo = [{ staff: 0, label: "Right", steps: [{ pitches: [72] }] }];
        const { events } = play(solo, [72]);
        expect(events[0]).toEqual({ kind: "correct", hand: 0, index: 0, complete: true });
    });

    it("reports the next pitches for every hand", () => {
        const state = play(hands, [72]).state;
        expect(handsNextPitches(state, hands)).toEqual([[74], [60]]);
    });
});
