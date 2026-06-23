// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { TuneObject } from "abcjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMidiConnection, useMidiInput } from "../contexts/midi";
import { type CorrectInfo, useHandsMatcher } from "../hooks/useHandsMatcher";
import { useSynth } from "../hooks/useSynth";
import { barIndex, buildRegion, regionSpanMs, totalBars } from "../lib/bars";
import type { Exercise } from "../lib/exercises";
import { buildHands, type Hand } from "../lib/hands";
import { recordPractice } from "../lib/history";
import { type MidiNoteEvent, noteName } from "../lib/midi";
import { AbcRenderer } from "./abcRenderer";
import { KeyboardHint } from "./keyboardHint";
import { PianoKeyboard } from "./pianoKeyboard";

type Rep = { bpm: number; accuracy: number; correct: number; wrong: number };

function Stepper({
    label,
    value,
    min,
    max,
    disabled,
    onChange,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    disabled: boolean;
    onChange: (next: number) => void;
}) {
    const button =
        "h-7 w-7 rounded-md border border-gray-300 text-sm font-medium text-gray-700 disabled:opacity-30 dark:border-gray-700 dark:text-gray-300";
    return (
        <div className="flex items-center gap-1">
            <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
            <button
                type="button"
                className={button}
                disabled={disabled || value <= min}
                onClick={() => onChange(value - 1)}
            >
                −
            </button>
            <span className="w-6 text-center font-mono tabular-nums">{value + 1}</span>
            <button
                type="button"
                className={button}
                disabled={disabled || value >= max}
                onClick={() => onChange(value + 1)}
            >
                +
            </button>
        </div>
    );
}

