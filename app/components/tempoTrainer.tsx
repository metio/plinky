// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { TuneObject } from "abcjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMidiConnection, useMidiInput } from "../contexts/midi";
import { type CorrectInfo, describeNext, useHandsMatcher } from "../hooks/useHandsMatcher";
import { useSynth } from "../hooks/useSynth";
import { useRecordOnFinish } from "../hooks/usePracticeLog";
import type { Exercise } from "../lib/exercises";
import { buildHands, type Hand } from "../lib/hands";
import { type MidiNoteEvent, noteName } from "../lib/midi";
import {
    findHotspots,
    type Hotspot,
    instantaneousBpm,
    median,
    type TempoPoint,
    tempoSeries,
} from "../lib/tempo";
import { m } from "../paraglide/messages.js";
import { AbcRenderer } from "./abcRenderer";
import { HandSelector, useHandSelection } from "./handSelector";
import { KeyboardHint } from "./keyboardHint";
import { PianoKeyboard } from "./pianoKeyboard";
import { TempoGraph } from "./tempoGraph";

const HOTSPOT_COLOR = "#dc2626"; // red-600 — a note inside a slow stretch
// Weight for the live bpm readout: high enough to react, low enough to not jump.
const SMOOTHING = 0.4;

type RunState = "idle" | "armed" | "running" | "finished";

type Note = { hand: number; timeMs: number; timestamp: number; elements: HTMLElement[] };

type HandStat = { label: string; median: number; hotspots: Hotspot[]; points: TempoPoint[] };

// Line colours for the per-hand tempo curves, by hand index.
const HAND_COLORS = ["#4f46e5", "#ea580c"];

type Result = {
    points: TempoPoint[];
    median: number;
    hotspots: Hotspot[];
    handStats: HandStat[];
};

function describeHotspots(hotspots: Hotspot[]): string {
    if (hotspots.length === 0) {
        return m.tempo_steady();
    }
    const ranges = hotspots
        .map((hotspot) =>
            hotspot.startIndex === hotspot.endIndex
                ? m.tempo_note({ n: hotspot.startIndex + 1 })
                : m.tempo_notes({ from: hotspot.startIndex + 1, to: hotspot.endIndex + 1 }),
        )
        .join(", ");
    return m.tempo_slowed({ ranges });
}

