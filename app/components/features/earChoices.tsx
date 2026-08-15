// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The answer surface for the exercises whose answer is a NAME, not a distance or a note:
// chords and scales. A chord's quality and a scale's identity have no natural geometry
// the way an interval has a height or a note has a key, so the choices are just their
// names, laid out as a grid to pick from.
//
// The verdict comes from `earVerdict`, so a right or wrong answer reads the same here as
// on the ladder, the keyboard and the sequence.

import { answerClasses, type Verdict } from "./earVerdict";

export function EarChoices<T extends string>({
    choices,
    answer,
    given,
    onChoose,
    nameOf,
    label,
}: {
    choices: T[];
    // Set once the round is answered; until then the grid reveals nothing.
    answer: T | null;
    given: T | null;
    onChoose: (choice: T) => void;
    nameOf: (choice: T) => string;
    label: string;
}) {
    const settled = answer !== null;
    // Wrapping rather than a fixed grid: the drill can be set to as few as two answers, and
    // three columns then stretched each one across a third of the width with the row half
    // empty — a lot of space between two things that belong together. They keep a common
    // minimum so a short name and a long one still make a tidy row, and the group stays
    // centred however many there are.
    return (
        <fieldset
            className="mx-auto flex w-full min-w-0 max-w-md flex-wrap justify-center gap-2"
            aria-label={label}
        >
            {choices.map((choice) => {
                const verdict: Verdict = !settled
                    ? null
                    : choice === answer
                      ? "correct"
                      : choice === given
                        ? "wrong"
                        : null;
                return (
                    <button
                        type="button"
                        key={choice}
                        disabled={settled}
                        onClick={() => onChoose(choice)}
                        className={`flex min-h-11 min-w-28 flex-auto items-center justify-center rounded-md border px-3 text-center text-sm font-medium transition-colors disabled:cursor-default ${answerClasses(verdict, settled)}`}
                    >
                        {nameOf(choice)}
                    </button>
                );
            })}
        </fieldset>
    );
}
