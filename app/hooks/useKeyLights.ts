// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useMemo } from "react";
import { depthFor, litKeys, NOTHING_LIT, type UpcomingPosition } from "../../core/keyLights";
import type { NoteHints } from "../../core/prefs";
import type { KeyLightsPort } from "../ports/keyLights";

// Keeps a lighted keyboard showing the position the run is on.
//
// The whole hook is a second renderer of `upcoming` — the same look-ahead the
// notes-highway draws on screen — so the instrument and the display can never disagree
// about what comes next, and nothing here tracks the run's progress independently.
//
// There is no schedule. Self-paced practice advances when the right note lands, not on
// a clock, so "next" is a position rather than a moment: the key lights when the run
// reaches it and stays lit until the player finds it. That is what lighting ahead of
// time means when the player sets the pace, and it is why this needs no timing queue,
// no look-ahead window, and nothing to drift.
export function useKeyLights(options: {
    lights: KeyLightsPort;
    // Whether the player asked for a lighted keyboard at all.
    enabled: boolean;
    // Only a run in progress lights anything: between runs the instrument is theirs.
    practicing: boolean;
    // The reading-aid policy already resolved for this run — sight-read included, since
    // that arrives as "never" rather than as a separate flag.
    hints: NoteHints;
    missedHere: boolean;
    upcoming: UpcomingPosition[];
}): void {
    const { lights, enabled, practicing, hints, missedHere, upcoming } = options;

    const picture = useMemo(() => {
        if (!enabled || !practicing) {
            return NOTHING_LIT;
        }
        return litKeys(upcoming, depthFor(hints, missedHere, false));
    }, [enabled, practicing, hints, missedHere, upcoming]);

    useEffect(() => {
        // Idempotent by contract: the port diffs against what it last sent, so showing
        // the same picture twice sends nothing and this can run as often as it likes.
        lights.show(picture);
    }, [lights, picture]);

    useEffect(() => {
        // A light outlives the page that lit it. Leaving the surface clears through the
        // run's own teardown; this covers the ways out that never reach it — a
        // navigation, a crash into an error boundary, a closed tab.
        return () => lights.clear();
    }, [lights]);
}
