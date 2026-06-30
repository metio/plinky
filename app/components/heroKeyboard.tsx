// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useRef, useState } from "react";
import { useMidiInput } from "../contexts/midi";
import { useNoteLabels } from "../hooks/useNoteLabels";
import { useSynth } from "../hooks/useSynth";
import { Keyboard } from "./keyboard";
import { MidiBadge } from "./midiBadge";

// One octave, C4–C5 — enough to be unmistakably a piano, small enough to sit on a
// phone.
const FROM = 60;
const TO = 72;

// The landing page's signature: a real keyboard you play right here — the same
// Keyboard component the trainer uses. A press sounds the app's own piano voice
// (the Web Audio context wakes on the first key, so it costs nothing until touched)
// and lights the key, fading out after a moment. The keys rise in a one-time ripple
// on load; that and the press are the only motion, both dropped for reduce-motion.
export function HeroKeyboard() {
    const synth = useSynth();
    const labels = useNoteLabels();
    const [lit, setLit] = useState<ReadonlySet<number>>(new Set());
    // Pending un-light timers, cleared on unmount so a press right before the component
    // goes away can't fire setLit after teardown (which crashes a test that just left).
    const timers = useRef<number[]>([]);
    useEffect(
        () => () => {
            for (const timer of timers.current) {
                window.clearTimeout(timer);
            }
        },
        [],
    );

    const plink = (note: number) => {
        synth.playNote(note, { velocity: 100, duration: 1.4 });
        setLit((prev) => new Set(prev).add(note));
        timers.current.push(
            window.setTimeout(() => {
                setLit((prev) => {
                    const next = new Set(prev);
                    next.delete(note);
                    return next;
                });
            }, 240),
        );
    };

    // A connected MIDI keyboard plays the hero too — but only if it's already
    // reconnected from an earlier grant, so a first-time visitor is never prompted
    // (the provider gates that on the stored permission). Notes outside this octave
    // simply sound without a key to light.
    useMidiInput({ onNoteOn: (event) => plink(event.note) });

    return (
        <Keyboard
            from={FROM}
            to={TO}
            lit={lit}
            rise
            labels={labels}
            well="mx-auto w-full max-w-md"
            badge={<MidiBadge />}
            onPress={plink}
        />
    );
}
