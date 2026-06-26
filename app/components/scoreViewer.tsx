// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Cursor, OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useEffect, useRef, useState } from "react";
import { useMidiConnection, useMidiInput } from "../contexts/midi";
import { useMetronome } from "../hooks/useMetronome";
import {
    collectSteps,
    type CorrectInfo,
    type Hand,
    useScoreMatcher,
} from "../hooks/useScoreMatcher";
import { useSynth } from "../hooks/useSynth";
import { summarizeDynamics } from "../lib/dynamics";
import { fingerSteps } from "../lib/fingering";
import { computeFlow } from "../lib/flow";
import { recordPractice } from "../lib/history";
import { computeGrade, GRADE_COLOR, type Grade } from "../lib/grade";
import { recordRun } from "../lib/lifetime";
import {
    applyRun,
    isDue,
    letterMin,
    loadMastery,
    markLearned,
    type Mastery,
    saveMastery,
    setBacklog,
} from "../lib/mastery";
import { loadPrefs } from "../lib/prefs";
import { makeHit, summarize } from "../lib/rhythm";
import { paintPlayedNotes } from "../lib/scoreColor";
import { type Grid, gridFor, type RunNote } from "../lib/shareCard";
import {
    findHotspots,
    type Hotspot,
    instantaneousBpm,
    median,
    type TempoPoint,
    tempoSeries,
} from "../lib/tempo";
import { m } from "../paraglide/messages.js";
import { Bpm } from "./bpm";
import { PerformanceStrip } from "./performanceStrip";
import { PianoKeyboard } from "./pianoKeyboard";
import { ShareCard } from "./shareCard";
import { TempoGraph } from "./tempoGraph";

// A cleared note plus the velocity it was played at — the run's raw record, from
// which the grade, the per-note strip and the share grid are all derived.
type PlayedNote = RunNote & { velocity: number };

const BUTTON =
    "rounded-md bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:bg-indigo-950 dark:text-indigo-300";

