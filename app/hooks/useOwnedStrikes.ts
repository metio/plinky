// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useState } from "react";
import type { StrikeOwner } from "../ports/audioEngine";
import type { PlayNoteOptions, UseSynthResult } from "./useSynth";

// The slice of the synth a transport strikes through: fixed-length notes, and a stop that
// takes back what one owner struck.
export type StrikeSink = Pick<UseSynthResult, "playNote" | "silenceStrikes">;

// A transport's own strikes. Every note goes out under one owner of its own, and `silence`
// takes back exactly those, never a note the player or another transport is sounding. The
// owner is bound here, so no note a transport strikes can escape its stop.
//
// Bound through the synth's members, not the object: a synth rebuilt around a new
// preference keeps the same members, and `silence` is what an unmount effect runs.
export function useOwnedStrikes(synth: StrikeSink, label: string) {
    const [owner] = useState<StrikeOwner>(() => Symbol(label));
    const { playNote: strike, silenceStrikes } = synth;
    const playNote = useCallback(
        (note: number, options?: Omit<PlayNoteOptions, "owner">) =>
            strike(note, { ...options, owner }),
        [strike, owner],
    );
    const silence = useCallback(() => silenceStrikes(owner), [silenceStrikes, owner]);
    return { playNote, silence };
}
