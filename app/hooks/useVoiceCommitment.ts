// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect } from "react";
import { useSynth } from "./useSynth";

// How long a run's choice of instrument lasts: exactly as long as something is performing.
//
// A run commits to the recordings or the synthesised voice when it starts (commitVoice),
// so the piece sounds like one piano from its first note to its last. The choice belongs to
// that run and no longer. Kept past it, a run that began while recordings were still
// arriving would hold every later note — the hero keys, a lesson's example, the next page's
// test note — to the synthesised voice for the rest of the visit.
//
// Released on the edge to "nothing performing" and on unmount, since a run can end either
// way: by finishing or stopping, or by the player leaving the page mid-run. A performance
// taking over from another (Practice pressed during Listen) never passes through "nothing",
// so the new run's commitment stands.
export function useVoiceCommitment(performing: boolean): void {
    const { uncommitVoice } = useSynth();
    useEffect(() => {
        if (!performing) {
            uncommitVoice();
        }
    }, [performing, uncommitVoice]);
    useEffect(() => () => uncommitVoice(), [uncommitVoice]);
}