// Renders a MusicXML score with OpenSheetMusicDisplay. Listen plays it back on the
// shared synth, walking OSMD's cursor so the highlight follows; Practice turns the
// same cursor into a note-by-note matcher driven by MIDI or the keyboard. OSMD
// needs a real DOM and is large, so it loads and renders on the client only.
export function ScoreViewer({
    id,
    xml,
    title,
    onMastery,
    daily,
    ephemeral,
    initialTempo,
    beatsPerBar,
    lockTempo,
}: {
    id: string;
    xml: string;
    title: string;
    onMastery?: () => void;
    // The piece's own tempo, used as the starting point for Listen and the count —
    // the component is keyed by piece, so it re-seeds when the piece changes.
    initialTempo?: number;
    // The piece's beats per bar, so the metronome accents the downbeat.
    beatsPerBar?: number;
    // Fix the tempo at initialTempo and hide the slider, so a shared challenge is
    // played at one tempo by everyone rather than dialled to taste.
    lockTempo?: boolean;
    // When set, this run is the day's shared challenge; the share card identifies
    // it as "Plinky #N" rather than by the piece, so everyone compares one grid.
    daily?: number;
    // A throwaway piece, like a freshly generated sprint, that still counts toward
    // the streak and fingerprint but is never tracked for spaced repetition.
    ephemeral?: boolean;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
    const timers = useRef<number[]>([]);
    // Tracks playback synchronously, so a second click that lands before the
    // `playing` state has re-rendered can't start a second cursor loop.
    const playingRef = useRef(false);
    const tempoRef = useRef(initialTempo ?? 100);
    const notesRef = useRef<PlayedNote[]>([]);
    const startRef = useRef(0);
    const baseOffsetRef = useRef(0);
    const synth = useSynth();
    const [ready, setReady] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [metronomeOn, setMetronomeOn] = useState(false);
    // An adaptive metronome follows the player's own tempo, read live from their
    // note timing, instead of ticking at the fixed slider speed.
    const [adaptive, setAdaptive] = useState(false);
    const [liveTempo, setLiveTempo] = useState(initialTempo ?? 100);
    const [tempo, setTempo] = useState(initialTempo ?? 100);
    // Which hand to practice, and the score's staff count — the hands-separate
    // selector only appears for the grand-staff (two-staff) scores it applies to.
    const [hand, setHand] = useState<Hand>("both");
    const [staffCount, setStaffCount] = useState(1);
    // Suggested finger (1–5) per playable position for the run, and which hand's
    // line it was computed for, so the keyboard can hint the current note's finger.
    const [fingerPlan, setFingerPlan] = useState<number[] | null>(null);
    const [fingeringHand, setFingeringHand] = useState<"left" | "right" | null>(null);

    // A metronome on demand: fixed at the chosen tempo, or following the player's
    // own pace when adaptive.
    useMetronome(metronomeOn, adaptive ? liveTempo : tempo, beatsPerBar ?? 4);
    const [grade, setGrade] = useState<Grade | null>(null);
    const [runNotes, setRunNotes] = useState<RunNote[]>([]);
    const [shareGrid, setShareGrid] = useState<Grid | null>(null);
    const [tempoCurve, setTempoCurve] = useState<{
        points: TempoPoint[];
        median: number;
        hotspots: Hotspot[];
    } | null>(null);
    const [mastery, setMastery] = useState<Mastery | null>(null);
    // The tempo a run was matched at, captured when practice starts so the run's
    // self-paced tempo curve reads against the same reference the matcher used,
    // even if the slider is moved afterwards.
    const runTempoRef = useRef(initialTempo ?? 100);
    // Whether any note has been coloured on the score, so a fresh run re-renders to
    // clear last run's progress only when there is something to clear.
    const paintedRef = useRef(false);

    useEffect(() => {
        setMastery(ephemeral ? null : loadMastery(id));
    }, [id, ephemeral]);

    const matcher = useScoreMatcher(() => osmdRef.current, {
        tempo,
        hand,
        onCorrect: (info: CorrectInfo) => {
            for (const pitch of info.pitches) {
                synth.playNote(pitch);
            }
            // Colour the notes just cleared — the cursor is still on them, as it
            // only advances after this callback — so the score shows progress.
            const osmd = osmdRef.current;
            if (osmd) {
                paintPlayedNotes(osmd, info.pitches);
                paintedRef.current = true;
            }
            // Record each note's notated time (the ideal) and when it was actually
            // played, both relative to the first note, for the grade, the per-note
            // strip and the share grid.
            if (info.ordinal === 0) {
                startRef.current = info.timestamp;
                baseOffsetRef.current = info.timeMs;
            }
            notesRef.current = [
                ...notesRef.current,
                {
                    targetMs: info.timeMs - baseOffsetRef.current,
                    playedMs: info.timestamp - startRef.current,
                    wrongBefore: info.wrongBefore,
                    velocity: info.velocity,
                },
            ];
            // Track the player's tempo from the gap to the previous note and ease
            // the adaptive metronome toward it, so a single rushed note nudges
            // rather than jerks the pulse. Clamped to the slider's own range.
            const played = notesRef.current;
            if (played.length >= 2) {
                const a = played[played.length - 2];
                const b = played[played.length - 1];
                if (a && b) {
                    const inst = instantaneousBpm(
                        runTempoRef.current,
                        b.targetMs - a.targetMs,
                        b.playedMs - a.playedMs,
                    );
                    if (inst > 0 && Number.isFinite(inst)) {
                        setLiveTempo((prev) =>
                            Math.round(Math.min(180, Math.max(40, prev * 0.6 + inst * 0.4))),
                        );
                    }
                }
            }
        },
    });
    useMidiInput({
        onNoteOn: (event) => matcher.registerNote(event.note, event.timestamp, event.velocity),
    });
    const { support, status, devices, requestAccess } = useMidiConnection();
    const connected = status === "ready" && devices.length > 0;

    useEffect(() => {
        tempoRef.current = tempo;
    }, [tempo]);

    // Grade a run once it completes, from the captured timing and velocity. A run
    // with no real velocity variation (the computer keyboard) is graded without
    // dynamics rather than crediting a constant.
    useEffect(() => {
        if (!matcher.complete) {
            return;
        }
        const notes = notesRef.current;
        const velocities = notes.map((note) => note.velocity);
        const hasDynamics = new Set(velocities).size > 1;
        const hits = notes.map((note, index) => makeHit(index, note.playedMs - note.targetMs));
        const result = computeGrade({
            correct: matcher.total,
            wrong: matcher.wrong,
            rhythm: summarize(hits),
            flow: computeFlow(notes),
            dynamics: hasDynamics ? summarizeDynamics(velocities) : null,
        });
        setGrade(result);
        setRunNotes(notes);
        setShareGrid(gridFor(notes));
        // Read the player's own tempo back out of the gaps between their notes, so
        // the results show where they sped up or dragged against their own pace.
        const points = tempoSeries(
            runTempoRef.current,
            notes.map((note) => note.targetMs),
            notes.map((note) => note.playedMs),
        );
        const med = median(points.map((point) => point.bpm));
        setTempoCurve(
            points.length > 0 ? { points, median: med, hotspots: findHotspots(points, med) } : null,
        );
        // Fold the run's core trio into the lifetime fingerprint shown on /progress.
        recordRun({ accuracy: result.accuracy, timing: result.timing, flow: result.flow });
        // Count the run's notes toward the practice streak.
        recordPractice(matcher.total);
        if (ephemeral) {
            return;
        }
        // Fold the run into spaced-repetition state: a score that clears the
        // threshold becomes learned and schedules (or reschedules) its review.
        const threshold = letterMin(loadPrefs().masteryThreshold);
        const updated = applyRun(loadMastery(id), result.score, threshold, Date.now());
        saveMastery(id, updated);
        setMastery(updated);
        onMastery?.();
    }, [matcher.complete, matcher.total, matcher.wrong, id, onMastery, ephemeral]);

    const markLearnedNow = () => {
        const updated = markLearned(loadMastery(id), Date.now());
        saveMastery(id, updated);
        setMastery(updated);
        onMastery?.();
    };
    const toggleBacklog = () => {
        const current = loadMastery(id);
        const updated = setBacklog(current, !current?.backlog, Date.now());
        saveMastery(id, updated);
        setMastery(updated);
        onMastery?.();
    };

    const stopListen = () => {
        for (const id of timers.current) {
            window.clearTimeout(id);
        }
        timers.current = [];
        if (!matcher.practicing) {
            osmdRef.current?.cursor?.hide();
        }
        playingRef.current = false;
        setPlaying(false);
    };

    // Reload OSMD whenever the score changes, and stop any playback/practice.
    // biome-ignore lint/correctness/useExhaustiveDependencies: matcher.stop/stopListen reset transient playback, not render inputs
    useEffect(() => {
        let cancelled = false;
        setReady(false);
        setLoadError(false);
        setFingerPlan(null);
        paintedRef.current = false;
        stopListen();
        matcher.stop();
        import("opensheetmusicdisplay")
            .then(({ OpenSheetMusicDisplay }) => {
                if (cancelled || !containerRef.current) {
                    return;
                }
                const osmd = new OpenSheetMusicDisplay(containerRef.current, {
                    autoResize: true,
                    drawingParameters: "compact",
                });
                osmdRef.current = osmd;
                return osmd.load(xml).then(() => {
                    if (!cancelled) {
                        osmd.render();
                        // A grand staff (two staves) can be drilled one hand at a
                        // time; a single-staff score offers no such choice.
                        setStaffCount(osmd.Sheet?.getCompleteNumberOfStaves() ?? 1);
                        setHand("both");
                        setReady(true);
                    }
                });
            })
            // A failed chunk import or MusicXML that OSMD can't load would otherwise
            // leave ready false forever — a silently dead viewer with disabled
            // controls and no explanation. Surface it instead.
            .catch(() => {
                if (!cancelled) {
                    setLoadError(true);
                }
            });
        return () => {
            cancelled = true;
            for (const id of timers.current) {
                window.clearTimeout(id);
            }
        };
    }, [xml]);

    // Walk the cursor one voice-entry at a time, sounding the notes under it and
    // waiting their notated duration at the chosen tempo.
    const listen = () => {
        const osmd = osmdRef.current;
        if (!osmd || playingRef.current) {
            return;
        }
        playingRef.current = true;
        matcher.stop();
        const cursor: Cursor = osmd.cursor;
        cursor.reset();
        cursor.show();
        setPlaying(true);
        const tick = () => {
            if (cursor.iterator.EndReached) {
                stopListen();
                return;
            }
            let beats = 1;
            for (const note of cursor.NotesUnderCursor()) {
                const quarters = note.Length.RealValue * 4;
                if (!note.isRest() && note.halfTone > 0) {
                    synth.playNote(note.halfTone + 12, { duration: quarters });
                }
                beats = Math.max(beats, quarters);
            }
            cursor.next();
            timers.current.push(window.setTimeout(tick, beats * (60000 / tempoRef.current)));
        };
        tick();
    };

    const practice = () => {
        stopListen();
        notesRef.current = [];
        setGrade(null);
        setRunNotes([]);
        setShareGrid(null);
        setTempoCurve(null);
        setLiveTempo(tempo);
        runTempoRef.current = tempo;
        // Suggest a fingering for the line being drilled — one hand at a time, or
        // the single staff. With both hands on a grand staff there are two lines on
        // one keyboard, so no single finger fits a key; skip the hint there.
        const osmd = osmdRef.current;
        const fingerFor: "left" | "right" | null =
            staffCount < 2 ? "right" : hand === "both" ? null : hand;
        if (osmd && fingerFor) {
            const matcherHand: Hand = staffCount < 2 ? "both" : hand;
            const steps = collectSteps(osmd, matcherHand).map((pitches) => ({ pitches }));
            setFingerPlan(fingerSteps(steps, fingerFor));
            setFingeringHand(fingerFor);
        } else {
            setFingerPlan(null);
            setFingeringHand(null);
        }
        // Re-render to wipe the previous run's note colours before starting afresh.
        if (paintedRef.current) {
            osmd?.render();
            paintedRef.current = false;
        }
        matcher.start();
    };

    const handLabel: Record<Hand, string> = {
        both: m.hand_both(),
        right: m.hand_right(),
        left: m.hand_left(),
    };

    // The finger for the position being played, mapped to its melody note so the
    // keyboard can badge that key. The right hand fingers the top note of a chord,
    // the left the bottom — matching how the suggestion was computed.
    const currentFingers: Record<number, number> = {};
    if (fingerPlan && fingeringHand && matcher.practicing && matcher.expected.length > 0) {
        const finger = fingerPlan[matcher.done];
        if (finger) {
            const melody =
                fingeringHand === "left"
                    ? Math.min(...matcher.expected)
                    : Math.max(...matcher.expected);
            currentFingers[melody] = finger;
        }
    }

    return (
        <div className="space-y-3">
            {/* The score sits at the top — it's what you read while playing, so the
                controls, keyboard and run summary all fall below it. OSMD renders to
                its container's full offset width, which includes any border or
                padding on that element; were either on the element OSMD owns, the
                rendered system would overflow by exactly that amount and show a
                spurious scrollbar. So the border and breathing room live on the
                wrapper, and the inner element OSMD measures is clean. Wide scores
                still scroll horizontally, and that region must be focusable for
                keyboard users (axe scrollable-region-focusable). */}
            <div className="rounded-md border border-gray-200 bg-white p-2 dark:border-gray-800">
                <div
                    ref={containerRef}
                    // biome-ignore lint/a11y/noNoninteractiveTabindex: a horizontally scrollable region needs keyboard access
                    tabIndex={0}
                    role="img"
                    aria-label={title}
                    className="overflow-x-auto"
                />
                {loadError && (
                    <p className="p-2 text-sm text-red-600 dark:text-red-400">
                        {m.score_load_error()}
                    </p>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    disabled={!ready}
                    onClick={() => (playing ? stopListen() : listen())}
                    className={BUTTON}
                >
                    {playing ? m.action_listen_stop() : m.action_listen()}
                </button>
                <button
                    type="button"
                    disabled={!ready}
                    onClick={() => (matcher.practicing ? matcher.stop() : practice())}
                    className={BUTTON}
                >
                    {matcher.practicing ? m.action_listen_stop() : m.curriculums_practice()}
                </button>
                <button
                    type="button"
                    onClick={() => setMetronomeOn((on) => !on)}
                    aria-pressed={metronomeOn}
                    className={
                        metronomeOn
                            ? "rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
                            : BUTTON
                    }
                >
                    {m.action_metronome()}
                </button>
                {metronomeOn && (
                    <span className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setAdaptive((on) => !on)}
                            aria-pressed={adaptive}
                            className={
                                adaptive
                                    ? "rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
                                    : BUTTON
                            }
                        >
                            {m.metronome_adaptive()}
                        </button>
                        {adaptive && (
                            <Bpm
                                tempo={liveTempo}
                                className="text-sm text-gray-600 dark:text-gray-400"
                            />
                        )}
                    </span>
                )}
                {staffCount >= 2 && (
                    <fieldset aria-label={m.hand_label()} className="flex items-center gap-1">
                        {(["both", "right", "left"] as const).map((option) => (
                            <button
                                key={option}
                                type="button"
                                // The hand is fixed once a run starts, so the choice
                                // is locked while practicing to keep the count honest.
                                disabled={matcher.practicing}
                                onClick={() => setHand(option)}
                                aria-pressed={hand === option}
                                className={
                                    hand === option
                                        ? "rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                                        : BUTTON
                                }
                            >
                                {handLabel[option]}
                            </button>
                        ))}
                    </fieldset>
                )}
                {lockTempo ? (
                    <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        {m.scores_tempo()}
                        <Bpm tempo={tempo} />
                    </span>
                ) : (
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        {m.scores_tempo()}
                        <input
                            type="range"
                            min={40}
                            max={180}
                            value={tempo}
                            onChange={(event) => setTempo(Number(event.target.value))}
                            aria-label={m.scores_tempo()}
                        />
                        <Bpm tempo={tempo} className="w-12" />
                    </label>
                )}
            </div>

            <div hidden={ephemeral} className="flex flex-wrap items-center gap-3 text-sm">
                {mastery?.learned ? (
                    <>
                        <span className="font-medium text-green-700 dark:text-green-400">
                            ✓ {m.mastery_learned()}
                        </span>
                        {isDue(mastery, Date.now()) && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                {m.mastery_due()}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={toggleBacklog}
                            className="text-indigo-600 underline dark:text-indigo-400"
                        >
                            {mastery.backlog ? m.mastery_resume() : m.mastery_backlog()}
                        </button>
                    </>
                ) : (
                    <button
                        type="button"
                        onClick={markLearnedNow}
                        className="text-indigo-600 underline dark:text-indigo-400"
                    >
                        {m.mastery_mark_learned()}
                    </button>
                )}
            </div>

            {matcher.practicing && (
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                            {m.play_progress()} {matcher.done} / {matcher.total}
                        </span>
                        {!connected && support === "supported" && (
                            <button
                                type="button"
                                onClick={requestAccess}
                                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white"
                            >
                                {status === "requesting" ? m.midi_connecting() : m.midi_connect()}
                            </button>
                        )}
                    </div>
                    <PianoKeyboard
                        expected={matcher.expected}
                        from={matcher.range?.from}
                        to={matcher.range?.to}
                        fingers={currentFingers}
                    />
                </div>
            )}

            {grade && (
                <div className="space-y-3">
                    <div className="flex items-center gap-4 rounded-md border border-gray-200 p-3 dark:border-gray-800">
                        <div
                            className={`text-5xl font-bold leading-none ${GRADE_COLOR[grade.letter]}`}
                        >
                            {grade.letter}
                        </div>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
                            <dt className="text-gray-500 dark:text-gray-400">
                                {m.scores_accuracy()}
                            </dt>
                            <dd className="text-right font-mono tabular-nums">{grade.accuracy}%</dd>
                            <dt className="text-gray-500 dark:text-gray-400">
                                {m.scores_timing()}
                            </dt>
                            <dd className="text-right font-mono tabular-nums">{grade.timing}%</dd>
                            <dt className="text-gray-500 dark:text-gray-400">{m.scores_flow()}</dt>
                            <dd className="text-right font-mono tabular-nums">{grade.flow}%</dd>
                            {grade.dynamics !== null && (
                                <>
                                    <dt className="text-gray-400 dark:text-gray-500">
                                        {m.scores_dynamics()}
                                    </dt>
                                    <dd className="text-right font-mono tabular-nums text-gray-500 dark:text-gray-400">
                                        {grade.dynamics}%
                                    </dd>
                                </>
                            )}
                        </dl>
                    </div>
                    <PerformanceStrip notes={runNotes} />
                    {tempoCurve && (
                        <section className="space-y-1">
                            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                {m.tempo_heading()}
                            </h3>
                            <TempoGraph
                                points={tempoCurve.points}
                                median={tempoCurve.median}
                                hotspots={tempoCurve.hotspots}
                            />
                        </section>
                    )}
                    {shareGrid && (
                        <ShareCard
                            grid={shareGrid}
                            caption={m.share_heading()}
                            gridLabel={m.share_grid_label()}
                            rowLabels={[m.scores_accuracy(), m.scores_timing(), m.scores_flow()]}
                            boast={
                                daily != null
                                    ? m.daily_share_boast({ number: daily, grade: grade.letter })
                                    : m.share_boast({ title })
                            }
                            heading={daily != null ? `🎹 Plinky #${daily} ${grade.letter}` : title}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
