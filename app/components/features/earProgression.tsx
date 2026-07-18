// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useState } from "react";
import type { ChordDegree } from "../../../core/theory";
import { UndoIcon } from "../ui/icons";
import { IconButton } from "../ui/button";
import { m } from "../../paraglide/messages.js";

// The answer surface for chord progressions, the one exercise whose answer is a SEQUENCE
// rather than a single pick. The player names the chords in order, tapping a Roman numeral
// for each; the built-up sequence shows above the keypad, and once every slot is filled it
// is handed back as one answer. The Roman numerals are the buttons' own labels — they are
// notation, the same in every language, so they need no translation.
//
// The surface owns the in-progress sequence and emits only when it is complete, so the
// session that hosts it sees a single settled answer and needs to know nothing about the
// chord-by-chord entry. It is remounted per question (a key on the round), which resets
// the entry for the next progression.

function slotClasses(state: "correct" | "wrong" | "current" | "filled" | "empty"): string {
    switch (state) {
        case "correct":
            return "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500";
        case "wrong":
            return "border-red-700 bg-red-700 text-white dark:border-red-600 dark:bg-red-600";
        case "current":
            return "border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300";
        case "filled":
            return "border-gray-400 text-gray-900 dark:border-gray-500 dark:text-gray-100";
        default:
            return "border-gray-200 text-gray-400 dark:border-gray-800 dark:text-gray-600";
    }
}

export function EarProgression({
    sequence,
    choices,
    settled,
    onComplete,
    label,
}: {
    // The correct progression, chord by chord — its length is how many the player names.
    sequence: ChordDegree[];
    // The level's chord vocabulary, the keypad to answer from.
    choices: ChordDegree[];
    settled: boolean;
    onComplete: (joined: string) => void;
    label: string;
}) {
    const [entered, setEntered] = useState<ChordDegree[]>([]);

    const choose = (degree: ChordDegree) => {
        if (settled || entered.length >= sequence.length) {
            return;
        }
        const next = [...entered, degree];
        setEntered(next);
        if (next.length === sequence.length) {
            onComplete(next.join("-"));
        }
    };

    const undo = () => {
        if (!settled) {
            setEntered((current) => current.slice(0, -1));
        }
    };

    return (
        <div className="space-y-4">
            {/* The sequence being built (or graded): one slot per chord. */}
            <fieldset className="flex items-center justify-center gap-2" aria-label={label}>
                {sequence.map((answer, index) => {
                    const pick = entered[index];
                    const state = settled
                        ? pick === answer
                            ? "correct"
                            : "wrong"
                        : pick
                          ? "filled"
                          : index === entered.length
                            ? "current"
                            : "empty";
                    return (
                        <div
                            // The slot's place in the sequence is its identity; the row
                            // never reorders and its length is fixed per question.
                            // biome-ignore lint/suspicious/noArrayIndexKey: a slot's position is its identity here
                            key={index}
                            className={`flex h-12 w-12 flex-col items-center justify-center rounded-md border text-sm font-semibold ${slotClasses(state)}`}
                        >
                            <span>{settled ? (pick ?? "·") : (pick ?? "")}</span>
                            {/* A wrong slot reveals the chord it should have been. */}
                            {settled && pick !== answer ? (
                                <span className="text-[10px] font-normal opacity-90">{answer}</span>
                            ) : null}
                        </div>
                    );
                })}
                {!settled ? (
                    <IconButton
                        label={m.ear_progression_undo()}
                        variant="ghost"
                        onClick={undo}
                        disabled={entered.length === 0}
                    >
                        <UndoIcon className="h-5 w-5" />
                    </IconButton>
                ) : null}
            </fieldset>

            {/* The keypad: the chords this level can hold. */}
            <div className="mx-auto grid w-full min-w-0 max-w-md grid-cols-4 gap-2 sm:grid-cols-7">
                {choices.map((degree) => (
                    <button
                        type="button"
                        key={degree}
                        disabled={settled}
                        onClick={() => choose(degree)}
                        className="flex min-h-11 items-center justify-center rounded-md border border-gray-300 bg-white text-sm font-semibold text-gray-900 transition-colors hover:border-indigo-600 hover:text-indigo-700 disabled:cursor-default disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
                    >
                        {degree}
                    </button>
                ))}
            </div>
        </div>
    );
}
