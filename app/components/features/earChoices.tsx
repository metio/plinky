// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The answer surface for the exercises whose answer is a NAME, not a distance or a note:
// chords and scales. A chord's quality and a scale's identity have no natural geometry
// the way an interval has a height or a note has a key, so the choices are just their
// names, laid out as a grid to pick from.
//
// The verdict colours match the ladder and the keyboard so a right or wrong answer reads
// the same across every exercise: green is what played, red is the miss, and once the
// round is settled the rest recede.

type Verdict = "correct" | "wrong" | null;

function choiceClasses(verdict: Verdict, settled: boolean): string {
    if (verdict === "correct") {
        return "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500";
    }
    if (verdict === "wrong") {
        return "border-red-700 bg-red-700 text-white dark:border-red-600 dark:bg-red-600";
    }
    if (settled) {
        return "border-gray-200 bg-white text-gray-400 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-600";
    }
    return "border-gray-300 bg-white text-gray-900 hover:border-indigo-600 hover:text-indigo-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-indigo-500 dark:hover:text-indigo-300";
}

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
    return (
        <fieldset
            className="mx-auto grid w-full min-w-0 max-w-md grid-cols-2 gap-2 sm:grid-cols-3"
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
                        className={`flex min-h-11 items-center justify-center rounded-md border px-3 text-center text-sm font-medium transition-colors disabled:cursor-default ${choiceClasses(verdict, settled)}`}
                    >
                        {nameOf(choice)}
                    </button>
                );
            })}
        </fieldset>
    );
}
