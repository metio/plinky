// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { TuneObject } from "abcjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMidiConnection, useMidiInput } from "../contexts/midi";
import { useNoteMatcher } from "../hooks/useNoteMatcher";
import { useSynth } from "../hooks/useSynth";
import type { Exercise } from "../lib/exercises";
import { type MidiNoteEvent, noteName } from "../lib/midi";
import { buildSteps, type Step } from "../lib/steps";
import {
    findHotspots,
    type Hotspot,
    instantaneousBpm,
    median,
    type TempoPoint,
    tempoSeries,
} from "../lib/tempo";
import { AbcRenderer } from "./abcRenderer";
import { KeyboardHint } from "./keyboardHint";
import { TempoGraph } from "./tempoGraph";

const HOTSPOT_COLOR = "#dc2626"; // red-600 — a note inside a slow stretch
// Weight for the live bpm readout: high enough to react, low enough to not jump.
const SMOOTHING = 0.4;

type RunState = "idle" | "armed" | "running" | "finished";

type Result = {
    points: TempoPoint[];
    median: number;
    hotspots: Hotspot[];
};

// Paint the notes of each slow stretch red, directly on the rendered score.
function paintHotspots(steps: Step[], hotspots: Hotspot[]): void {
    for (const hotspot of hotspots) {
        for (let i = hotspot.startIndex; i <= hotspot.endIndex; i++) {
            for (const element of steps[i]?.elements ?? []) {
                element.style.fill = HOTSPOT_COLOR;
            }
        }
    }
}

function describeHotspots(hotspots: Hotspot[]): string {
    if (hotspots.length === 0) {
        return "Nice and steady — no big slow-downs.";
    }
    const ranges = hotspots
        .map((hotspot) =>
            hotspot.startIndex === hotspot.endIndex
                ? `note ${hotspot.startIndex + 1}`
                : `notes ${hotspot.startIndex + 1}–${hotspot.endIndex + 1}`,
        )
        .join(", ");
    return `You slowed down around ${ranges}.`;
}

export function TempoTrainer({ exercise }: { exercise: Exercise }) {
    const [steps, setSteps] = useState<Step[]>([]);
    const [runState, setRunState] = useState<RunState>("idle");
    const [liveBpm, setLiveBpm] = useState<number | null>(null);
    const [result, setResult] = useState<Result | null>(null);

    // Onset timestamps per note index drive the whole analysis; the smoothed
    // value powers the live readout without re-rendering on a ref change.
    const timestampsRef = useRef<number[]>([]);
    const smoothedRef = useRef(0);

    const synth = useSynth();

    const handleRender = useCallback(
        // Each step's `timeMs` is its notated onset at the exercise tempo, the
        // reference the played tempo is measured against.
        (tune: TuneObject) => setSteps(buildSteps(tune, exercise.tempo)),
        [exercise.tempo],
    );

    const handleCorrect = useCallback(
        (index: number, timestamp: number) => {
            for (const pitch of steps[index]?.pitches ?? []) {
                synth.playNote(pitch);
            }
            timestampsRef.current[index] = timestamp;
            if (index === 0) {
                setRunState("running");
                setLiveBpm(null);
                return;
            }
            const notatedGap = (steps[index]?.timeMs ?? 0) - (steps[index - 1]?.timeMs ?? 0);
            const actualGap = timestamp - timestampsRef.current[index - 1];
            const bpm = instantaneousBpm(exercise.tempo, notatedGap, actualGap);
            smoothedRef.current =
                liveBpm === null ? bpm : SMOOTHING * bpm + (1 - SMOOTHING) * smoothedRef.current;
            setLiveBpm(Math.round(smoothedRef.current));
        },
        [synth, steps, exercise.tempo, liveBpm],
    );

    const handleComplete = useCallback(() => {
        const notatedMs = steps.map((step) => step.timeMs);
        const points = tempoSeries(exercise.tempo, notatedMs, timestampsRef.current);
        const med = median(points.map((point) => point.bpm));
        setResult({ points, median: med, hotspots: findHotspots(points, med) });
        setRunState("finished");
    }, [steps, exercise.tempo]);

    const active = runState === "armed" || runState === "running";
    const matcher = useNoteMatcher(steps, {
        active,
        onCorrect: handleCorrect,
        onComplete: handleComplete,
    });

    const handleNoteOn = useCallback(
        (played: MidiNoteEvent) => matcher.registerNote(played.note, played.timestamp),
        [matcher],
    );

    const { support, status, devices, octaveOffset, requestAccess } = useMidiConnection();
    useMidiInput({ onNoteOn: handleNoteOn });

    // Overlay the hotspots in red once a run finishes. The matcher's own painting
    // settled on the final cursor before this runs, so the red overlay sticks.
    useEffect(() => {
        if (result) {
            paintHotspots(steps, result.hotspots);
        }
    }, [result, steps]);

    const start = useCallback(() => {
        matcher.reset();
        timestampsRef.current = [];
        smoothedRef.current = 0;
        setLiveBpm(null);
        setResult(null);
        setRunState("armed");
    }, [matcher]);

    const connected = status === "ready" && devices.length > 0;

    return (
        <section className="mx-auto max-w-3xl space-y-6 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">Tempo · {exercise.title}</h1>
                <p className="text-sm text-gray-500">
                    Play at your own pace — no metronome. Plinky charts your tempo and flags where
                    you slowed down.
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

            <div className="flex items-center gap-4">
                {runState === "idle" || runState === "finished" ? (
                    <button
                        type="button"
                        onClick={start}
                        disabled={steps.length === 0}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                    >
                        {runState === "finished" ? "Go again" : "Start"}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => setRunState("idle")}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
                    >
                        Stop
                    </button>
                )}
                {runState === "armed" && (
                    <span className="text-sm text-indigo-700">
                        Play{" "}
                        <span className="font-mono">
                            {matcher.nextPitches.map(noteName).join(" ")}
                        </span>{" "}
                        whenever you are ready.
                    </span>
                )}
                {runState === "running" && (
                    <span className="text-lg font-semibold tabular-nums text-indigo-700">
                        ≈ {liveBpm ?? "…"} BPM
                    </span>
                )}
            </div>

            {runState === "finished" && result && (
                <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm text-gray-600">
                        Median tempo{" "}
                        <span className="font-mono">{Math.round(result.median)} BPM</span> ·{" "}
                        {describeHotspots(result.hotspots)}
                    </p>
                    <TempoGraph
                        points={result.points}
                        median={result.median}
                        hotspots={result.hotspots}
                    />
                </div>
            )}

            <div className="rounded-md border border-gray-200 p-4">
                <AbcRenderer abcTune={exercise.abc} onRender={handleRender} />
            </div>

            <KeyboardHint octaveOffset={octaveOffset} />
        </section>
    );
}
