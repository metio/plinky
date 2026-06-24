// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Cursor, OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useEffect, useRef, useState } from "react";
import { useMidiConnection, useMidiInput } from "../contexts/midi";
import { useScoreMatcher } from "../hooks/useScoreMatcher";
import { useSynth } from "../hooks/useSynth";
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
    const synth = useSynth();
    const [ready, setReady] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [tempo, setTempo] = useState(100);

    const matcher = useScoreMatcher(() => osmdRef.current, {
        onCorrect: (pitches) => {
            for (const pitch of pitches) {
                synth.playNote(pitch);
            }
        },
    });
    useMidiInput({ onNoteOn: (event) => matcher.registerNote(event.note) });
    const { support, status, devices, requestAccess } = useMidiConnection();
    const connected = status === "ready" && devices.length > 0;

    useEffect(() => {
        tempoRef.current = tempo;
    }, [tempo]);

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

            {matcher.complete && (
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                    {m.play_complete()}
                </p>
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
