// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useRef } from "react";
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
    // The pitches this surface opened a voice for and has not let go yet. A note the synth
    // declined — muted, or an instrument or microphone sounding it already — opened nothing,
    // so a voice at that pitch is somebody else's and this surface never ends it.
    const sounding = useRef(new Set<number>());
    useMidiInput({
        keys: true,
        onNoteOn: (event) => {
            if (synth.pressNote(event.note, { velocity: event.velocity, device: event.device })) {
                sounding.current.add(event.note);
            }
        },
        // A tap or a computer key rings on a little (holdScaleFor), so even a quick jab
        // sings; a MIDI key keeps its own articulation.
        onNoteOff: (event) => {
            if (sounding.current.delete(event.note)) {
                synth.releaseNote(event.note, holdScaleFor(event.device));
            }
        },
        onPedal: (pedal, down) => synth.setPedal(pedal, down),
    });
    // A key still down when the surface goes has its key-off delivered to whatever page
    // comes next, which may voice nothing. So does a drawn key: the keyboard lets its own
    // held keys go as it unmounts, after this surface has already unsubscribed. Either way
    // the voice would ring on through its whole decay and the engine would go on counting
    // the key as down, so the surface ends what it started as it leaves.
    useEffect(() => {
        const held = sounding.current;
        return () => {
            for (const note of held) {
                synth.releaseNote(note);
            }
            held.clear();
        };
    }, [synth]);
}
