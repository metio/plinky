// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useState } from "react";
import { UndoIcon } from "../ui/icons";
import { IconButton } from "../ui/button";
import { VERDICT_BOX } from "./earVerdict";
import { m } from "../../paraglide/messages.js";

// The answer surface for the exercises whose answer is a SEQUENCE rather than a single
// pick — a chord progression named by Roman numeral, a melody named by scale degree. The
// player names each item in order from a keypad; the built-up sequence shows above it, and
// once every slot is filled it is handed back as one answer. The labels are the items
// themselves — Roman numerals, degree numbers — which are notation, the same in every
// language, so they need no translation.
//
// The surface owns the in-progress sequence and emits only when it is complete, so the
// session that hosts it sees a single settled answer and needs to know nothing about the
// chord-by-chord entry. It is remounted per question (a key on the round), which resets
// the entry for the next progression.

function slotClasses(state: "correct" | "wrong" | "current" | "filled" | "empty"): string {
    switch (state) {
        case "correct":
            return VERDICT_BOX.correct;
        case "wrong":
            return VERDICT_BOX.wrong;
        case "current":
            return "border-accent text-accent-strong";
        case "filled":
            return "border-line-strong text-ink";
        default:
            return "border-line text-faint";
    }
}

export function EarSequence<T extends string>({
    sequence,
    choices,
    settled,
    onComplete,
    label,
}: {
    // The correct answer, item by item — its length is how many the player names.
    sequence: T[];
    // The level's vocabulary, the keypad to answer from.
    choices: T[];
    settled: boolean;
    onComplete: (joined: string) => void;
    label: string;
}) {
    const [entered, setEntered] = useState<T[]>([]);

    const choose = (degree: T) => {
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
                        className="flex min-h-11 items-center justify-center rounded-md border border-line-strong bg-raised text-sm font-semibold text-ink transition-colors hover:border-accent-solid hover:text-accent-strong disabled:cursor-default disabled:opacity-50"
                    >
                        {degree}
                    </button>
                ))}
            </div>
        </div>
    );
}
