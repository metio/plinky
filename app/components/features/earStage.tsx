// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useRef, useState } from "react";
import type { EarNote } from "../../../core/earExercise";
import type { SchedulerHandle } from "../../ports/scheduler";
import { useScheduler } from "../../contexts/services";
import { useSynth } from "../../hooks/useSynth";
import { Button } from "../ui/button";
import { EarIcon } from "../ui/icons";
import { m } from "../../paraglide/messages.js";

// The listening surface. It stays dark in both themes on purpose: everywhere else in
// Plinky there is something to read, and here there deliberately isn't — the panel is
// a lights-off stage that says the answer is in your ears, not on the screen.
//
// The only thing it draws is one dot per note, blooming exactly when that note sounds.
// That shows the SHAPE of the question — one note, or two in sequence, or two at once —
// which the player is allowed to know, while giving away no pitch, which they aren't.

export function EarStage({ notes, autoPlay }: { notes: EarNote[]; autoPlay: boolean }) {
    const synth = useSynth();
    const scheduler = useScheduler();
    const [lit, setLit] = useState<readonly number[]>([]);
    const handles = useRef<SchedulerHandle[]>([]);

    const clear = useCallback(() => {
        for (const handle of handles.current) {
            scheduler.cancel(handle);
        }
        handles.current = [];
    }, [scheduler]);

    const play = useCallback(() => {
        clear();
        setLit([]);
        for (const note of notes) {
            synth.playNote(note.note, {
                velocity: note.velocity,
                duration: note.duration,
                delay: note.at,
            });
            // The dots are driven off the same values the strikes are scheduled from, so
            // the bloom can't drift out of step with what's heard.
            handles.current.push(
                scheduler.after(note.at * 1000, () => setLit((current) => [...current, note.note])),
                scheduler.after((note.at + note.duration) * 1000, () =>
                    setLit((current) => current.filter((value) => value !== note.note)),
                ),
            );
        }
    }, [clear, notes, scheduler, synth]);

    // A fresh question sounds itself — the round has already been started by a press, so
    // the audio context is unlocked and waiting for another tap would only add a chore.
    useEffect(() => {
        if (autoPlay) {
            play();
        }
        return clear;
    }, [autoPlay, clear, play]);

    return (
        <div className="flex flex-col items-center gap-6 rounded-xl bg-gray-950 px-6 py-10 dark:bg-gray-900">
            <div className="flex h-16 items-center justify-center gap-4">
                {notes.map((note) => {
                    const sounding = lit.includes(note.note);
                    return (
                        <span
                            key={`${note.note}-${note.at}`}
                            aria-hidden="true"
                            className={`h-4 w-4 rounded-full transition-all duration-200 motion-reduce:transition-none ${
                                sounding
                                    ? "scale-150 bg-indigo-400 shadow-[0_0_20px_theme(colors.indigo.500)]"
                                    : "scale-100 bg-gray-700"
                            }`}
                        />
                    );
                })}
            </div>
            <Button variant="secondary" onClick={play}>
                <EarIcon className="h-4 w-4" />
                {m.ear_play_again()}
            </Button>
        </div>
    );
}
