// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useMemo, useState } from "react";
import type { Hand } from "../lib/hands";
import { m } from "../paraglide/messages.js";

// "both" plays every hand; a staff number restricts the run to that one hand,
// for practicing a grand staff one hand at a time.
export type HandChoice = "both" | number;

export function useHandSelection(allHands: Hand[]): {
    hands: Hand[];
    choice: HandChoice;
    setChoice: (choice: HandChoice) => void;
} {
    const [choice, setChoice] = useState<HandChoice>("both");
    const hands = useMemo(
        () => (choice === "both" ? allHands : allHands.filter((hand) => hand.staff === choice)),
        [allHands, choice],
    );
    return { hands, choice, setChoice };
}

export function HandSelector({
    hands,
    value,
    onChange,
    disabled,
}: {
    hands: Hand[];
    value: HandChoice;
    onChange: (choice: HandChoice) => void;
    disabled?: boolean;
}) {
    // Only meaningful for a grand staff; a single-hand piece needs no choice.
    if (hands.length <= 1) {
        return null;
    }
    const options: { label: string; value: HandChoice }[] = [
        { label: m.hands_both(), value: "both" },
        ...hands.map((hand) => ({ label: m.hands_one({ hand: hand.label }), value: hand.staff })),
    ];
    return (
        <div className="flex flex-wrap gap-2">
            {options.map((option) => (
                <button
                    key={String(option.value)}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(option.value)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40 ${
                        value === option.value
                            ? "bg-indigo-600 text-white"
                            : "border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                    }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