export function TempoTrainer({ exercise }: { exercise: Exercise }) {
    const [allHands, setAllHands] = useState<Hand[]>([]);
    const { hands, choice, setChoice } = useHandSelection(allHands);
    const [runState, setRunState] = useState<RunState>("idle");
    const [liveBpm, setLiveBpm] = useState<number | null>(null);
    const [result, setResult] = useState<Result | null>(null);

    // Each correct note recorded in completion order; the smoothed value powers
    // the live readout without re-rendering on a ref change.
    const notesRef = useRef<Note[]>([]);
    const smoothedRef = useRef(0);

    const synth = useSynth();

    const handleRender = useCallback(
        (tune: TuneObject) => setAllHands(buildHands(tune, exercise.tempo)),
        [exercise.tempo],
    );

    const handleCorrect = useCallback(
        (info: CorrectInfo) => {
            for (const pitch of info.pitches) {
                synth.playNote(pitch);
            }
            notesRef.current[info.ordinal] = {
                hand: info.hand,
                timeMs: info.timeMs,
                timestamp: info.timestamp,
                elements: info.elements,
            };
            if (info.ordinal === 0) {
                setRunState("running");
                setLiveBpm(null);
                return;
            }
            const previous = notesRef.current[info.ordinal - 1]!;
            const notatedGap = info.timeMs - previous.timeMs;
            const actualGap = info.timestamp - previous.timestamp;
            const bpm = instantaneousBpm(exercise.tempo, notatedGap, actualGap);
            smoothedRef.current =
                liveBpm === null ? bpm : SMOOTHING * bpm + (1 - SMOOTHING) * smoothedRef.current;
            setLiveBpm(Math.round(smoothedRef.current));
        },
        [synth, exercise.tempo, liveBpm],
    );

    const handleComplete = useCallback(() => {
        const seriesFor = (notes: Note[]) => {
            const points = tempoSeries(
                exercise.tempo,
                notes.map((note) => note.timeMs),
                notes.map((note) => note.timestamp),
            );
            const med = median(points.map((point) => point.bpm));
            return { points, median: med, hotspots: findHotspots(points, med) };
        };
        const all = notesRef.current;
        const combined = seriesFor(all);
        // When both hands played, chart the combined curve but report each hand's
        // own tempo so a dragging hand stands out.
        const handStats: HandStat[] =
            hands.length > 1
                ? hands.map((hand) => {
                      const series = seriesFor(all.filter((note) => note.hand === hand.staff));
                      return {
                          label: hand.label,
                          median: series.median,
                          hotspots: series.hotspots,
                          points: series.points,
                      };
                  })
                : [];
        setResult({ ...combined, handStats });
        setRunState("finished");
    }, [exercise.tempo, hands]);

    const active = runState === "armed" || runState === "running";
    const matcher = useHandsMatcher(hands, {
        active,
        onCorrect: handleCorrect,
        onComplete: handleComplete,
    });

    useRecordOnFinish(runState === "finished", matcher.completedSteps);
    const handleNoteOn = useCallback(
        (played: MidiNoteEvent) =>
            matcher.registerNote(played.note, played.timestamp, played.velocity),
        [matcher],
    );

    const { support, status, devices, octaveOffset, requestAccess } = useMidiConnection();
    useMidiInput({ onNoteOn: handleNoteOn });

    // Overlay the hotspots in red once a run finishes. The matcher's own painting
    // settled on the final cursors before this runs, so the red overlay sticks.
    useEffect(() => {
        if (!result) {
            return;
        }
        for (const hotspot of result.hotspots) {
            for (let i = hotspot.startIndex; i <= hotspot.endIndex; i++) {
                for (const element of notesRef.current[i]?.elements ?? []) {
                    element.style.fill = HOTSPOT_COLOR;
                }
            }
        }
    }, [result]);

    const start = useCallback(() => {
        matcher.reset();
        notesRef.current = [];
        smoothedRef.current = 0;
        setLiveBpm(null);
        setResult(null);
        setRunState("armed");
    }, [matcher]);

    const connected = status === "ready" && devices.length > 0;

    return (
        <section className="mx-auto max-w-3xl space-y-6 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">
                    {m.mode_tempo()} · {exercise.title}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{m.tempo_intro()}</p>
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
                    disabled={support !== "supported" || status === "requesting"}
                    className="rounded-md bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 disabled:opacity-40"
                >
                    {status === "requesting" ? m.midi_connecting() : m.midi_connect()}
                </button>
            )}

            <HandSelector
                hands={allHands}
                value={choice}
                onChange={setChoice}
                disabled={runState !== "idle" && runState !== "finished"}
            />

            <div className="flex items-center gap-4">
                {runState === "idle" || runState === "finished" ? (
                    <button
                        type="button"
                        onClick={start}
                        disabled={matcher.totalSteps === 0}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                    >
                        {runState === "finished" ? m.tempo_go_again() : m.tempo_start()}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => setRunState("idle")}
                        className="rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        {m.tempo_stop()}
                    </button>
                )}
                {runState === "armed" && (
                    <span className="text-sm text-indigo-700 dark:text-indigo-300">
                        {m.tempo_play_ready_prefix()}
                        <span className="font-mono">
                            {describeNext(matcher.nextByHand, noteName)}
                        </span>
                        {m.tempo_play_ready_suffix()}
                    </span>
                )}
                {runState === "running" && (
                    <span className="text-lg font-semibold tabular-nums text-indigo-700 dark:text-indigo-300">
                        {m.tempo_live_bpm({ bpm: liveBpm ?? "…" })}
                    </span>
                )}
            </div>

            {runState === "finished" && result && (
                <div className="space-y-3 rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        {m.tempo_median({
                            bpm: Math.round(result.median),
                            hotspots: describeHotspots(result.hotspots),
                        })}
                    </p>
                    {result.handStats.map((hand) => (
                        <p key={hand.label} className="text-sm text-gray-500 dark:text-gray-400">
                            {m.tempo_hand_median({
                                hand: hand.label,
                                bpm: Math.round(hand.median),
                                hotspots: describeHotspots(hand.hotspots),
                            })}
                        </p>
                    ))}
                    <TempoGraph
                        points={result.points}
                        median={result.median}
                        hotspots={result.hotspots}
                        series={result.handStats.map((hand, index) => ({
                            label: m.tempo_hand_series({ hand: hand.label }),
                            points: hand.points,
                            color: HAND_COLORS[index % HAND_COLORS.length]!,
                        }))}
                    />
                </div>
            )}

            <div className="rounded-md border border-gray-200 dark:border-gray-800 p-4">
                <AbcRenderer abcTune={exercise.abc} onRender={handleRender} />
            </div>

            <PianoKeyboard expected={matcher.nextByHand.flatMap((hand) => hand.pitches)} />

            <KeyboardHint octaveOffset={octaveOffset} />
        </section>
    );
}
