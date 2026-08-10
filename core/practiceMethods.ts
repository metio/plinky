// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

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
    // Where in Plinky to do it. A route the player can follow straight from the
    // page, so reading about a method and trying it are one step apart.
    href: string;
};

export const METHODS: PracticeMethod[] = [
    { id: "chunking", minutes: 10, href: "/library/" },
    { id: "slow", minutes: 10, href: "/library/" },
    { id: "handsApart", minutes: 10, href: "/library/" },
    { id: "hearingFirst", minutes: 5, href: "/ear/" },
    { id: "interleaving", minutes: 15, href: "/review/" },
    { id: "spacing", minutes: 10, href: "/you/" },
];

export function methodById(id: string): PracticeMethod | null {
    return METHODS.find((method) => method.id === id) ?? null;
}

// The methods that fit in the time available, shortest first. A player with ten
// minutes should not be handed the fifteen-minute one and told to hurry.
export function methodsWithin(minutes: number): PracticeMethod[] {
    return METHODS.filter((method) => method.minutes <= minutes).sort(
        (left, right) => left.minutes - right.minutes,
    );
}
