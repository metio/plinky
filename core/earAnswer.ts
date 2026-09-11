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

// The seven diatonic numerals, lowercased, in degree order: index + 1 is the degree.
const NUMERALS = ["i", "ii", "iii", "iv", "v", "vi", "vii"];

// A Roman numeral and whatever quality marks follow it (°, ø, +, a figure). Anything with a
// letter after the numeral is a different chord, and anything before it — a flat, a sharp —
// names a degree outside the key, so neither is read as a numeral at all.
const NUMERAL = /^([iv]+)[^a-z]*$/i;

// The number key that answers with this option, or null when none does. A plain scale
// degree is its own digit. A Roman numeral takes the digit of the degree it stands on, so
// IV is 4 and vii° is 7, whatever its case or quality mark says. A chromatic degree (♭3, ♯4)
// has no digit: 3 has to mean the third the level plainly offers, and a key that answered
// with the flat one on a level holding both would be a coin toss.
export function digitFor(option: string): string | null {
    if (/^[1-7]$/.test(option)) {
        return option;
    }
    const numeral = NUMERAL.exec(option)?.[1]?.toLowerCase();
    if (numeral === undefined) {
        return null;
    }
    const degree = NUMERALS.indexOf(numeral);
    return degree < 0 ? null : String(degree + 1);
}

// Whether the number keys' legends show — the hint that they answer, and a button's
// corner digit. A fine pointer anywhere on the device makes a keyboard likely; a key
// pressed outside a text field proves one, which is the only evidence a tablet in a
// keyboard case gives. With neither, the device is taken for a phone, whose player has no
// number keys and for whom a legend about them is only noise.
export function showsDigitLegends({
    finePointer,
    keyPressed,
}: {
    finePointer: boolean;
    keyPressed: boolean;
}): boolean {
    return finePointer || keyPressed;
}

// The option a pressed key answers with, or null when that key answers with nothing here —
// an 8, a letter, or a degree this question does not offer.
export function optionForDigit<T extends string>(key: string, options: readonly T[]): T | null {
    return options.find((option) => digitFor(option) === key) ?? null;
}
