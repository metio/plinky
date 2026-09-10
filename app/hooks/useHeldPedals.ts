// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect } from "react";
import { PEDAL_KINDS } from "../../core/pedals";
import { useMidiConnection } from "../contexts/midi";
import { useSynth } from "./useSynth";

// Tell the engine where the player's pedals are, as a surface that sounds the instrument
// arrives.
//
// The engine learns the pedals only from the changes a sounding surface hands it, and a
// MIDI piano sends a pedal once, when it moves. A pedal that went down or came up on a
// page that sounds nothing never reached it, so without this the next surface would play
// under a pedal the player has long since lifted, or without one they are holding. The
// input funnel remembers what is held, so its answer is the one to start from.
export function useHeldPedals(): void {
    const { setPedal } = useSynth();
    const { pedalHeld } = useMidiConnection();
    useEffect(() => {
        for (const kind of PEDAL_KINDS) {
            setPedal(kind, pedalHeld(kind));
        }
    }, [setPedal, pedalHeld]);
}
