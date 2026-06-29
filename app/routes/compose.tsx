// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Button, buttonClasses } from "../components/button";
import { CoachMark } from "../components/coachMark";
import { KeyboardHint } from "../components/keyboardHint";
import { MidiConnect } from "../components/midiConnect";
import { PianoKeyboard } from "../components/pianoKeyboard";
import { StaffPreview } from "../components/staffPreview";
import { useMidiConnection, useMidiInput } from "../contexts/midi";
import { useMetronome } from "../hooks/useMetronome";
import { useSynth } from "../hooks/useSynth";
import {
    type Composition,
    decodeComposition,
    encodeComposition,
    type RecordedNote,
    toMidiNotes,
    toMusicXml,
} from "../lib/composition";
import { buildMidiFile } from "../lib/midiFile";
import { markDiscovered } from "../lib/onboarding";
import { fileStem } from "../lib/printScore";
import { routeMeta } from "../lib/site";
import { m } from "../paraglide/messages.js";
import { localizeHref } from "../paraglide/runtime.js";
import type { Route } from "./+types/compose";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(m.compose_heading(), m.meta_compose_description());
}

const FIELD =
    "rounded-md border border-gray-300 bg-transparent px-2 py-1.5 text-sm text-gray-800 dark:border-gray-700 dark:text-gray-200";

// The end of the recorded timeline in milliseconds — the moment the last-released
// note stops sounding. New notes append after it, so a loaded share keeps growing.
function tailMs(notes: RecordedNote[]): number {
    return notes.reduce((end, note) => Math.max(end, note.startMs + note.durationMs), 0);
}

