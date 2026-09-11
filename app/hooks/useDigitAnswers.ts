// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect } from "react";
import { digitFor, optionForDigit } from "../../core/earAnswer";
import { digitOfKey } from "../../core/keyMap";
import { useClaimedKeys } from "../contexts/midi";
import { typingInto } from "../lib/typingInto";
import { useLatest } from "./useLatest";

// The number keys answer an ear question while it is `active`: each digit that names one
// of `options` (core/earAnswer decides which) picks it, and is claimed from the computer
// keyboard's instrument so it never also sounds a note. A digit that names nothing here is
// left alone. Returns the digits in play, so a surface can say so.
export function useDigitAnswers<T extends string>(
    options: readonly T[],
    active: boolean,
    onAnswer: (option: T) => void,
): string[] {
    const digits = options.map(digitFor).filter((digit) => digit !== null);
    useClaimedKeys(digits, active);
    const latest = useLatest({ options, onAnswer });

    useEffect(() => {
        if (!active) {
            return;
        }
        const onKeyDown = (event: KeyboardEvent) => {
            if (
                event.repeat ||
                event.metaKey ||
                event.ctrlKey ||
                event.altKey ||
                typingInto(event.target)
            ) {
                return;
            }
            const digit = digitOfKey(event.key, event.code);
            const option = digit === null ? null : optionForDigit(digit, latest.current.options);
            if (option === null) {
                return;
            }
            event.preventDefault();
            latest.current.onAnswer(option);
        };
        globalThis.addEventListener("keydown", onKeyDown);
        return () => globalThis.removeEventListener("keydown", onKeyDown);
    }, [active]);

    return digits;
}
