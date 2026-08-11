// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo, useRef } from "react";

// Only the newest press may act.
//
// Starting a run is not always immediate: in sight-reading mode the player gets a
// moment to take the piece in first, and the run begins when that countdown runs out.
// The surface stays live in the gap, so whatever the player does next — press Practice
// again, hand over to Listen, or leave — has to win against a start that is already on
// its way.
//
// A press takes the claim and is handed a way to ask, later, whether it still holds it.
// A press that has been overtaken finds the answer is no and does nothing. `cancel`
// takes the claim away without giving it to anyone, which is what ending a run means:
// nothing pending may start after the player has stopped.

export type LatestPress = {
    // Claim the surface for this press. The returned check answers whether this press
    // is still the newest one — call it at the moment the deferred work would act.
    press: () => () => boolean;
    // Drop whatever claim is outstanding without making a new one, so anything already
    // in flight finds itself overtaken by nobody.
    cancel: () => void;
};

export function useLatestPress(): LatestPress {
    const seq = useRef(0);
    return useMemo(
        () => ({
            press: () => {
                const mine = ++seq.current;
                return () => mine === seq.current;
            },
            cancel: () => {
                seq.current++;
            },
        }),
        [],
    );
}