function downloadBlob(data: BlobPart, type: string, filename: string): void {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

export default function Compose() {
    const [searchParams] = useSearchParams();
    const [title, setTitle] = useState("Improvisation");
    const [tempo, setTempo] = useState(120);
    const [beatsPerBar, setBeatsPerBar] = useState(4);
    const [quantizeOn, setQuantizeOn] = useState(true);
    const [notes, setNotes] = useState<RecordedNote[]>([]);
    const [checkpoint, setCheckpoint] = useState<number | null>(null);
    const [playing, setPlaying] = useState(false);
    const [copied, setCopied] = useState(false);
    const [staffXml, setStaffXml] = useState<string | null>(null);
    const [metronomeOn, setMetronomeOn] = useState(false);
    const [countingIn, setCountingIn] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const { octaveOffset } = useMidiConnection();
    const { playNote } = useSynth();
    // Click through the count-in and, once armed, through the take, so the player stays
    // in time and the captured onsets line up with the grid the staff is drawn on.
    useMetronome(metronomeOn || countingIn, tempo, beatsPerBar);

    // Open notes keyed by pitch, with the clock origin and a live mirror of the note
    // list so the input callbacks read the latest state without re-subscribing.
    const originRef = useRef<number | null>(null);
    const openRef = useRef<Map<number, { startMs: number; velocity: number }>>(new Map());
    const notesRef = useRef<RecordedNote[]>(notes);
    notesRef.current = notes;
    const timersRef = useRef<number[]>([]);

    // A shared composition arrives as ?c=<code>; load it once so it can be viewed,
    // played, extended, re-exported and re-shared.
    useEffect(() => {
        const code = searchParams.get("c");
        if (!code) {
            return;
        }
        const loaded = decodeComposition(code);
        if (loaded) {
            setNotes(loaded.notes);
            setTempo(loaded.tempo);
            setBeatsPerBar(loaded.beatsPerBar);
        }
        // Only the initial code matters; later edits should not reload over the work.
    }, [searchParams]);

    const handleNoteOn = useCallback(
        (event: { note: number; velocity: number; timestamp: number }) => {
            if (originRef.current === null) {
                // Anchor the clock so a freshly loaded share's new notes land after its tail.
                originRef.current = event.timestamp - tailMs(notesRef.current);
            }
            const startMs = event.timestamp - originRef.current;
            openRef.current.set(event.note, { startMs, velocity: event.velocity || 90 });
        },
        [],
    );

    const handleNoteOff = useCallback((event: { note: number; timestamp: number }) => {
        const open = openRef.current.get(event.note);
        if (!open || originRef.current === null) {
            return;
        }
        openRef.current.delete(event.note);
        const durationMs = Math.max(1, event.timestamp - originRef.current - open.startMs);
        const recorded: RecordedNote = {
            pitch: event.note,
            startMs: open.startMs,
            durationMs,
            velocity: open.velocity,
        };
        // The first recorded note means the player has tried composing.
        if (notesRef.current.length === 0) {
            markDiscovered("composed");
        }
        // Notes complete in release order, so keep the list sorted by onset — the
        // codec and the staff both assume ascending starts.
        setNotes((prev) => [...prev, recorded].sort((a, b) => a.startMs - b.startMs));
    }, []);

    useMidiInput({ onNoteOn: handleNoteOn, onNoteOff: handleNoteOff });

    const composition: Composition = useMemo(
        () => ({ notes, tempo, beatsPerBar }),
        [notes, tempo, beatsPerBar],
    );

    // Re-engrave a beat after the last note lands rather than on every keystroke, so a
    // fast passage doesn't thrash the OSMD renderer. Quantizing snaps to eighths for a
    // clean read; the looser setting keeps more of the played rhythm.
    useEffect(() => {
        if (notes.length === 0) {
            setStaffXml(null);
            return;
        }
        const id = window.setTimeout(() => {
            setStaffXml(
                toMusicXml(composition, {
                    title,
                    subdivisionsPerBeat: quantizeOn ? 2 : 4,
                }),
            );
        }, 150);
        return () => window.clearTimeout(id);
    }, [composition, title, quantizeOn, notes.length]);

    const stop = useCallback(() => {
        for (const id of timersRef.current) {
            window.clearTimeout(id);
        }
        timersRef.current = [];
        setPlaying(false);
    }, []);

    const play = useCallback(() => {
        stop();
        if (notes.length === 0) {
            return;
        }
        setPlaying(true);
        for (const note of notes) {
            const id = window.setTimeout(() => {
                playNote(note.pitch, {
                    velocity: note.velocity,
                    duration: Math.max(0.05, note.durationMs / 1000),
                });
            }, note.startMs);
            timersRef.current.push(id);
        }
        const end = window.setTimeout(() => setPlaying(false), tailMs(notes) + 200);
        timersRef.current.push(end);
    }, [notes, playNote, stop]);

    // Release any scheduled playback when the page goes away.
    useEffect(() => stop, [stop]);

    const reset = useCallback(() => {
        stop();
        originRef.current = null;
        openRef.current.clear();
        setNotes([]);
        setCheckpoint(null);
    }, [stop]);

    const resetToCheckpoint = useCallback(() => {
        if (checkpoint === null) {
            return;
        }
        stop();
        setNotes((prev) => prev.slice(0, checkpoint));
        // The clock re-anchors on the next note so the tail picks up after the kept part.
        originRef.current = null;
        openRef.current.clear();
    }, [checkpoint, stop]);

    const share = useCallback(() => {
        const code = encodeComposition({ notes, tempo, beatsPerBar });
        const url = `${window.location.origin}${localizeHref("/compose")}?c=${code}`;
        navigator.clipboard
            ?.writeText(url)
            .then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
            })
            .catch(() => {});
    }, [notes, tempo, beatsPerBar]);

    const downloadMidi = useCallback(() => {
        const data = buildMidiFile(toMidiNotes({ notes, tempo, beatsPerBar }), { tempo });
        downloadBlob(data, "audio/midi", `${fileStem(title)}.mid`);
    }, [notes, tempo, beatsPerBar, title]);

    const downloadMusicXml = useCallback(() => {
        const xml = toMusicXml({ notes, tempo, beatsPerBar }, { title });
        downloadBlob(xml, "application/vnd.recordare.musicxml+xml", `${fileStem(title)}.musicxml`);
    }, [notes, tempo, beatsPerBar, title]);

    // Click one bar of lead-in, then anchor the recording clock to the downbeat that
    // follows and leave the metronome running, so what's played next sits on the grid.
    // Appends after any existing tail, so a fresh canvas starts the take at beat one.
    const countIn = useCallback(() => {
        if (countingIn) {
            return;
        }
        setCountingIn(true);
        const barMs = beatsPerBar * (60_000 / tempo);
        window.setTimeout(() => {
            originRef.current = performance.now() - tailMs(notesRef.current);
            openRef.current.clear();
            setCountingIn(false);
            setMetronomeOn(true);
        }, barMs);
    }, [countingIn, beatsPerBar, tempo]);

    // Load a MIDI or MusicXML file dropped or chosen by the player, replacing the take
    // so they can carry work between devices. The parsers are pulled in on demand so
    // their bytes don't weigh on the page until a file is actually opened.
    const openFile = useCallback(
        async (file: File | undefined) => {
            setUploadError(null);
            if (!file) {
                return;
            }
            const bytes = new Uint8Array(await file.arrayBuffer());
            const isMidi =
                bytes[0] === 0x4d && bytes[1] === 0x54 && bytes[2] === 0x68 && bytes[3] === 0x64;
            let loaded: Composition | null = null;
            if (isMidi) {
                const { parseMidiFile } = await import("../lib/midiParse");
                loaded = parseMidiFile(bytes);
            } else {
                const [{ readScoreFile }, { parseMusicXml }] = await Promise.all([
                    import("../lib/musicxmlFile"),
                    import("../lib/musicxmlParse"),
                ]);
                const xml = await readScoreFile(file);
                loaded = xml ? parseMusicXml(xml) : null;
            }
            if (!loaded) {
                setUploadError(m.compose_open_error());
                return;
            }
            stop();
            setNotes(loaded.notes);
            setTempo(loaded.tempo);
            setBeatsPerBar(loaded.beatsPerBar);
            setCheckpoint(null);
            originRef.current = null;
            openRef.current.clear();
        },
        [stop],
    );

    const empty = notes.length === 0;

    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <header className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">{m.compose_heading()}</h1>
                    {/* Capture is always on, so a live indicator makes that legible —
                        otherwise a first-timer can't tell their playing is being kept. */}
                    <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70 motion-reduce:hidden" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                        </span>
                        {empty
                            ? m.compose_recording_idle()
                            : m.compose_recording_count({ count: notes.length })}
                    </span>
                </div>
                {/* The full how-to as a one-time dismissible note, so it doesn't push the
                    staff down the page on every visit. */}
                <CoachMark id="compose-intro">{m.compose_intro()}</CoachMark>
            </header>

            <section className="space-y-3">
                <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
                    {staffXml ? (
                        <StaffPreview xml={staffXml} label={m.compose_staff_label()} />
                    ) : (
                        <p className="px-2 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                            {m.compose_staff_empty()}
                        </p>
                    )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    {m.compose_sketch_note()}
                </p>
            </section>

            <section className="flex flex-wrap items-end gap-4">
                <label className="space-y-1">
                    <span className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {m.compose_title_label()}
                    </span>
                    <input
                        type="text"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        className={FIELD}
                    />
                </label>
                <label className="space-y-1">
                    <span className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {m.compose_tempo_label()}
                    </span>
                    <input
                        type="number"
                        min={40}
                        max={240}
                        value={tempo}
                        onChange={(event) =>
                            setTempo(Math.min(240, Math.max(40, Number(event.target.value) || 120)))
                        }
                        className={`${FIELD} w-20`}
                    />
                </label>
                <label className="space-y-1">
                    <span className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {m.compose_beats_label()}
                    </span>
                    <select
                        value={beatsPerBar}
                        onChange={(event) => setBeatsPerBar(Number(event.target.value))}
                        className={FIELD}
                    >
                        <option value={2}>2/4</option>
                        <option value={3}>3/4</option>
                        <option value={4}>4/4</option>
                        <option value={6}>6/4</option>
                    </select>
                </label>
                <label className="flex items-center gap-2 pb-2">
                    <input
                        type="checkbox"
                        checked={quantizeOn}
                        onChange={(event) => setQuantizeOn(event.target.checked)}
                        className="h-4 w-4"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                        {m.compose_quantize_label()}
                    </span>
                </label>
                <label className="flex items-center gap-2 pb-2">
                    <input
                        type="checkbox"
                        checked={metronomeOn}
                        onChange={(event) => setMetronomeOn(event.target.checked)}
                        className="h-4 w-4"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                        {m.compose_metronome_label()}
                    </span>
                </label>
            </section>

            <section className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={countIn} disabled={countingIn}>
                    {countingIn ? m.compose_counting_in() : m.compose_count_in()}
                </Button>
                <Button variant="secondary" onClick={playing ? stop : play} disabled={empty}>
                    {playing ? m.compose_stop() : m.compose_play()}
                </Button>
                <Button
                    variant="secondary"
                    onClick={() => setCheckpoint(notes.length)}
                    disabled={empty}
                >
                    {m.compose_set_checkpoint()}
                </Button>
                <Button
                    variant="secondary"
                    onClick={resetToCheckpoint}
                    disabled={checkpoint === null}
                >
                    {checkpoint === null
                        ? m.compose_reset_checkpoint()
                        : m.compose_reset_checkpoint_at({ count: checkpoint })}
                </Button>
                <Button variant="secondary" onClick={reset} disabled={empty}>
                    {m.compose_clear()}
                </Button>
            </section>

            <section className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" onClick={share} disabled={empty}>
                    {copied ? m.compose_copied() : m.compose_share()}
                </Button>
                <Button variant="secondary" onClick={downloadMidi} disabled={empty}>
                    {m.compose_download_midi()}
                </Button>
                <Button variant="secondary" onClick={downloadMusicXml} disabled={empty}>
                    {m.compose_download_musicxml()}
                </Button>
                <label className={buttonClasses("secondary", "cursor-pointer")}>
                    {m.compose_open_file()}
                    <input
                        type="file"
                        accept=".mid,.midi,.musicxml,.xml,.mxl,audio/midi"
                        className="sr-only"
                        onChange={(event) => {
                            void openFile(event.target.files?.[0]);
                            event.target.value = "";
                        }}
                    />
                </label>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                    {m.compose_note_count({ count: notes.length })}
                </span>
                {uploadError && (
                    <p className="w-full text-sm text-red-600 dark:text-red-400">{uploadError}</p>
                )}
            </section>

            <section className="space-y-3">
                <PianoKeyboard from={48} to={84} />
                <KeyboardHint octaveOffset={octaveOffset} />
                <details className="text-sm">
                    <summary className="cursor-pointer text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
                        {m.compose_connect_midi()}
                    </summary>
                    <div className="pt-3">
                        <MidiConnect />
                    </div>
                </details>
            </section>
        </main>
    );
}
