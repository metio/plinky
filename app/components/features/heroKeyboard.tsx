// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useRef } from "react";
import { useMidiConnection, useMidiInput } from "../../contexts/midi";
import { useNoteLabels } from "../../hooks/useNoteLabels";
import { useSynth } from "../../hooks/useSynth";
import { Keyboard } from "../ui/keyboard";
import { MidiBadge } from "./midiBadge";

// One octave, C4–C5 — enough to be unmistakably a piano, small enough to sit on a
// phone.
const FROM = 60;
const TO = 72;

// The landing page's signature: a real keyboard you play right here — the same
// Keyboard component and input funnel the practice modes use, so the instrument and its
// feel are literally the same everywhere. A tap or a connected MIDI key presses a live
// voice that rings for exactly as long as it is held (a quick release sounds staccato, a
// long hold sustains) and lights the key green while down — no fixed-length strike, so
// notes played in succession don't smear into each other. The keys rise in a one-time
// ripple on load; that and the press are the only motion, both dropped for reduce-motion.
export function HeroKeyboard() {
    const synth = useSynth();
    const labels = useNoteLabels();
    // The shared input funnel: touch taps and a connected MIDI keyboard both flow through
    // it, and heldNotes is the single source of truth for which keys are down (and lit).
    const { heldNotes, pressKey, releaseKey } = useMidiConnection();

    // Sound the app's own piano voice for whatever the funnel reports — a live voice on
    // note-on, released on note-off — so the hold shapes the sound exactly as it does in
    // the trainer. Notes outside this octave (from a full MIDI keyboard) still sound.
    useMidiInput({
        onNoteOn: (event) => synth.pressNote(event.note, { velocity: event.velocity }),
        onNoteOff: (event) => synth.releaseNote(event.note),
    });

    // A key still held when the hero unmounts never delivers its pointer-up, so its note
    // would ring on and its key stay lit. Release whatever is held on teardown, reading
    // the latest held set through a ref so the cleanup isn't pinned to a stale render.
    const heldRef = useRef(heldNotes);
    heldRef.current = heldNotes;
    useEffect(
        () => () => {
            for (const note of heldRef.current) {
                releaseKey(note);
            }
        },
        [releaseKey],
    );

    return (
        <Keyboard
            from={FROM}
            to={TO}
            lit={new Set(heldNotes)}
            rise
            labels={labels}
            well="mx-auto w-full max-w-md"
            badge={<MidiBadge />}
            onPress={pressKey}
            onRelease={releaseKey}
        />
    );
}
