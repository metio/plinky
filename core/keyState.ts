// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a key on the on-screen keyboard is currently saying.
//
// The order is the whole of it, and it is a musical judgement rather than a styling one:
//
//   wrong  — the flash after a miss, which must outrank everything or the player cannot
//            see what they got wrong
//   held   — the player is holding this key down
//   left / right — the app is demonstrating this note, with the hand that plays it, which
//            is what Listen shows. "held" beats this on purpose: the player's own hands
//            are the more urgent fact on the instrument in front of them
//   next   — the score is asking for this note
//   rest   — nothing to say
//
// Written once because the keyboard drew it three times — the white fill, the black fill,
// and the black key's label colour — and three copies of a priority order is three chances
// for one of them to start disagreeing about which state wins.

export type KeyState = "wrong" | "held" | "left" | "right" | "next" | "rest";

export type KeyStateInput = {
    // The note flashing red after a miss, if any.
    flash: number | null;
    // Keys the player is holding down.
    lit: ReadonlySet<number>;
    // Notes the app itself is sounding, each with the hand that plays it.
    sounding: ReadonlyMap<number, "left" | "right">;
    // Notes the score is asking for next.
    expected: readonly number[];
};

export function keyState(note: number, input: KeyStateInput): KeyState {
    if (input.flash === note) {
        return "wrong";
    }
    if (input.lit.has(note)) {
        return "held";
    }
    const hand = input.sounding.get(note);
    if (hand) {
        return hand;
    }
    return input.expected.includes(note) ? "next" : "rest";
}
