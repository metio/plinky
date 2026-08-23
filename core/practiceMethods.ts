// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Ways to practise, each tied to the control in Plinky that performs it.
//
// Plinky already has the machinery for every one of these — a bar-range loop, a
// tempo dial, one-hand practice, blanked noteheads, a review queue — but they read
// as features rather than as methods, so a player who has never been taught how to
// practise does not know which one to reach for or why. Naming the method and
// pointing it at the control is the whole point of the page: it makes what is
// already there legible.
//
// Ids only, no words: the labels live in the message catalogue like the theory
// exercise names do, so this stays translatable without translating anything here.

import type { PlayOptions } from "./playOptions";

export type MethodId =
    | "chunking"
    | "slow"
    | "handsApart"
    | "hearingFirst"
    | "interleaving"
    | "spacing";

export type PracticeMethod = {
    id: MethodId;
    // Roughly how long one go at it takes, in minutes — the "dose" that turns a
    // method from an idea into something that fits in tonight's practice.
    minutes: number;
    // How a piece opens when the method's own button is pressed, so the suggestion hands
    // over the control that does the thing rather than describing where to find it.
    // Absent where the method is not about one piece at all: mixing pieces up and coming
    // back to something later are answered by the review queue, which has its own page.
    opens?: PlayOptions;
    // Where the button goes when the method is not a piece to open.
    route?: string;
};

export const METHODS: PracticeMethod[] = [
    // Bars 1 to 4 rather than "the hard part": nothing here knows which bars are hard, and
    // opening the loop over the first phrase at least starts you inside the control, with
    // the bars adjustable from the bar itself.
    { id: "chunking", minutes: 10, opens: { loop: { from: 1, to: 4 } } },
    // Sixty per cent: slow enough that the notes have time to be chosen, fast enough that
    // the piece is still a piece.
    { id: "slow", minutes: 10, opens: { speed: 0.6 } },
    { id: "handsApart", minutes: 10, opens: { hands: "left" } },
    // Its own words are "listen to the phrase, then turn the noteheads blank and find it
    // by ear" — which is the hidden-notes switch on a piece, not the interval drill. It
    // opens the piece plain; the switch is on the surface it opens.
    { id: "hearingFirst", minutes: 5, opens: {} },
    // These two are not about one piece. Mixing them up IS the review session, and coming
    // back later is the queue deciding when — so both point at the page that does it
    // rather than at a piece chosen at random, which would be the opposite of the method.
    { id: "interleaving", minutes: 15, route: "/review" },
    { id: "spacing", minutes: 10, route: "/review" },
];
