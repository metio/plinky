// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How one answerable option reads once a round has been answered, and where a rung sits
// on the interval ladder. Both are decisions about what the player is shown, taken away
// from the surfaces that draw them so each surface only draws.

import { type IntervalId, SEMITONES_PER_OCTAVE, semitonesOf } from "./theory";

export type OptionVerdict = "correct" | "wrong" | null;

// Green on what was right, red on what the player actually chose, and nothing at all on
// the rest. The last part is the one worth pinning: an unanswered round marks nothing,
// and a settled one never reddens an option nobody picked — a wall of red for every
// wrong answer would tell the player things they did not get wrong.
export function optionVerdict<Id>(
    option: Id,
    answer: Id | null,
    given: Id | null,
): OptionVerdict {
    if (answer === null) {
        return null;
    }
    if (option === answer) {
        return "correct";
    }
    return option === given ? "wrong" : null;
}

// Where a rung sits on the ladder, as a percentage of its height: an octave is the whole
// ladder, a fifth is seven twelfths of it. The conceit of the ladder is that the rungs
// sit at the distance they name, so this is the feature rather than a layout detail.
export function ladderOffset(interval: IntervalId): number {
    return (semitonesOf(interval) / SEMITONES_PER_OCTAVE) * 100;
}
