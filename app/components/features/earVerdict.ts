// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// How an answered ear-training round reads, in one place.
//
// The four exercises answer four different questions — which note, which interval,
// which chord, which progression — and each draws its own answer surface: a keyboard,
// a ladder, a grid, a row of slots. What must not differ is the verdict. Green is what
// played, red is the miss, and once the round is settled the options nobody chose
// recede. A player moving between exercises reads the colour, not the shape, so the
// colour has to mean the same thing everywhere.
//
// It was the same four class strings copied into four files, which is the arrangement
// where they drift: one of them picks up a tweak, nothing fails, and the exercises
// quietly stop agreeing.

export type Verdict = "correct" | "wrong" | null;

// A verdict on a surface that draws its own border — every answer surface except the
// black keys, which have none.
export const VERDICT_BOX: Record<NonNullable<Verdict>, string> = {
    correct: "border-success-solid bg-success-solid text-white",
    wrong: "border-danger-solid bg-danger-solid text-white",
};

// The same verdict as fill alone, for a surface already dark enough to need no edge.
export const VERDICT_FILL: Record<NonNullable<Verdict>, string> = {
    correct: "bg-success-solid text-white",
    wrong: "bg-danger-solid text-white",
};

// A settled round's unchosen options: still legible, no longer asking to be pressed.
const RECEDED = "border-line bg-raised text-faint";

// Waiting to be pressed, on a card surface.
const IDLE =
    "border-line-strong bg-raised text-ink hover:border-accent-solid hover:text-accent-strong";

// One answerable option. `receded` is the settled round's also-rans; `idle` differs
// only where the surface is a piano key rather than a card, so it defaults to the card.
export function answerClasses(verdict: Verdict, receded: boolean, idle: string = IDLE): string {
    if (verdict !== null) {
        return VERDICT_BOX[verdict];
    }
    return receded ? RECEDED : idle;
}
