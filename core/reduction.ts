// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The names of the reductions, and nothing else.
//
// Held apart from the transform that performs them because a stored preference has to name
// one, and naming a thing should not drag in the machinery that does it: core/simplify
// reads pitches, which reaches core/notes, which reads a preference — so putting the names
// beside the transform made the preference import itself in a circle.

// How much is taken out. Each level is a superset of the one before it.
export type Reduction =
    // At most two notes a hand at once, the outer ones — the tune on top and the bass under
    // it, with the filling gone. The shape of the harmony survives.
    | "thinned"
    // One note a hand: the melody and the bass line alone. Everything is still in both
    // hands, so the piece still reads as itself.
    | "outlined"
    // The melody alone, the other hand resting. The last resort, and the first thing a
    // beginner can actually play.
    | "melody";

export const REDUCTIONS: readonly Reduction[] = ["thinned", "outlined", "melody"];
