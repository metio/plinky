// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useDigitLegends } from "../../hooks/useDigitLegends";
import { m } from "../../paraglide/messages.js";

// The one line that tells a player the number keys answer, under a surface where they do.
// It shows wherever a keyboard is likely (useDigitLegends), the same rule the corner
// digits on a progression's chord buttons follow.
export function EarDigitHint({ shown }: { shown: boolean }) {
    const legends = useDigitLegends();
    if (!shown || !legends) {
        return null;
    }
    return <p className="text-center text-xs text-muted">{m.ear_digit_hint()}</p>;
}
