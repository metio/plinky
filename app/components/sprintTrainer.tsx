// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { TuneObject } from "abcjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMidiConnection, useMidiInput } from "../contexts/midi";
import { type CorrectInfo, useHandsMatcher } from "../hooks/useHandsMatcher";
import { useSynth } from "../hooks/useSynth";
import { generatePhrase } from "../lib/generator";
import { buildHands, type Hand } from "../lib/hands";
import { type MidiNoteEvent, noteName } from "../lib/midi";
import { loadBestSprint, saveBestSprint, type SprintBest } from "../lib/scores";
import { AbcRenderer } from "./abcRenderer";
import { KeyboardHint } from "./keyboardHint";
import { PianoKeyboard } from "./pianoKeyboard";

// Notation only; the score is correct notes in real time, so the tempo just sets
// the rendered timing. Enough bars to outlast the longest sprint at a brisk pace.
const SPRINT_TEMPO = 90;
const BEATS_PER_BAR = 4;
const BARS_PER_MINUTE = 16;
const MAX_BARS = 48;
const DURATIONS = [1, 2, 3];

type RunState = "idle" | "armed" | "running" | "finished";

function formatClock(ms: number): string {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function SprintTrainer() {
    const [durationMin, setDurationMin] = useState(2);
    const [twoHands, setTwoHands] = useState(false);
    const [abc, setAbc] = useState<string | null>(null);
    const [allHands, setAllHands] = useState<Hand[]>([]);
    const [runState, setRunState] = useState<RunState>("idle");
    const [remainingMs, setRemainingMs] = useState(0);
    const [result, setResult] = useState<{ correct: number; wrong: number } | null>(null);
    const [best, setBest] = useState<SprintBest | null>(null);
    const [isRecord, setIsRecord] = useState(false);

    const startRef = useRef(0);
    const correctRef = useRef(0);
    const wrongRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const config = `${durationMin}m-${twoHands ? "2h" : "1h"}`;
    useEffect(() => {
        setBest(loadBestSprint(config));
    }, [config]);

    const stopTimer = useCallback(() => {
        if (timerRef.current !== null) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const finish = useCallback(() => {
        stopTimer();
        setRemainingMs(0);
        setRunState("finished");
        const correct = correctRef.current;
        setResult({ correct, wrong: wrongRef.current });
        setBest((prev) => {
            if (!prev || correct > prev.correct) {
                const record: SprintBest = { correct, at: new Date().toISOString() };
                saveBestSprint(config, record);
                setIsRecord(true);
                return record;
            }
            setIsRecord(false);
            return prev;
        });
    }, [stopTimer, config]);

    const synth = useSynth();

    const handleRender = useCallback(
        (tune: TuneObject) => setAllHands(buildHands(tune, SPRINT_TEMPO)),
        [],
    );

    const handleCorrect = useCallback(
        (info: CorrectInfo) => {
            for (const pitch of info.pitches) {
                synth.playNote(pitch);
            }
            correctRef.current += 1;
            // The clock starts on the first note, then counts down the sprint.
            if (info.ordinal === 0) {
                startRef.current = info.timestamp;
                setRunState("running");
                const durationMs = durationMin * 60000;
                stopTimer();
                timerRef.current = setInterval(() => {
                    const remaining = durationMs - (performance.now() - startRef.current);
                    if (remaining <= 0) {
                        finish();
                    } else {
                        setRemainingMs(remaining);
                    }
                }, 100);
            }
        },
        [synth, durationMin, stopTimer, finish],
    );

    const handleWrong = useCallback(() => {
        wrongRef.current += 1;
    }, []);

    const active = runState === "armed" || runState === "running";
    const matcher = useHandsMatcher(allHands, {
        active,
        onCorrect: handleCorrect,
        onWrong: handleWrong,
        // Running out of notation before time is up ends the sprint early.
        onComplete: finish,
    });

    const handleNoteOn = useCallback(
        (played: MidiNoteEvent) => matcher.registerNote(played.note, played.timestamp),
        [matcher],
    );

    const { support, status, devices, octaveOffset, requestAccess } = useMidiConnection();
    useMidiInput({ onNoteOn: handleNoteOn });

    const start = useCallback(() => {
        correctRef.current = 0;
        wrongRef.current = 0;
        startRef.current = 0;
        setResult(null);
        setIsRecord(false);
        setRemainingMs(durationMin * 60000);
        const bars = Math.min(durationMin * BARS_PER_MINUTE, MAX_BARS);
        setAbc(generatePhrase({ bars, beatsPerBar: BEATS_PER_BAR, twoHands }));
        setRunState("armed");
    }, [durationMin, twoHands]);

    useEffect(() => stopTimer, [stopTimer]);

    const connected = status === "ready" && devices.length > 0;
    const accuracy =
        result && result.correct + result.wrong > 0
            ? Math.round((100 * result.correct) / (result.correct + result.wrong))
            : 100;

    return (
        <section className="mx-auto max-w-3xl space-y-6 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">Sight-reading sprint</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Fresh notes every run. Play as many correctly as you can before the timer runs
                    out — the clock starts on your first note.
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
                    className="rounded-md bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 disabled:opacity-40"
                >
                    {status === "requesting" ? "Connecting…" : "Connect MIDI"}
                </button>
            )}

            {runState === "idle" && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Length
                        </span>
                        {DURATIONS.map((minutes) => (
                            <button
                                key={minutes}
                                type="button"
                                onClick={() => setDurationMin(minutes)}
                                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                                    durationMin === minutes
                                        ? "bg-indigo-600 text-white"
                                        : "border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                                }`}
                            >
                                {minutes} min
                            </button>
                        ))}
                        <label className="ml-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <input
                                type="checkbox"
                                checked={twoHands}
                                onChange={(event) => setTwoHands(event.target.checked)}
                            />
                            Two hands
                        </label>
                    </div>
                    <button
                        type="button"
                        onClick={start}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
                    >
                        Start sprint
                    </button>
                </div>
            )}

            {(runState === "armed" || runState === "running") && (
                <div className="flex items-end gap-8">
                    <div>
                        <div className="text-xs uppercase tracking-wide text-gray-400">
                            Time left
                        </div>
                        <div className="font-mono text-4xl tabular-nums">
                            {formatClock(runState === "armed" ? durationMin * 60000 : remainingMs)}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs uppercase tracking-wide text-gray-400">Correct</div>
                        <div className="font-mono text-4xl tabular-nums">
                            {matcher.completedSteps}
                        </div>
                    </div>
                    {runState === "armed" && (
                        <p className="pb-2 text-sm font-medium text-indigo-700 dark:text-indigo-300">
                            Play{" "}
                            <span className="font-mono">
                                {noteName(allHands[0]?.steps[0]?.pitches[0] ?? 0)}
                            </span>{" "}
                            to start.
                        </p>
                    )}
                </div>
            )}

            {runState === "finished" && result && (
                <div className="space-y-2 rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-4">
                    <p className="text-lg font-semibold">{isRecord ? "New best! 🏆" : "Time!"}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        <span className="font-mono">{result.correct}</span> correct ·{" "}
                        <span className="font-mono">{accuracy}%</span> accuracy ·{" "}
                        <span className="text-red-600">{result.wrong} wrong</span>
                    </p>
                    <button
                        type="button"
                        onClick={start}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
                    >
                        Go again
                    </button>
                </div>
            )}

            {best && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Best for {durationMin} min {twoHands ? "(two hands)" : "(one hand)"}:{" "}
                    <span className="font-mono">{best.correct}</span> correct
                </p>
            )}

            {abc && (
                <div className="rounded-md border border-gray-200 dark:border-gray-800 p-4">
                    <AbcRenderer abcTune={abc} onRender={handleRender} />
                </div>
            )}

            <PianoKeyboard expected={matcher.nextByHand.flatMap((hand) => hand.pitches)} />

            <KeyboardHint octaveOffset={octaveOffset} />
        </section>
    );
}
