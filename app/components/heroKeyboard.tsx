// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useState } from "react";
import { useSynth } from "../hooks/useSynth";
import { Keyboard } from "./keyboard";

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
    const [lit, setLit] = useState<ReadonlySet<number>>(new Set());

    const plink = (note: number) => {
        synth.playNote(note, { velocity: 100, duration: 1.4 });
        setLit((prev) => new Set(prev).add(note));
        window.setTimeout(() => {
            setLit((prev) => {
                const next = new Set(prev);
                next.delete(note);
                return next;
            });
        }, 240);
    };

    return (
        <Keyboard from={FROM} to={TO} lit={lit} rise well="mx-auto w-full max-w-md" onPress={plink} />
    );
}
