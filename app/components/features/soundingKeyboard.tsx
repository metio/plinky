// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { type DemoScore, demoDurationMs, demoMoments, demoNotes } from "../../../core/theoryDemo";
import { useScheduler } from "../../contexts/services";
import type { SchedulerHandle } from "../../ports/scheduler";
import { useSynth } from "../../hooks/useSynth";
import { Button } from "../ui/button";
import { Keyboard } from "../ui/keyboard";

// Middle C's octave and the one above it: where a beginner sits, and where every
// idea in the app is drawn and sounded so two pages never show the same chord in two
// different registers. A demonstration about notes somewhere else — the bass clef, a
// scale starting below middle C — asks for its own range instead.
export const DEMO_FROM = 60;
export const DEMO_TO = 84;

// A musical idea you can see and hear: the notes lit on a keyboard, and one button that
// plays them. Every page that demonstrates something — the theory course's lessons, the
// tools bench's scale and chord explorers — draws it through here, so the register, the
// note length and the pace are decided once.
//
// The score is the single thing it reads. The keys lit, the notes struck and their
// lengths all come off the same steps, so what a reader hears is what they are looking
// at; deriving them separately is what let a lesson draw a rest it never played.
//
// Pressing again restarts rather than layering: a demonstration left half-played when
// the reader moves on stops, and two presses never sound over each other. The strikes go
// through the injected scheduler rather than a bare timer, which the architecture
// confines to that seam.
export function SoundingKeyboard({
    score,
    from = DEMO_FROM,
    to = DEMO_TO,
    label,
    children,
    onPlay,
}: {
    score: DemoScore;
    from?: number;
    to?: number;
    // What the button says — "Hear it", or "Hear them in turn" where several follow.
    label: string;
    // Anything to say between the keyboard and the button, such as what a key signature
    // spells out.
    children?: ReactNode;
    // Called when the idea is played. The theory course uses it to remember that the
    // lesson has been met — hearing it is what meeting it means.
    onPlay?: () => void;
}) {
    const synth = useSynth();
    const scheduler = useScheduler();
    // Strikes still waiting to happen, so a phrase left half-played when the reader
    // moves on does not go on sounding, and a second press replaces the first.
    const pending = useRef<SchedulerHandle[]>([]);
    // The notes sounding right now, or null when nothing is playing. Null is not the same
    // as an empty set: at rest the keyboard shows the whole shape, and during a silence in
    // the middle of a demonstration it shows nothing at all.
    const [sounding, setSounding] = useState<number[] | null>(null);

    const stop = useCallback(() => {
        for (const handle of pending.current) {
            scheduler.cancel(handle);
        }
        pending.current = [];
    }, [scheduler]);
    useEffect(() => {
        return () => {
            stop();
        };
    }, [stop]);

    // The shape of the idea, which is what the keyboard is for when nobody has pressed
    // anything: a scale you can see the run of, a chord you can see the gaps in.
    const shape = demoNotes(score);

    const hear = () => {
        stop();
        onPlay?.();
        const moments = demoMoments(score);
        const at = (ms: number, run: () => void) => {
            if (ms <= 0) {
                run();
                return;
            }
            pending.current.push(scheduler.after(ms, run));
        };
        for (const moment of moments) {
            at(moment.atMs, () => {
                setSounding(moment.notes);
                for (const note of moment.notes) {
                    synth.playNote(note, { duration: moment.forMs / 1000 });
                }
            });
            // Each moment clears itself rather than waiting for the next: between two
            // notes there may be a rest, and lighting through it would draw a silence as
            // though it were held.
            at(moment.atMs + moment.forMs, () => setSounding([]));
        }
        // Back to the shape once it is over, so the lesson is left as it was found.
        at(demoDurationMs(score), () => setSounding(null));
    };

    return (
        <div className="space-y-3">
            <Keyboard from={from} to={to} lit={new Set(sounding ?? shape)} labels="c" />
            {children}
            <Button variant="secondary" onClick={hear}>
                {label}
            </Button>
        </div>
    );
}
