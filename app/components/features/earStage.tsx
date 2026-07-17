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
        notes.forEach((note, index) => {
            synth.playNote(note.note, {
                velocity: note.velocity,
                duration: note.duration,
                delay: note.at,
            });
            // Lit by POSITION, never by pitch. A unison sounds one pitch twice, so
            // tracking pitches would bloom both of its dots at once — giving the round
            // away to anyone watching, since it is the only interval whose two notes
            // share a number — and would darken the first dot while the second still
            // rang. A dot belongs to a note, not to a frequency.
            handles.current.push(
                scheduler.after(note.at * 1000, () => setLit((current) => [...current, index])),
                scheduler.after((note.at + note.duration) * 1000, () =>
                    setLit((current) => current.filter((value) => value !== index)),
                ),
            );
        });
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
                {notes.map((note, index) => {
                    const sounding = lit.includes(index);
                    return (
                        <span
                            // The position in the question IS the dot's identity, and
                            // the usual objection to an index key doesn't apply: a
                            // question's notes are a fixed list that never reorders or
                            // grows, and no value on the note can stand in — two notes
                            // of a unison share a pitch, and a harmonic one shares the
                            // onset too, so pitch-and-time collide where index cannot.
                            // biome-ignore lint/suspicious/noArrayIndexKey: a note's position is its only stable identity here
                            key={index}
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
