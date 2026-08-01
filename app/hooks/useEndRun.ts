// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useRef } from "react";

// Ending a run, in the order the parts have to be ended in.
//
// The play surface can be left three ways — the ✕, Esc, or a finished run dropping out
// of full screen — and all of them arrive here as the surface going quiet. Stopping
// hides the cursor and never rewinds it, so coming back to Practice or Listen picks up
// from the same place.
//
// The sequence is not arbitrary, and two steps in it are load-bearing:
//
//   - The owed take is saved BEFORE the matcher stops. The deferred save waits on the
//     run being complete, and stopping the matcher clears exactly that — so a player
//     who stepped out while still holding the final note would lose the recording if
//     these two swapped.
//   - A start already on its way is cancelled. A sight-read counts down before its run
//     begins, and nothing else here would stop it: the countdown would resolve onto a
//     surface the player had left, start the run, and go on ticking on screen.
//
// The rest is tidying that has no order of its own — put the score back the way a
// resting page expects it, and let nothing keep sounding.

export type EndRunOptions = {
    // True while the surface is live. The run ends on the edge down to false.
    active: boolean;
    stopListen: () => void;
    // Take the recording if one is still owed. Runs before stopMatcher.
    saveOwedTake: () => void;
    stopKeepUp: () => void;
    stopMatcher: () => void;
    // Drop any claim to start a run, and stop whatever is counting down toward one.
    cancelPendingStart: () => void;
    // Put back whatever the run hid: blanked noteheads, vanished bars.
    restoreScore: () => void;
    // Silence the guide voices and anything still lit on a connected instrument.
    silence: () => void;
};

export function useEndRun(options: EndRunOptions): void {
    const latest = useRef(options);
    latest.current = options;

    useEffect(() => {
        if (options.active) {
            return;
        }
        const o = latest.current;
        o.stopListen();
        o.saveOwedTake();
        o.stopKeepUp();
        o.stopMatcher();
        o.cancelPendingStart();
        o.restoreScore();
        o.silence();
    }, [options.active]);

    // The audio engine's voices outlive this component — it is a module singleton — so
    // navigating away from the play route has to silence them too. The effect above
    // only fires on the surface going quiet, never on unmount.
    useEffect(() => () => latest.current.silence(), []);
}
