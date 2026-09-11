// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { m } from "../../paraglide/messages.js";

// The one line that tells a player the number keys answer, under a surface where they do.
// Hidden where the main pointer is a finger: a phone has no number keys to press, and a
// line about them is only noise there.
export function EarDigitHint({ shown }: { shown: boolean }) {
    if (!shown) {
        return null;
    }
    return (
        <p className="text-center text-xs text-muted pointer-coarse:hidden">{m.ear_digit_hint()}</p>
    );
}
