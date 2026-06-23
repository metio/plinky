// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { TuneObject } from "abcjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMidiConnection, useMidiInput } from "../contexts/midi";
import { type CorrectInfo, describeNext, useHandsMatcher } from "../hooks/useHandsMatcher";
import { useMetronome } from "../hooks/useMetronome";
import { useSynth } from "../hooks/useSynth";
import { useRecordOnFinish } from "../hooks/usePracticeLog";
import type { Exercise } from "../lib/exercises";
import { buildHands, type Hand } from "../lib/hands";
import { type MidiNoteEvent, noteName } from "../lib/midi";
import { type DynamicsSummary, summarizeDynamics } from "../lib/dynamics";
import { type Hit, makeHit, type RhythmSummary, summarize } from "../lib/rhythm";
import { isBetterRhythm, loadBestRhythm, type RhythmBest, saveBestRhythm } from "../lib/scores";
import { AbcRenderer } from "./abcRenderer";
import { BeatIndicator } from "./beatIndicator";
import { HandSelector, useHandSelection } from "./handSelector";
import { KeyboardHint } from "./keyboardHint";
import { PianoKeyboard } from "./pianoKeyboard";

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
    const [allHands, setAllHands] = useState<Hand[]>([]);
    const { hands, choice, setChoice } = useHandSelection(allHands);
    const [runState, setRunState] = useState<RunState>("idle");
    const [lastHit, setLastHit] = useState<Hit | null>(null);
    const [summary, setSummary] = useState<RhythmSummary | null>(null);
    const [handSummaries, setHandSummaries] = useState<{ label: string; summary: RhythmSummary }[]>(
        [],
    );
    const [best, setBest] = useState<RhythmBest | null>(null);
    const [isRecord, setIsRecord] = useState(false);
    const [dynamics, setDynamics] = useState<DynamicsSummary | null>(null);

    // Timing anchors live in refs so the input handlers read current values
    // without being recreated mid-run.
    const startRef = useRef(0);
    const baseOffsetRef = useRef(0);
    const hitsRef = useRef<{ hand: number; hit: Hit }[]>([]);
    const velocitiesRef = useRef<number[]>([]);
    const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const metronome = useMetronome();

    useEffect(() => {
        setBest(loadBestRhythm(exercise.id));
    }, [exercise.id]);

    const handleRender = useCallback(
        (tune: TuneObject) => setAllHands(buildHands(tune, exercise.tempo)),
        [exercise.tempo],
    );

    const synth = useSynth();

    const handleCorrect = useCallback(
        (info: CorrectInfo) => {
            for (const pitch of info.pitches) {
                synth.playNote(pitch);
            }
            // The first note anchors the phrase; every later note is scored against
            // its tempo-derived offset from that anchor.
            if (info.ordinal === 0) {
                startRef.current = info.timestamp;
                baseOffsetRef.current = info.timeMs;
                hitsRef.current = [];
                velocitiesRef.current = [info.velocity];
                setLastHit(null);
                setRunState("running");
                return;
            }
            velocitiesRef.current.push(info.velocity);
            const targetOffset = info.timeMs - baseOffsetRef.current;
            const actualOffset = info.timestamp - startRef.current;
            const hit = makeHit(info.ordinal, actualOffset - targetOffset);
            hitsRef.current = [...hitsRef.current, { hand: info.hand, hit }];
            setLastHit(hit);
        },
        [synth],
    );

    const handleComplete = useCallback(() => {
        metronome.stop();
        const entries = hitsRef.current;
        const result = summarize(entries.map((entry) => entry.hit));
        setSummary(result);
        // Break the score down per hand when both played, so a dragging left hand
        // shows up on its own.
        setHandSummaries(
            hands.length > 1
                ? hands.map((hand) => ({
                      label: hand.label,
                      summary: summarize(
                          entries.filter((entry) => entry.hand === hand.staff).map((e) => e.hit),
                      ),
                  }))
                : [],
        );
        setDynamics(summarizeDynamics(velocitiesRef.current));
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
    }, [metronome, exercise.id, hands]);

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

    const stopArmTimer = useCallback(() => {
        if (armTimerRef.current !== null) {
            clearTimeout(armTimerRef.current);
            armTimerRef.current = null;
        }
    }, []);

    const start = useCallback(() => {
        matcher.reset();
        hitsRef.current = [];
        velocitiesRef.current = [];
        setLastHit(null);
        setSummary(null);
        setHandSummaries([]);
        setDynamics(null);
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
                <p className="text-sm text-gray-500 dark:text-gray-400">
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
                    className="rounded-md bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 disabled:opacity-40"
                >
                    {status === "requesting" ? "Connecting…" : "Connect MIDI"}
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
                        {runState === "finished" ? "Go again" : "Start"}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={abort}
                        className="rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        Stop
                    </button>
                )}
                {metronome.running && (
                    <BeatIndicator beat={metronome.beat} beatsPerBar={exercise.beatsPerBar} />
                )}
                {runState === "counting" && (
                    <span className="text-sm text-indigo-700 dark:text-indigo-300">Count-in…</span>
                )}
                {runState === "armed" && (
                    <span className="text-sm text-indigo-700 dark:text-indigo-300">
                        Play{" "}
                        <span className="font-mono">
                            {describeNext(matcher.nextByHand, noteName)}
                        </span>{" "}
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
                <div className="space-y-1 rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-4 text-sm">
                    <p className="text-lg font-semibold">
                        {isRecord ? "New best! 🏆" : `${summary.perfect}/${summary.total} perfect`}
                    </p>
                    <p className="text-gray-600 dark:text-gray-300">
                        <span className="text-green-600">{summary.perfect} perfect</span> ·{" "}
                        <span className="text-amber-600">{summary.good} good</span> ·{" "}
                        <span className="text-red-600">{summary.off} off</span>
                    </p>
                    <p className="text-gray-500 dark:text-gray-400">
                        Average timing error {Math.round(summary.averageAbsMs)}ms
                    </p>
                    {handSummaries.map((hand) => (
                        <p key={hand.label} className="text-gray-500 dark:text-gray-400">
                            {hand.label} hand: {Math.round(hand.summary.averageAbsMs)}ms (
                            {hand.summary.perfect}/{hand.summary.total} perfect)
                        </p>
                    ))}
                    {dynamics && (
                        <p className="text-gray-500 dark:text-gray-400">
                            Dynamics: {dynamics.label} ({dynamics.evenness}% even) — a MIDI piano
                            scores this from how evenly you strike the keys.
                        </p>
                    )}
                </div>
            )}

            {best && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Best: average timing error{" "}
                    <span className="font-mono">{Math.round(best.averageAbsMs)}ms</span> (
                    {best.perfect}/{best.total} perfect)
                </p>
            )}

            <div className="rounded-md border border-gray-200 dark:border-gray-800 p-4">
                <AbcRenderer abcTune={exercise.abc} onRender={handleRender} />
            </div>

            <PianoKeyboard expected={matcher.nextByHand.flatMap((hand) => hand.pitches)} />

            <KeyboardHint octaveOffset={octaveOffset} />
        </section>
    );
}
