// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Cursor, OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useEffect, useRef, useState } from "react";
import { useMidiConnection, useMidiInput } from "../contexts/midi";
import { type CorrectInfo, useScoreMatcher } from "../hooks/useScoreMatcher";
import { useSynth } from "../hooks/useSynth";
import { summarizeDynamics } from "../lib/dynamics";
import { computeGrade, GRADE_COLOR, type Grade } from "../lib/grade";
import { type Hit, makeHit, summarize } from "../lib/rhythm";
import { m } from "../paraglide/messages.js";
import { PianoKeyboard } from "./pianoKeyboard";

const BUTTON =
    "rounded-md bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:bg-indigo-950 dark:text-indigo-300";

// Renders a MusicXML score with OpenSheetMusicDisplay. Listen plays it back on the
// shared synth, walking OSMD's cursor so the highlight follows; Practice turns the
// same cursor into a note-by-note matcher driven by MIDI or the keyboard. OSMD
// needs a real DOM and is large, so it loads and renders on the client only.
export function ScoreViewer({ xml, title }: { xml: string; title: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
    const timers = useRef<number[]>([]);
    const tempoRef = useRef(100);
    const hits = useRef<Hit[]>([]);
    const velocities = useRef<number[]>([]);
    const startRef = useRef(0);
    const baseOffsetRef = useRef(0);
    const synth = useSynth();
    const [ready, setReady] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [tempo, setTempo] = useState(100);
    const [grade, setGrade] = useState<Grade | null>(null);

    const matcher = useScoreMatcher(() => osmdRef.current, {
        tempo,
        onCorrect: (info: CorrectInfo) => {
            for (const pitch of info.pitches) {
                synth.playNote(pitch);
            }
            velocities.current.push(info.velocity);
            // Grade timing relative to the first note: compare how far each note
            // landed from its notated offset against where it should have been.
            if (info.ordinal === 0) {
                startRef.current = info.timestamp;
                baseOffsetRef.current = info.timeMs;
                hits.current = [makeHit(0, 0)];
                return;
            }
            const target = info.timeMs - baseOffsetRef.current;
            const actual = info.timestamp - startRef.current;
            hits.current = [...hits.current, makeHit(info.ordinal, actual - target)];
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
        const hasDynamics = new Set(velocities.current).size > 1;
        setGrade(
            computeGrade({
                correct: matcher.total,
                wrong: matcher.wrong,
                rhythm: summarize(hits.current),
                dynamics: hasDynamics ? summarizeDynamics(velocities.current) : null,
            }),
        );
    }, [matcher.complete, matcher.total, matcher.wrong]);

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
        hits.current = [];
        velocities.current = [];
        setGrade(null);
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
                <div className="flex items-center gap-4 rounded-md border border-gray-200 p-3 dark:border-gray-800">
                    <div className={`text-5xl font-bold leading-none ${GRADE_COLOR[grade.letter]}`}>
                        {grade.letter}
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
                        <dt className="text-gray-500 dark:text-gray-400">{m.scores_accuracy()}</dt>
                        <dd className="text-right font-mono tabular-nums">{grade.accuracy}%</dd>
                        <dt className="text-gray-500 dark:text-gray-400">{m.scores_timing()}</dt>
                        <dd className="text-right font-mono tabular-nums">{grade.timing}%</dd>
                        <dt className="text-gray-500 dark:text-gray-400">{m.scores_dynamics()}</dt>
                        <dd className="text-right font-mono tabular-nums">
                            {grade.dynamics === null ? "—" : `${grade.dynamics}%`}
                        </dd>
                    </dl>
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
