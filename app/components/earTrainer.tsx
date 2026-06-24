// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useRef, useState } from "react";
import { useMidiConnection, useMidiInput } from "../contexts/midi";
import { useSynth } from "../hooks/useSynth";
import { nextEarNote } from "../lib/ear";
import { type MidiNoteEvent, noteName } from "../lib/midi";
import { m } from "../paraglide/messages.js";
import { KeyboardHint } from "./keyboardHint";
import { PianoKeyboard } from "./pianoKeyboard";

type Status = "idle" | "listening" | "correct";

export function EarTrainer() {
    const synth = useSynth();
    const [target, setTarget] = useState<number | null>(null);
    const [status, setStatus] = useState<Status>("idle");
    const [correct, setCorrect] = useState(0);
    const [attempts, setAttempts] = useState(0);
    const [wrong, setWrong] = useState<number | null>(null);

    // Refs keep the input handler reading current values without re-subscribing.
    const targetRef = useRef<number | null>(null);
    const lockRef = useRef(false);

    const playTarget = useCallback(
        (note: number) => synth.playNote(note, { duration: 1.4 }),
        [synth],
    );

    const nextRound = useCallback(
        (previous?: number) => {
            const note = nextEarNote(Math.random, previous);
            targetRef.current = note;
            setTarget(note);
            setWrong(null);
            setStatus("listening");
            lockRef.current = false;
            playTarget(note);
        },
        [playTarget],
    );

    const start = useCallback(() => {
        setCorrect(0);
        setAttempts(0);
        nextRound();
    }, [nextRound]);

    const handleNoteOn = useCallback(
        (played: MidiNoteEvent) => {
            if (status !== "listening" || lockRef.current || targetRef.current === null) {
                return;
            }
            setAttempts((value) => value + 1);
            // Match by pitch class, so any octave of the right note counts — the
            // ear, not the keyboard register, is what is being trained.
            if (played.note % 12 === targetRef.current % 12) {
                synth.playNote(targetRef.current);
                setCorrect((value) => value + 1);
                setStatus("correct");
                lockRef.current = true;
                const previous = targetRef.current;
                window.setTimeout(() => nextRound(previous), 800);
            } else {
                setWrong(played.note);
                synth.playNote(played.note, { duration: 0.4 });
            }
        },
        [status, synth, nextRound],
    );

    const {
        support,
        status: midiStatus,
        devices,
        octaveOffset,
        requestAccess,
    } = useMidiConnection();
    useMidiInput({ onNoteOn: handleNoteOn });
    const connected = midiStatus === "ready" && devices.length > 0;
    const accuracy = attempts > 0 ? Math.round((100 * correct) / attempts) : 100;

    return (
        <section className="mx-auto max-w-3xl space-y-6 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.ear_heading()}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{m.ear_intro()}</p>
            </header>

            {support === "unsupported" && (
                <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    {m.midi_unsupported_keyboard()}
                </p>
            )}

            {!connected && support !== "unsupported" && (
                <button
                    type="button"
                    onClick={requestAccess}
                    disabled={support !== "supported" || midiStatus === "requesting"}
                    className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 disabled:opacity-40 dark:bg-gray-800 dark:text-gray-300"
                >
                    {midiStatus === "requesting" ? m.midi_connecting() : m.midi_connect()}
                </button>
            )}

            <div className="flex items-center gap-4">
                {status === "idle" ? (
                    <button
                        type="button"
                        onClick={start}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
                    >
                        {m.ear_start()}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => target !== null && playTarget(target)}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
                    >
                        {m.ear_hear_again()}
                    </button>
                )}
                {attempts > 0 && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-mono">{correct}</span>/
                        <span className="font-mono">{attempts}</span> {m.sprint_correct_label()} ·{" "}
                        <span className="font-mono">{accuracy}%</span>
                    </span>
                )}
            </div>

            {status === "listening" && (
                <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                    {m.ear_which_note()}
                    {wrong !== null && (
                        <span className="ml-2 text-red-600">
                            {m.ear_not_note({ note: noteName(wrong) })}
                        </span>
                    )}
                </p>
            )}
            {status === "correct" && target !== null && (
                <p className="text-sm font-semibold text-green-600">
                    {m.ear_correct({ note: noteName(target) })}
                </p>
            )}

            <PianoKeyboard expected={[]} />

            <KeyboardHint octaveOffset={octaveOffset} />
        </section>
    );
}
