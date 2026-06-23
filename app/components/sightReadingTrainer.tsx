// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import {useCallback, useState} from "react";
import type {NoteTimingEvent, TuneObject} from "abcjs";
import {AbcRenderer} from "./abcRenderer";
import {BeatIndicator} from "./beatIndicator";
import {KeyboardHint} from "./keyboardHint";
import {useMidiConnection, useMidiInput} from "../contexts/midi";
import {noteName, type MidiNoteEvent} from "../lib/midi";
import {useMetronome} from "../hooks/useMetronome";
import {useSynth} from "../hooks/useSynth";
import {expectedPitches, useNoteMatcher} from "../hooks/useNoteMatcher";
import type {Exercise} from "../lib/exercises";

export function SightReadingTrainer({exercise}: {exercise: Exercise}) {
    const [events, setEvents] = useState<NoteTimingEvent[]>([]);
    const [bpm, setBpm] = useState(exercise.tempo);
    const metronome = useMetronome();

    const toggleMetronome = useCallback(() => {
        if (metronome.running) {
            metronome.stop();
        } else {
            metronome.startMetronome(bpm, exercise.beatsPerBar);
        }
    }, [metronome, bpm, exercise.beatsPerBar]);

    const changeTempo = useCallback(
        (value: number) => {
            setBpm(value);
            metronome.setTempo(value);
        },
        [metronome],
    );

    const handleRender = useCallback((tune: TuneObject) => {
        // setupEvents must run after the SVG exists so each event's `elements`
        // point at live nodes; the bpm argument only affects timing we ignore.
        const timed = tune
            .setupEvents(0, 1000, 120)
            .filter((event) => event.type === "event" && expectedPitches(event).length > 0);
        setEvents(timed);
    }, []);

    const synth = useSynth();

    const handleCorrect = useCallback(
        (index: number) => synth.playNote(expectedPitches(events[index])[0]),
        [synth, events],
    );

    const matcher = useNoteMatcher(events, {onCorrect: handleCorrect});

    const handleNoteOn = useCallback(
        (played: MidiNoteEvent) => matcher.registerNote(played.note, played.timestamp),
        [matcher],
    );

    const {support, status, devices, octaveOffset, requestAccess} = useMidiConnection();
    useMidiInput({onNoteOn: handleNoteOn});

    const connected = status === "ready" && devices.length > 0;

    return (
        <section className="mx-auto max-w-3xl space-y-6 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{exercise.title}</h1>
                <p className="text-sm text-gray-500">
                    Play the highlighted note. The cursor advances when you hit the right key.
                </p>
            </header>

            {support === "unsupported" && (
                <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    This browser does not expose the Web MIDI API. Use Chrome, Edge, or Firefox on
                    desktop or Android.
                </p>
            )}

            {!connected && support !== "unsupported" && (
                <button
                    type="button"
                    onClick={requestAccess}
                    disabled={support !== "supported" || status === "requesting"}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                    {status === "requesting" ? "Connecting…" : "Connect MIDI"}
                </button>
            )}

            <div className="flex flex-wrap items-center gap-4">
                <button
                    type="button"
                    onClick={toggleMetronome}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700"
                >
                    {metronome.running ? "Stop metronome" : "Metronome"}
                </button>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                    Tempo
                    <input
                        type="range"
                        min={40}
                        max={208}
                        value={bpm}
                        onChange={(event) => changeTempo(Number(event.target.value))}
                    />
                    <span className="w-16 font-mono">{bpm} bpm</span>
                </label>
                {metronome.running && (
                    <BeatIndicator beat={metronome.beat} beatsPerBar={exercise.beatsPerBar} />
                )}
            </div>

            <div className="flex items-center gap-6">
                <div className="text-sm">
                    <span className="font-medium">Progress:</span>{" "}
                    {Math.min(matcher.cursor, events.length)} / {events.length}
                </div>
                {matcher.done ? (
                    <div className="text-sm font-semibold text-green-600">Complete! 🎉</div>
                ) : (
                    matcher.nextPitch !== undefined && (
                        <div className="text-sm">
                            <span className="font-medium">Next:</span>{" "}
                            <span className="font-mono text-indigo-700">{noteName(matcher.nextPitch)}</span>
                        </div>
                    )
                )}
                {matcher.wrongNote !== null && (
                    <div className="text-sm font-medium text-red-600">✗ {noteName(matcher.wrongNote)}</div>
                )}
            </div>

            <div className="rounded-md border border-gray-200 p-4">
                <AbcRenderer abcTune={exercise.abc} onRender={handleRender} />
            </div>

            <KeyboardHint octaveOffset={octaveOffset} />

            <button
                type="button"
                onClick={matcher.reset}
                disabled={matcher.cursor === 0}
                className="text-sm text-gray-500 underline disabled:opacity-40"
            >
                Restart
            </button>
        </section>
    );
}
