// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Cursor, OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useEffect, useRef, useState } from "react";
import { useMidiConnection, useMidiInput } from "../contexts/midi";
import { type CorrectInfo, useScoreMatcher } from "../hooks/useScoreMatcher";
import { useSynth } from "../hooks/useSynth";
import { summarizeDynamics } from "../lib/dynamics";
import { computeFlow } from "../lib/flow";
import type { TimelineNote } from "../lib/ghost";
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
import { type Grid, gridFor, type RunNote } from "../lib/shareCard";
import { m } from "../paraglide/messages.js";
import { GhostTimeline } from "./ghostTimeline";
import { PianoKeyboard } from "./pianoKeyboard";
import { ShareCard } from "./shareCard";

// A cleared note plus the velocity it was played at — the run's raw record, from
// which the grade, the ghost timeline and the share grid are all derived.
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
}: {
    id: string;
    xml: string;
    title: string;
    onMastery?: () => void;
    // When set, this run is the day's shared challenge; the share card identifies
    // it as "Plinky #N" rather than by the piece, so everyone compares one grid.
    daily?: number;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
    const timers = useRef<number[]>([]);
    const tempoRef = useRef(100);
    const notesRef = useRef<PlayedNote[]>([]);
    const startRef = useRef(0);
    const baseOffsetRef = useRef(0);
    const synth = useSynth();
    const [ready, setReady] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [tempo, setTempo] = useState(100);
    const [grade, setGrade] = useState<Grade | null>(null);
    const [timeline, setTimeline] = useState<TimelineNote[]>([]);
    const [shareGrid, setShareGrid] = useState<Grid | null>(null);
    const [mastery, setMastery] = useState<Mastery | null>(null);

    useEffect(() => {
        setMastery(loadMastery(id));
    }, [id]);

    const matcher = useScoreMatcher(() => osmdRef.current, {
        tempo,
        onCorrect: (info: CorrectInfo) => {
            for (const pitch of info.pitches) {
                synth.playNote(pitch);
            }
            // Record each note's notated time (the ghost) and when it was actually
            // played, both relative to the first note, for the grade, the timeline
            // and the share grid.
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
            flow: computeFlow(notes.map((note) => note.wrongBefore === 0)),
            dynamics: hasDynamics ? summarizeDynamics(velocities) : null,
        });
        setGrade(result);
        setTimeline(
            notes.map((note, index) => ({
                ordinal: index,
                targetMs: note.targetMs,
                playedMs: note.playedMs,
            })),
        );
        setShareGrid(gridFor(notes));
        // Fold the run's core trio into the lifetime fingerprint shown on /progress.
        recordRun({ accuracy: result.accuracy, timing: result.timing, flow: result.flow });
        // Fold the run into spaced-repetition state: a score that clears the
        // threshold becomes learned and schedules (or reschedules) its review.
        const threshold = letterMin(loadPrefs().masteryThreshold);
        const updated = applyRun(loadMastery(id), result.score, threshold, Date.now());
        saveMastery(id, updated);
        setMastery(updated);
        onMastery?.();
    }, [matcher.complete, matcher.total, matcher.wrong, id, onMastery]);

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
        setPlaying(false);
    };

    // Reload OSMD whenever the score changes, and stop any playback/practice.
    // biome-ignore lint/correctness/useExhaustiveDependencies: matcher.stop/stopListen reset transient playback, not render inputs
    useEffect(() => {
        let cancelled = false;
        setReady(false);
        stopListen();
        matcher.stop();
        import("opensheetmusicdisplay").then(({ OpenSheetMusicDisplay }) => {
            if (cancelled || !containerRef.current) {
                return;
            }
            const osmd = new OpenSheetMusicDisplay(containerRef.current, {
                autoResize: true,
                drawingParameters: "compact",
            });
            osmdRef.current = osmd;
            osmd.load(xml).then(() => {
                if (!cancelled) {
                    osmd.render();
                    setReady(true);
                }
            });
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
        if (!osmd) {
            return;
        }
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
        setTimeline([]);
        setShareGrid(null);
        matcher.start();
    };

    return (
        <div className="space-y-3">
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
                    <span className="w-12 font-mono tabular-nums">{m.home_bpm({ tempo })}</span>
                </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm">
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
                    <GhostTimeline notes={timeline} />
                    {shareGrid && (
                        <ShareCard
                            grid={shareGrid}
                            caption={m.share_heading()}
                            gridLabel={m.share_grid_label()}
                            boast={
                                daily != null
                                    ? m.daily_share_boast({ number: daily })
                                    : m.share_boast({ title })
                            }
                            heading={daily != null ? `Plinky #${daily}` : title}
                        />
                    )}
                </div>
            )}

            {/* Wide scores scroll horizontally, so the region must be focusable
                for keyboard users (axe scrollable-region-focusable) and is named
                by the piece title. */}
            <div
                ref={containerRef}
                // biome-ignore lint/a11y/noNoninteractiveTabindex: a horizontally scrollable region needs keyboard access
                tabIndex={0}
                role="img"
                aria-label={title}
                className="overflow-x-auto rounded-md border border-gray-200 bg-white p-2 dark:border-gray-800"
            />
        </div>
    );
}
