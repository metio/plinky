// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useRef, useState } from "react";
import type { NoteTimingEvent, TuneObject } from "abcjs";
import { AbcRenderer } from "./abcRenderer";
import { BeatIndicator } from "./beatIndicator";
import { KeyboardHint } from "./keyboardHint";
import { useMidiConnection, useMidiInput } from "../contexts/midi";
import { noteName, type MidiNoteEvent } from "../lib/midi";
import { useMetronome } from "../hooks/useMetronome";
import { useSynth } from "../hooks/useSynth";
import { expectedPitches, useNoteMatcher } from "../hooks/useNoteMatcher";
import { loadBest, saveBest, scoreFor, type TrialResult } from "../lib/scores";
import type { Exercise } from "../lib/exercises";

type RunState = "idle" | "counting" | "armed" | "running" | "finished";

function formatMs(ms: number): string {
    return `${(ms / 1000).toFixed(2)}s`;
}

export function TimeTrial({ exercise }: { exercise: Exercise }) {
    const [events, setEvents] = useState<NoteTimingEvent[]>([]);
    const [runState, setRunState] = useState<RunState>("idle");
    const [errors, setErrors] = useState(0);
    const [elapsedMs, setElapsedMs] = useState(0);
    const [result, setResult] = useState<TrialResult | null>(null);
    const [best, setBest] = useState<TrialResult | null>(null);
    const [isRecord, setIsRecord] = useState(false);

    // Timestamps come from the input event (the performance.now() time domain),
    // so the clock measures input-to-input latency, not render time.
    const startRef = useRef(0);
    const errorsRef = useRef(0);

    const handleRender = useCallback((tune: TuneObject) => {
        const timed = tune
            .setupEvents(0, 1000, 120)
            .filter((event) => event.type === "event" && expectedPitches(event).length > 0);
        setEvents(timed);
    }, []);

    useEffect(() => {
        setBest(loadBest(exercise.id));
    }, [exercise.id]);

    const synth = useSynth();

    const handleCorrect = useCallback(
        (index: number, timestamp: number) => {
            synth.playNote(expectedPitches(events[index])[0]);
            // The clock starts on the first correct note, so reaction time before
            // the run does not count against the player.
            if (index === 0) {
                startRef.current = timestamp;
                setElapsedMs(0);
                setRunState("running");
            }
        },
        [synth, events],
    );

    const handleWrong = useCallback(() => {
        errorsRef.current += 1;
        setErrors(errorsRef.current);
    }, []);

    const handleComplete = useCallback(
        (timestamp: number) => {
            const timeMs = timestamp - startRef.current;
            const finished: TrialResult = {
                timeMs,
                errors: errorsRef.current,
                score: scoreFor(timeMs, errorsRef.current),
                at: new Date().toISOString(),
            };
            setResult(finished);
            setRunState("finished");
            setBest((prevBest) => {
                if (!prevBest || finished.score < prevBest.score) {
                    saveBest(exercise.id, finished);
                    setIsRecord(true);
                    return finished;
                }
                setIsRecord(false);
                return prevBest;
            });
        },
        [exercise.id],
    );

    const metronome = useMetronome();

    const active = runState === "armed" || runState === "running";
    const matcher = useNoteMatcher(events, {
        active,
        onCorrect: handleCorrect,
        onWrong: handleWrong,
        onComplete: handleComplete,
    });

    const handleNoteOn = useCallback(
        (played: MidiNoteEvent) => matcher.registerNote(played.note, played.timestamp),
        [matcher],
    );

    const { support, status, devices, octaveOffset, requestAccess } = useMidiConnection();
    useMidiInput({ onNoteOn: handleNoteOn });

    // Live clock while a run is in progress. The finished view reads the exact
    // recorded time instead, so a late interval tick cannot inflate the result.
    useEffect(() => {
        if (runState !== "running") {
            return;
        }
        const id = setInterval(() => setElapsedMs(performance.now() - startRef.current), 50);
        return () => clearInterval(id);
    }, [runState]);

    const start = useCallback(() => {
        matcher.reset();
        errorsRef.current = 0;
        startRef.current = 0;
        setErrors(0);
        setElapsedMs(0);
        setResult(null);
        setIsRecord(false);
        // Count in one full bar at the exercise tempo, then arm the run; the
        // clock still starts on the player's first note.
        setRunState("counting");
        metronome.countIn(
            exercise.tempo,
            exercise.beatsPerBar,
            () => setRunState("armed"),
            exercise.beatsPerBar,
        );
    }, [matcher, metronome, exercise.tempo, exercise.beatsPerBar]);

    const connected = status === "ready" && devices.length > 0;
    const liveTime = runState === "finished" && result ? result.timeMs : elapsedMs;

    return (
        <section className="mx-auto max-w-3xl space-y-6 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">Time trial · {exercise.title}</h1>
                <p className="text-sm text-gray-500">
                    Play the phrase as fast and cleanly as you can. The clock starts on your first
                    note.
                </p>
            </header>

            {support === "unsupported" && (
                <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    This browser does not expose the Web MIDI API. Use Chrome, Edge, or Firefox on
                    desktop or Android — or play with your computer keyboard below.
                </p>
            )}

            {!connected && support !== "unsupported" && (
                <button
                    type="button"
                    onClick={requestAccess}
                    disabled={support !== "supported" || status === "requesting"}
                    className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 disabled:opacity-40"
                >
                    {status === "requesting" ? "Connecting…" : "Connect MIDI"}
                </button>
            )}

            <div className="flex items-end gap-8">
                <div>
                    <div className="text-xs uppercase tracking-wide text-gray-400">Time</div>
                    <div className="font-mono text-4xl tabular-nums">{formatMs(liveTime)}</div>
                </div>
                <div>
                    <div className="text-xs uppercase tracking-wide text-gray-400">Errors</div>
                    <div className="font-mono text-4xl tabular-nums">{errors}</div>
                </div>
                <div>
                    <div className="text-xs uppercase tracking-wide text-gray-400">Progress</div>
                    <div className="font-mono text-4xl tabular-nums">
                        {Math.min(matcher.cursor, events.length)}/{events.length}
                    </div>
                </div>
            </div>

            {runState === "idle" && (
                <button
                    type="button"
                    onClick={start}
                    disabled={events.length === 0}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                    Start time trial
                </button>
            )}

            {runState === "counting" && (
                <div className="flex items-center gap-3 text-sm font-medium text-indigo-700">
                    <span>Count-in…</span>
                    <BeatIndicator beat={metronome.beat} beatsPerBar={exercise.beatsPerBar} />
                </div>
            )}

            {runState === "armed" && (
                <p className="text-sm font-medium text-indigo-700">
                    Ready — play{" "}
                    <span className="font-mono">{noteName(matcher.nextPitch ?? 0)}</span> to start
                    the clock.
                </p>
            )}

            {runState === "running" && matcher.wrongNote !== null && (
                <p className="text-sm font-medium text-red-600">✗ {noteName(matcher.wrongNote)}</p>
            )}

            {runState === "finished" && result && (
                <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-4">
                    {isRecord ? (
                        <p className="text-lg font-semibold text-green-600">New record! 🏆</p>
                    ) : (
                        <p className="text-lg font-semibold">Done!</p>
                    )}
                    <p className="text-sm text-gray-600">
                        {formatMs(result.timeMs)} · {result.errors}{" "}
                        {result.errors === 1 ? "error" : "errors"} · score {formatMs(result.score)}
                    </p>
                    <button
                        type="button"
                        onClick={start}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
                    >
                        Try again
                    </button>
                </div>
            )}

            {best && (
                <p className="text-sm text-gray-500">
                    Best: <span className="font-mono">{formatMs(best.score)}</span> (
                    {formatMs(best.timeMs)}, {best.errors} {best.errors === 1 ? "error" : "errors"})
                </p>
            )}

            <div className="rounded-md border border-gray-200 p-4">
                <AbcRenderer abcTune={exercise.abc} onRender={handleRender} />
            </div>

            <KeyboardHint octaveOffset={octaveOffset} />
        </section>
    );
}
