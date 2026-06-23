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
import { makeHit, summarize, type Hit, type RhythmSummary } from "../lib/rhythm";
import { isBetterRhythm, loadBestRhythm, saveBestRhythm, type RhythmBest } from "../lib/scores";
import type { Exercise } from "../lib/exercises";

type RunState = "idle" | "counting" | "armed" | "running" | "finished";

const RATING_STYLES: Record<Hit["rating"], string> = {
    perfect: "text-green-600",
    good: "text-amber-600",
    off: "text-red-600",
};

function describeHit(hit: Hit): string {
    if (hit.rating === "perfect") {
        return "Perfect";
    }
    const direction = hit.deltaMs < 0 ? "early" : "late";
    return `${hit.rating === "good" ? "Good" : "Off"} · ${Math.abs(Math.round(hit.deltaMs))}ms ${direction}`;
}

export function RhythmTrainer({ exercise }: { exercise: Exercise }) {
    const [events, setEvents] = useState<NoteTimingEvent[]>([]);
    const [runState, setRunState] = useState<RunState>("idle");
    const [lastHit, setLastHit] = useState<Hit | null>(null);
    const [summary, setSummary] = useState<RhythmSummary | null>(null);
    const [best, setBest] = useState<RhythmBest | null>(null);
    const [isRecord, setIsRecord] = useState(false);

    // Timing anchors live in refs so the input handlers read current values
    // without being recreated mid-run.
    const startRef = useRef(0);
    const baseOffsetRef = useRef(0);
    const hitsRef = useRef<Hit[]>([]);
    const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const metronome = useMetronome();

    useEffect(() => {
        setBest(loadBestRhythm(exercise.id));
    }, [exercise.id]);

    const handleRender = useCallback(
        (tune: TuneObject) => {
            // Build events at the exercise tempo so each event's `milliseconds`
            // is its target time within the phrase.
            const timed = tune
                .setupEvents(0, 1000, exercise.tempo)
                .filter((event) => event.type === "event" && expectedPitches(event).length > 0);
            setEvents(timed);
        },
        [exercise.tempo],
    );

    const synth = useSynth();

    const handleCorrect = useCallback(
        (index: number, timestamp: number) => {
            synth.playNote(expectedPitches(events[index])[0]);
            // The first note anchors the phrase; every later note is scored
            // against its tempo-derived offset from that anchor.
            if (index === 0) {
                startRef.current = timestamp;
                baseOffsetRef.current = events[0]?.milliseconds ?? 0;
                hitsRef.current = [];
                setLastHit(null);
                setRunState("running");
                return;
            }
            const targetOffset = (events[index]?.milliseconds ?? 0) - baseOffsetRef.current;
            const actualOffset = timestamp - startRef.current;
            const hit = makeHit(index, actualOffset - targetOffset);
            hitsRef.current = [...hitsRef.current, hit];
            setLastHit(hit);
        },
        [synth, events],
    );

    const handleComplete = useCallback(() => {
        metronome.stop();
        const result = summarize(hitsRef.current);
        setSummary(result);
        setRunState("finished");
        setBest((prevBest) => {
            if (result.total > 0 && isBetterRhythm(result, prevBest)) {
                const record: RhythmBest = { ...result, at: new Date().toISOString() };
                saveBestRhythm(exercise.id, record);
                setIsRecord(true);
                return record;
            }
            setIsRecord(false);
            return prevBest;
        });
    }, [metronome, exercise.id]);

    const active = runState === "armed" || runState === "running";
    const matcher = useNoteMatcher(events, {
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

    const stopArmTimer = useCallback(() => {
        if (armTimerRef.current !== null) {
            clearTimeout(armTimerRef.current);
            armTimerRef.current = null;
        }
    }, []);

    const start = useCallback(() => {
        matcher.reset();
        hitsRef.current = [];
        setLastHit(null);
        setSummary(null);
        setIsRecord(false);
        setRunState("counting");
        // One bar of clicks doubles as the count-in; the metronome keeps ticking
        // through the run as the guide to play against.
        metronome.startMetronome(exercise.tempo, exercise.beatsPerBar);
        stopArmTimer();
        armTimerRef.current = setTimeout(
            () => setRunState("armed"),
            exercise.beatsPerBar * (60000 / exercise.tempo),
        );
    }, [matcher, metronome, exercise.tempo, exercise.beatsPerBar, stopArmTimer]);

    const abort = useCallback(() => {
        stopArmTimer();
        metronome.stop();
        matcher.reset();
        setRunState("idle");
    }, [metronome, matcher, stopArmTimer]);

    useEffect(() => stopArmTimer, [stopArmTimer]);

    const connected = status === "ready" && devices.length > 0;

    return (
        <section className="mx-auto max-w-3xl space-y-6 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">Rhythm · {exercise.title}</h1>
                <p className="text-sm text-gray-500">
                    Play each note in time with the metronome at {exercise.tempo} bpm. One bar
                    counts you in.
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
                        disabled={events.length === 0}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                    >
                        {runState === "finished" ? "Go again" : "Start"}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={abort}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
                    >
                        Stop
                    </button>
                )}
                {metronome.running && (
                    <BeatIndicator beat={metronome.beat} beatsPerBar={exercise.beatsPerBar} />
                )}
                {runState === "counting" && (
                    <span className="text-sm text-indigo-700">Count-in…</span>
                )}
                {runState === "armed" && (
                    <span className="text-sm text-indigo-700">
                        Play <span className="font-mono">{noteName(matcher.nextPitch ?? 0)}</span>{" "}
                        on the beat.
                    </span>
                )}
            </div>

            {runState === "running" && lastHit && (
                <p className={`text-lg font-semibold ${RATING_STYLES[lastHit.rating]}`}>
                    {describeHit(lastHit)}
                </p>
            )}

            {runState === "finished" && summary && (
                <div className="space-y-1 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm">
                    <p className="text-lg font-semibold">
                        {isRecord ? "New best! 🏆" : `${summary.perfect}/${summary.total} perfect`}
                    </p>
                    <p className="text-gray-600">
                        <span className="text-green-600">{summary.perfect} perfect</span> ·{" "}
                        <span className="text-amber-600">{summary.good} good</span> ·{" "}
                        <span className="text-red-600">{summary.off} off</span>
                    </p>
                    <p className="text-gray-500">
                        Average timing error {Math.round(summary.averageAbsMs)}ms
                    </p>
                </div>
            )}

            {best && (
                <p className="text-sm text-gray-500">
                    Best: average timing error{" "}
                    <span className="font-mono">{Math.round(best.averageAbsMs)}ms</span> (
                    {best.perfect}/{best.total} perfect)
                </p>
            )}

            <div className="rounded-md border border-gray-200 p-4">
                <AbcRenderer abcTune={exercise.abc} onRender={handleRender} />
            </div>

            <KeyboardHint octaveOffset={octaveOffset} />
        </section>
    );
}
