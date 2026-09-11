// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { m } from "../../paraglide/messages.js";

// Where a number key's legend shows: this hint, and the digit printed in the corner of a
// button whose label is not already its number. Hidden where the main pointer is a finger:
// a phone has no number keys to press, and a legend for them is only noise there. One rule
// for both, so a phone never shows a corner digit with nothing on screen to explain it.
export const DIGIT_LEGEND = "pointer-coarse:hidden";

// The one line that tells a player the number keys answer, under a surface where they do.
export function EarDigitHint({ shown }: { shown: boolean }) {
    if (!shown) {
        return null;
    }
    return <p className={`text-center text-xs text-muted ${DIGIT_LEGEND}`}>{m.ear_digit_hint()}</p>;
}
