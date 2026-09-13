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
    | "spacing"
    | "chords";

export type PracticeMethod = {
    id: MethodId;
    // The white key of the front page's keyboard that opens this method. Kept here rather
    // than in the component so the seven keys and the seven methods are one list that
    // somebody can read top to bottom as C, D, E, F, G, A, B.
    key: number;
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
    // A generated exercise to open instead of a piece: the method IS the exercise.
    tile?: string;
};

// The front page's keyboard: one octave from middle C, seven white keys for seven methods.
export const HOME_OCTAVE = { from: 60, to: 71 } as const;

// Where on the front page that keyboard sits, for a link sending somebody to the methods.
export const METHODS_ANCHOR = "ways-to-practise";

export const METHODS: PracticeMethod[] = [
    // Bars 1 to 4 rather than "the hard part": nothing here knows which bars are hard, and
    // opening the loop over the first phrase at least starts you inside the control, with
    // the bars adjustable from the bar itself.
    { id: "chunking", key: 60, minutes: 10, opens: { loop: { from: 1, to: 4 } } },
    // Sixty per cent: slow enough that the notes have time to be chosen, fast enough that
    // the piece is still a piece.
    { id: "slow", key: 62, minutes: 10, opens: { speed: 0.6 } },
    { id: "handsApart", key: 64, minutes: 10, opens: { hands: "left" } },
    // Its own words are "listen to the phrase, then turn the noteheads blank and find it
    // by ear" — which is the hidden-notes switch on a piece, not the interval drill. It
    // opens the piece plain; the switch is on the surface it opens.
    { id: "hearingFirst", key: 65, minutes: 5, opens: {} },
    // These two are not about one piece. Mixing them up IS the review session, and coming
    // back later is the queue deciding when — so both point at the page that does it
    // rather than at a piece chosen at random, which would be the opposite of the method.
    { id: "interleaving", key: 67, minutes: 15, route: "/review" },
    { id: "spacing", key: 69, minutes: 10, route: "/review" },
    // The chords of a key as blocks, learned once rather than note by note in every piece
    // in that key. C major first: the shape is the lesson, and the key dial on the
    // exercise's own page reaches the other twenty-three.
    { id: "chords", key: 71, minutes: 5, tile: "chords-c-major" },
];

// The method a key opens, or nothing for a black key and for any key outside the octave.
// The pitch itself rather than its name in any octave: a MIDI piano's other Cs light no key
// on the drawn octave, and a method opening under a key that stayed dark would not say why.
export function methodOnKey(note: number): PracticeMethod | undefined {
    return METHODS.find((method) => method.key === note);
}
