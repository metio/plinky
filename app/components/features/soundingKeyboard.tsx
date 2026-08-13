// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { Keyboard } from "../ui/keyboard";
import { useScheduler } from "../../contexts/services";
import type { SchedulerHandle } from "../../ports/scheduler";
import { useSynth } from "../../hooks/useSynth";

// Middle C's octave and the one above it: where a beginner sits, and where every
// idea in the app is drawn and sounded so two pages never show the same chord in two
// different registers.
export const DEMO_FROM = 60;
export const DEMO_TO = 84;

// One beat's sound — long enough to hear, short enough that a whole scale plays in a
// couple of seconds.
const NOTE_SECONDS = 0.45;
// A scale unfolds at this pace, one note after another.
const STEP_MS = 260;

// Notes to sound together, or one after another when `spread` is set; `afterMs` delays
// the whole group, which is how the same idea is played twice for comparison.
export type Phrase = { notes: number[]; spread?: boolean; afterMs?: number };

// A musical idea you can see and hear: the notes lit on a keyboard, and one button that
// plays them. Every page that demonstrates something — the theory course's lessons, the
// tools bench's scale and chord explorers — draws it through here, so the register, the
// note length and the pace of a scale are decided once.
//
// Pressing again restarts rather than layering: a demonstration left half-played when
// the reader moves on stops, and two presses never sound over each other. The strikes go
// through the injected scheduler rather than a bare timer, which the architecture
// confines to that seam.
export function SoundingKeyboard({
    lit,
    phrases,
    label,
    children,
}: {
    // What to light. Usually the notes of the first phrase, but a comparison lights only
    // what it is about to play first.
    lit: number[];
    phrases: Phrase[];
    // What the button says — "Hear it", or "Hear both" where two readings follow.
    label: string;
    // Anything to say between the keyboard and the button, such as what a key signature
    // spells out.
    children?: ReactNode;
}) {
    const synth = useSynth();
    const scheduler = useScheduler();
    // Strikes still waiting to happen, so a phrase left half-played when the reader
    // moves on does not go on sounding, and a second press replaces the first.
    const pending = useRef<SchedulerHandle[]>([]);
    const stop = useCallback(() => {
        for (const handle of pending.current) {
            scheduler.cancel(handle);
        }
        pending.current = [];
    }, [scheduler]);
    useEffect(() => stop, [stop]);

    const hear = () => {
        stop();
        for (const phrase of phrases) {
            for (const [index, pitch] of phrase.notes.entries()) {
                const at = (phrase.afterMs ?? 0) + (phrase.spread ? index * STEP_MS : 0);
                const strike = () => synth.playNote(pitch, { duration: NOTE_SECONDS });
                if (at === 0) {
                    strike();
                } else {
                    pending.current.push(scheduler.after(at, strike));
                }
            }
        }
    };

    return (
        <div className="space-y-3">
            <Keyboard from={DEMO_FROM} to={DEMO_TO} lit={new Set(lit)} labels="c" />
            {children}
            <Button variant="secondary" onClick={hear}>
                {label}
            </Button>
        </div>
    );
}
