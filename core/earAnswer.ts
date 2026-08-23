// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How one answerable option reads once a round has been answered — a decision about what
// the player is shown, taken away from the surfaces that draw it so each surface only
// draws.

export type OptionVerdict = "correct" | "wrong" | null;

// Green on what was right, red on what the player actually chose, and nothing at all on
// the rest. The last part is the one worth pinning: an unanswered round marks nothing,
// and a settled one never reddens an option nobody picked — a wall of red for every
// wrong answer would tell the player things they did not get wrong.
export function optionVerdict<Id>(option: Id, answer: Id | null, given: Id | null): OptionVerdict {
    if (answer === null) {
        return null;
    }
    if (option === answer) {
        return "correct";
    }
    return option === given ? "wrong" : null;
}
