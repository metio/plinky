// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useSyncExternalStore } from "react";
import { showsDigitLegends } from "../../core/earAnswer";
import { useServices } from "../contexts/services";
import { typingInto } from "../lib/typingInto";
import { useMediaQuery } from "./useMediaQuery";

// Whether the number keys' legends show: the hint saying they answer, and the digit in a
// button's corner. One rule for both, so a corner digit never shows with nothing on screen
// to explain it. core/earAnswer decides; this gathers the evidence it decides from.
//
// `(any-pointer: fine)` rather than the main pointer: a touch laptop's or a trackpad
// tablet's main pointer can be a finger while a keyboard sits right there. A key pressed
// outside a text field covers the rest, a keyboard case with no trackpad, and is watched
// for only until it has been seen.
export function useDigitLegends(): boolean {
    const { keyboardEvidence } = useServices();
    const finePointer = useMediaQuery("(any-pointer: fine)");
    const keyPressed = useSyncExternalStore(
        keyboardEvidence.subscribe,
        keyboardEvidence.seen,
        () => false,
    );
    useEffect(() => {
        if (keyPressed) {
            return;
        }
        // Capture, so the press is seen even when a surface answering it stops it.
        const onKeyDown = (event: KeyboardEvent) => {
            if (!typingInto(event.target)) {
                keyboardEvidence.note();
            }
        };
        globalThis.addEventListener("keydown", onKeyDown, true);
        return () => globalThis.removeEventListener("keydown", onKeyDown, true);
    }, [keyboardEvidence, keyPressed]);
    return showsDigitLegends({ finePointer, keyPressed });
}
