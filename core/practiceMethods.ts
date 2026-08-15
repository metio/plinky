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
};

export const METHODS: PracticeMethod[] = [
    { id: "chunking", minutes: 10 },
    { id: "slow", minutes: 10 },
    { id: "handsApart", minutes: 10 },
    // Its own words are "listen to the phrase, then turn the noteheads blank and find it
    // by ear" — which is the hidden-notes switch on a piece, not the interval drill.
    { id: "hearingFirst", minutes: 5 },
    { id: "interleaving", minutes: 15 },
    { id: "spacing", minutes: 10 },
];
