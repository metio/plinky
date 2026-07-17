// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { NOTE_LABELS } from "../../../core/keyMap";
import { noteNameOf, type NoteNameId, type PitchClass } from "../../../core/theory";
import { m } from "../../paraglide/messages.js";

// The answer surface for the perfect-pitch exercise. The question is "which note was
// that?", and the answer set is the twelve notes — which is a keyboard. Naming C by
// pressing C needs no explaining, and it keeps the answer in the vocabulary the player
// already uses everywhere else in Plinky.
//
// One octave, no octave choice: the exercise asks for the note, not the register.
//
// The keys are labelled from core/keyMap's NOTE_LABELS — the same table the computer
// keyboard is labelled from — so a note is spelled identically wherever it appears.
// Letter names deliberately do NOT go through paraglide: they are not translated
// anywhere else in Plinky, and a keyboard reading "Do" here beside one reading "C" on
// the play page would be worse than either choice made consistently.

const WHITE: PitchClass[] = [0, 2, 4, 5, 7, 9, 11];
// Each black key hangs at the boundary between two white keys; the index is which
// boundary, counted in white keys from the left.
const BLACK: { pitchClass: PitchClass; boundary: number }[] = [
    { pitchClass: 1, boundary: 1 },
    { pitchClass: 3, boundary: 2 },
    { pitchClass: 6, boundary: 4 },
    { pitchClass: 8, boundary: 5 },
    { pitchClass: 10, boundary: 6 },
];

const WHITE_WIDTH = 100 / WHITE.length;
const BLACK_WIDTH = WHITE_WIDTH * 0.62;

type Verdict = "correct" | "wrong" | null;

function verdictFor(
    name: NoteNameId,
    answer: NoteNameId | null,
    given: NoteNameId | null,
): Verdict {
    if (answer === null) {
        return null;
    }
    if (name === answer) {
        return "correct";
    }
    return name === given ? "wrong" : null;
}

function whiteClasses(verdict: Verdict, settled: boolean): string {
    if (verdict === "correct") {
        return "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500";
    }
    if (verdict === "wrong") {
        return "border-red-700 bg-red-700 text-white dark:border-red-600 dark:bg-red-600";
    }
    if (settled) {
        return "border-gray-200 bg-white text-gray-400 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-600";
    }
    return "border-gray-300 bg-white text-gray-900 hover:bg-indigo-50 hover:text-indigo-700 dark:border-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-indigo-100";
}

function blackClasses(verdict: Verdict, settled: boolean): string {
    if (verdict === "correct") {
        return "bg-emerald-600 text-white dark:bg-emerald-500";
    }
    if (verdict === "wrong") {
        return "bg-red-700 text-white dark:bg-red-600";
    }
    if (settled) {
        return "bg-gray-400 text-gray-200 dark:bg-gray-700 dark:text-gray-500";
    }
    return "bg-gray-900 text-gray-100 hover:bg-indigo-700 dark:bg-gray-800 dark:hover:bg-indigo-600";
}

export function EarKeyboard({
    choices,
    answer,
    given,
    onChoose,
}: {
    choices: NoteNameId[];
    // Set once the round is answered; until then the keyboard reveals nothing.
    answer: NoteNameId | null;
    given: NoteNameId | null;
    onChoose: (note: NoteNameId) => void;
}) {
    const settled = answer !== null;
    const offered = (pitchClass: PitchClass) => choices.includes(noteNameOf(pitchClass));

    return (
        <fieldset
            className="relative mx-auto h-44 w-full min-w-0 max-w-md select-none"
            aria-label={m.ear_keyboard_label()}
        >
            <div className="flex h-full w-full gap-1">
                {WHITE.map((pitchClass) => {
                    const name = noteNameOf(pitchClass);
                    const verdict = verdictFor(name, answer, given);
                    return (
                        <button
                            type="button"
                            key={pitchClass}
                            disabled={settled || !offered(pitchClass)}
                            onClick={() => onChoose(name)}
                            className={`flex flex-1 items-end justify-center rounded-b-md border pb-2 text-sm font-medium transition-colors disabled:cursor-default ${whiteClasses(verdict, settled)}`}
                        >
                            {NOTE_LABELS[pitchClass]}
                        </button>
                    );
                })}
            </div>
            {BLACK.filter(({ pitchClass }) => offered(pitchClass)).map(
                ({ pitchClass, boundary }) => {
                    const name = noteNameOf(pitchClass);
                    const verdict = verdictFor(name, answer, given);
                    return (
                        <button
                            type="button"
                            key={pitchClass}
                            disabled={settled}
                            onClick={() => onChoose(name)}
                            className={`absolute top-0 flex h-[60%] items-end justify-center rounded-b-md pb-1.5 text-xs font-medium transition-colors disabled:cursor-default ${blackClasses(verdict, settled)}`}
                            style={{
                                width: `${BLACK_WIDTH}%`,
                                left: `calc(${boundary * WHITE_WIDTH}% - ${BLACK_WIDTH / 2}%)`,
                            }}
                        >
                            {NOTE_LABELS[pitchClass]}
                        </button>
                    );
                },
            )}
        </fieldset>
    );
}
