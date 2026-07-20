// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { holdScaleFor } from "../../../core/midi";
import { useMidiConnection, useMidiInput } from "../../contexts/midi";
import { useKeyboardTheme } from "../../hooks/useKeyboardTheme";
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
    const theme = useKeyboardTheme();
    // The shared input funnel: touch taps and a connected MIDI keyboard both flow through
    // it, and heldNotes is the single source of truth for which keys are down (and lit).
    const { heldNotes, pressKey, releaseKey } = useMidiConnection();

    // Sound the app's own piano voice for whatever the funnel reports — a live voice on
    // note-on, released on note-off — so the hold shapes the sound exactly as it does in
    // the trainer. Notes outside this octave (from a full MIDI keyboard) still sound.
    useMidiInput({
        onNoteOn: (event) => synth.pressNote(event.note, { velocity: event.velocity }),
        // A tap on the hero rings on a little (holdScaleFor) so even a quick click sings.
        onNoteOff: (event) => synth.releaseNote(event.note, holdScaleFor(event.device)),
    });

    // A key still held when the hero unmounts never delivers its pointer-up; the shared
    // Keyboard releases its own on-screen sources on teardown, so its voice does not ring
    // on. A MIDI note held then is genuinely still down and left to its device's note-off.

    return (
        <Keyboard
            from={FROM}
            to={TO}
            lit={new Set(heldNotes)}
            rise
            labels={labels}
            well="mx-auto w-full max-w-md"
            theme={theme}
            badge={<MidiBadge />}
            onPress={pressKey}
            onRelease={releaseKey}
        />
    );
}