export function LoopTrainer({ exercise }: { exercise: Exercise }) {
    const [allHands, setAllHands] = useState<Hand[]>([]);
    const [fromBar, setFromBar] = useState(0);
    const [toBar, setToBar] = useState(0);
    const [running, setRunning] = useState(false);
    const [reps, setReps] = useState<Rep[]>([]);

    const onsetRef = useRef(0);
    const lastTsRef = useRef(0);
    const correctRef = useRef(0);
    const wrongRef = useRef(0);
    // The first bar of a two-tap range selection on the score, or null when the
    // next tap starts a fresh selection.
    const anchorRef = useRef<number | null>(null);

    const synth = useSynth();

    const handleRender = useCallback(
        (tune: TuneObject) => setAllHands(buildHands(tune, exercise.tempo)),
        [exercise.tempo],
    );

    const bars = totalBars(allHands, exercise.beatsPerBar, exercise.tempo);

    // Default the loop to the first four bars once the score is known.
    useEffect(() => {
        if (bars > 0) {
            setFromBar(0);
            setToBar(Math.min(3, bars - 1));
        }
    }, [bars]);

    const region = useMemo(
        () => buildRegion(allHands, fromBar, toBar, exercise.beatsPerBar, exercise.tempo),
        [allHands, fromBar, toBar, exercise.beatsPerBar, exercise.tempo],
    );
    const span = regionSpanMs(region);

    const handleCorrect = useCallback(
        (info: CorrectInfo) => {
            for (const pitch of info.pitches) {
                synth.playNote(pitch);
            }
            correctRef.current += 1;
            lastTsRef.current = info.timestamp;
            if (info.ordinal === 0) {
                onsetRef.current = info.timestamp;
            }
        },
        [synth],
    );

    const handleWrong = useCallback(() => {
        wrongRef.current += 1;
    }, []);

    const matcher = useHandsMatcher(region, {
        active: running,
        onCorrect: handleCorrect,
        onWrong: handleWrong,
    });

    // Each time the region is completed, log a rep and restart it — this is the
    // cycle: play the bars, see how you did, go again.
    useEffect(() => {
        if (!running || !matcher.done) {
            return;
        }
        const actual = lastTsRef.current - onsetRef.current;
        const correct = correctRef.current;
        const wrong = wrongRef.current;
        const bpm = actual > 0 && span > 0 ? Math.round((exercise.tempo * span) / actual) : 0;
        const accuracy =
            correct + wrong > 0 ? Math.round((100 * correct) / (correct + wrong)) : 100;
        setReps((previous) => [...previous, { bpm, accuracy, correct, wrong }]);
        recordPractice(correct);
        correctRef.current = 0;
        wrongRef.current = 0;
        onsetRef.current = 0;
        matcher.reset();
    }, [running, matcher.done, matcher.reset, span, exercise.tempo]);

    // Let the player tap notes on the score to set the loop range: the first tap
    // anchors one end, the next sets the other. Only while idle, so taps during a
    // run can't move the goalposts.
    useEffect(() => {
        if (running) {
            return;
        }
        const cleanups: (() => void)[] = [];
        for (const hand of allHands) {
            for (const step of hand.steps) {
                const bar = barIndex(step.timeMs, exercise.beatsPerBar, exercise.tempo);
                const onClick = () => {
                    if (anchorRef.current === null) {
                        anchorRef.current = bar;
                        setFromBar(bar);
                        setToBar(bar);
                    } else {
                        setFromBar(Math.min(anchorRef.current, bar));
                        setToBar(Math.max(anchorRef.current, bar));
                        anchorRef.current = null;
                    }
                };
                for (const element of step.elements) {
                    element.style.cursor = "pointer";
                    element.addEventListener("click", onClick);
                    cleanups.push(() => {
                        element.removeEventListener("click", onClick);
                        element.style.cursor = "";
                    });
                }
            }
        }
        return () => {
            for (const cleanup of cleanups) {
                cleanup();
            }
        };
    }, [allHands, running, exercise.beatsPerBar, exercise.tempo]);

    const handleNoteOn = useCallback(
        (played: MidiNoteEvent) =>
            matcher.registerNote(played.note, played.timestamp, played.velocity),
        [matcher],
    );

    const { support, status, devices, octaveOffset, requestAccess } = useMidiConnection();
    useMidiInput({ onNoteOn: handleNoteOn });

    const start = useCallback(() => {
        correctRef.current = 0;
        wrongRef.current = 0;
        onsetRef.current = 0;
        anchorRef.current = null;
        setReps([]);
        matcher.reset();
        setRunning(true);
    }, [matcher]);

    const nextSection = useCallback(() => {
        const size = toBar - fromBar + 1;
        const nextFrom = toBar + 1 >= bars ? 0 : toBar + 1;
        setFromBar(nextFrom);
        setToBar(Math.min(nextFrom + size - 1, bars - 1));
    }, [fromBar, toBar, bars]);

    const connected = status === "ready" && devices.length > 0;
    const lastRep = reps[reps.length - 1] ?? null;
    const bestBpm = reps.reduce((best, rep) => Math.max(best, rep.bpm), 0);

    return (
        <section className="mx-auto max-w-3xl space-y-6 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">Loop · {exercise.title}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Pick a few bars and play them on repeat until they stick. Each lap is timed and
                    scored so you can watch yourself speed up and clean up.
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
                    className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 disabled:opacity-40 dark:bg-gray-800 dark:text-gray-300"
                >
                    {status === "requesting" ? "Connecting…" : "Connect MIDI"}
                </button>
            )}

            <div className="flex flex-wrap items-center gap-4">
                <Stepper
                    label="From bar"
                    value={fromBar}
                    min={0}
                    max={toBar}
                    disabled={running}
                    onChange={setFromBar}
                />
                <Stepper
                    label="To bar"
                    value={toBar}
                    min={fromBar}
                    max={Math.max(0, bars - 1)}
                    disabled={running}
                    onChange={setToBar}
                />
                <button
                    type="button"
                    onClick={nextSection}
                    disabled={running || bars === 0}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
                >
                    Next section
                </button>
                {running ? (
                    <button
                        type="button"
                        onClick={() => setRunning(false)}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
                    >
                        Stop
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={start}
                        disabled={matcher.totalSteps === 0}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                    >
                        Start looping
                    </button>
                )}
            </div>

            {!running && bars > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Looping bars {fromBar + 1}–{toBar + 1}. Tap a note on the score to start a
                    range, then tap another to set its end.
                </p>
            )}

            {running && (
                <p className="text-sm text-indigo-700 dark:text-indigo-300">
                    Lap {reps.length + 1} — play{" "}
                    <span className="font-mono">
                        {noteName(region[0]?.steps[matcher.completedSteps]?.pitches[0] ?? 0)}
                    </span>
                    …
                </p>
            )}

            {reps.length > 0 && (
                <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        {reps.length} {reps.length === 1 ? "lap" : "laps"} · last{" "}
                        <span className="font-mono">{lastRep?.bpm || "—"}</span> bpm at{" "}
                        <span className="font-mono">{lastRep?.accuracy}%</span> · best{" "}
                        <span className="font-mono">{bestBpm || "—"}</span> bpm
                    </p>
                    <div className="flex flex-wrap gap-1">
                        {reps.map((rep, index) => (
                            <span
                                // biome-ignore lint/suspicious/noArrayIndexKey: laps are an append-only ordered log
                                key={index}
                                className="rounded bg-white px-2 py-0.5 font-mono text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                                title={`${rep.correct} correct, ${rep.wrong} wrong`}
                            >
                                {rep.bpm || "—"}bpm·{rep.accuracy}%
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div className="rounded-md border border-gray-200 p-4 dark:border-gray-800">
                <AbcRenderer abcTune={exercise.abc} onRender={handleRender} />
            </div>

            <PianoKeyboard expected={matcher.nextByHand.flatMap((hand) => hand.pitches)} />

            <KeyboardHint octaveOffset={octaveOffset} />
        </section>
    );
}
