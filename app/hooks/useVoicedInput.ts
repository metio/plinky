// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { holdScaleFor } from "../../core/midi";
import { useMidiInput } from "../contexts/midi";
import { useHeldPedals } from "./useHeldPedals";
import { useSynth } from "./useSynth";

// The instrument, sounding: whatever the input funnel carries — a MIDI piano, the computer
// keys, a tap on the drawn keys — presses a live voice on note-on and lets it go on
// note-off, and the three pedals move the engine's pedals. For a surface that is simply
// being played, with no run deciding which notes deserve a sound: the home page's keys,
// the keyboard tour, the piano page, compose.
//
// The play surface does not use it. There a note sounds only once the run has credited
// it, so its voices come from the matcher rather than straight off the funnel.
//
// Also a keys-on surface, since a page that sounds the instrument is a page somebody is
// playing, and the computer keyboard is one of the instruments.
export function useVoicedInput(): void {
    const synth = useSynth();
    useHeldPedals();
    useMidiInput({
        keys: true,
        onNoteOn: (event) =>
            synth.pressNote(event.note, { velocity: event.velocity, device: event.device }),
        // A tap or a computer key rings on a little (holdScaleFor), so even a quick jab
        // sings; a MIDI key keeps its own articulation.
        onNoteOff: (event) => synth.releaseNote(event.note, holdScaleFor(event.device)),
        onPedal: (pedal, down) => synth.setPedal(pedal, down),
    });
}
