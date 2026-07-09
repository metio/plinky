// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Cursor, OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useRef, useState } from "react";
import { toReplayEvents } from "../../core/composition";
import { listenStepMs } from "../../core/playback";
import { LISTENED_COLOR, WINDOW_COLOR } from "../../core/scoreCanvas";
import type { Take } from "../../core/takes";
import {
    highlightCursorNotes,
    type PaintedNote,
    restoreNotes,
    trailNotes,
} from "../lib/scoreColor";
import { seekToBar, seekToWhole } from "../lib/scoreCursor";
import { useTimerChain } from "./useTimerChain";

// The synth slice playback needs: Listen scales sustain by tempo, a replay
// replays the recorded velocity and hold.
type NoteSink = {
    playNote(note: number, options?: { duration?: number; velocity?: number }): void;
};

// The listening transport: one cursor walk, one clock, one stop — driven either
// by the score (Listen: sound each voice-entry and dwell its notated length at
// the chosen tempo) or by a saved take (replay the recorded performance note for
// note, the cursor following as a visual cue that never gates the timing —
// coupling playback to the score's cursor made replayed notes bunch up, then
// drag, on notation the run doesn't mirror one-to-one).
export function useListenPlayback({
    getOsmd,
    synth,
    tempo,
    loop,
    onLap,
    centerCursor,
    markPainted,
    isPracticing,
}: {
    getOsmd: () => OpenSheetMusicDisplay | null;
    synth: NoteSink;
    // The live practice tempo, read at each tick so playback follows the dial.
    tempo: () => number;
    // The live section-loop range, read at each tick so the loop reacts to its
    // inputs without restarting the walk. Bars are 1-based.
    loop: () => { on: boolean; from: number; to: number };
    // A full pass ended — the natural end of the piece, or a loop lap — the
    // tempo trainer's cue to ramp.
    onLap: () => void;
    // Re-centre the treadmill after each cursor step; a no-op elsewhere.
    centerCursor: () => void;
    // The trail colours the score; the surface tracks that something is painted.
    markPainted: () => void;
    // Whether a self-paced run owns the cursor — stopping playback then leaves
    // the cursor shown where the matcher is using it.
    isPracticing: () => boolean;
}) {
    const chain = useTimerChain();
    const [playing, setPlaying] = useState(false);
    // The take currently replaying, for the takes list to mark.
    const [activeReplayId, setActiveReplayId] = useState<string | null>(null);
    // Tracks playback synchronously, so a second click that lands before the
    // `playing` state has re-rendered can't start a second cursor loop.
    const activeRef = useRef(false);
    // The notes lit as "now sounding", held so the highlight can be lifted when
    // the cursor moves on and when playback stops.
    const highlightRef = useRef<PaintedNote[]>([]);
    // Listen leaves a blue trail; a replay's highlight is purely transient. Stop
    // needs to know which, so the note sounding at the moment of a stop or a
    // Listen→Practice handoff joins the trail instead of snapping back to black.
    const modeRef = useRef<"listen" | "replay" | null>(null);

    // Whether the transport currently owns the cursor — synchronous.
    const active = () => activeRef.current;

    const stop = () => {
        chain.clear();
        if (modeRef.current === "listen" && highlightRef.current.length > 0) {
            trailNotes(highlightRef.current, LISTENED_COLOR);
            markPainted();
        } else {
            restoreNotes(highlightRef.current);
        }
        modeRef.current = null;
        highlightRef.current = [];
        if (!isPracticing()) {
            getOsmd()?.cursor?.hide();
        }
        activeRef.current = false;
        setPlaying(false);
        setActiveReplayId(null);
    };

    // Listen from a notated onset in whole notes (0 = the top; an active loop's
    // start bar wins): walk the cursor one voice-entry at a time, sounding the
    // notes under it and waiting their notated duration at the chosen tempo.
    const start = (from: number) => {
        const osmd = getOsmd();
        if (!osmd || activeRef.current) {
            return;
        }
        activeRef.current = true;
        modeRef.current = "listen";
        const cursor: Cursor = osmd.cursor;
        if (loop().on) {
            seekToBar(cursor, loop().from);
        } else if (from > 0) {
            seekToWhole(cursor, from);
        } else {
            cursor.reset();
        }
        cursor.show();
        setPlaying(true);
        const tick = () => {
            const range = loop();
            // Past the loop's last bar (or the score's end while looping), jump back
            // to the start bar rather than stopping — and ramp the tempo if the
            // trainer is on, so each pass drills the passage a little faster.
            if (
                range.on &&
                (cursor.iterator.EndReached || cursor.iterator.CurrentMeasureIndex > range.to - 1)
            ) {
                onLap();
                seekToBar(cursor, range.from);
            } else if (cursor.iterator.EndReached) {
                stop();
                onLap();
                return;
            }
            // Light the notes now sounding so the eye can follow the music, leaving a
            // blue trail on the ones just heard — the cursor box alone is easy to lose,
            // and the trail records which stretches the computer played once it moves on.
            trailNotes(highlightRef.current, LISTENED_COLOR);
            markPainted();
            highlightRef.current = highlightCursorNotes(osmd, WINDOW_COLOR);
            const lengths: number[] = [];
            for (const note of cursor.NotesUnderCursor()) {
                const quarters = note.Length.RealValue * 4;
                if (!note.isRest() && note.halfTone > 0) {
                    // `quarters` is a count of quarter notes; the synth wants seconds, which
                    // depends on the tempo — one quarter is 60/BPM seconds. Without scaling,
                    // the sustain is only right at 60 BPM and over-rings into a blur above it.
                    synth.playNote(note.halfTone + 12, {
                        duration: quarters * (60 / tempo()),
                    });
                }
                // Rests count too, so a written gap dwells its own length.
                lengths.push(quarters);
            }
            cursor.next();
            centerCursor();
            chain.push(tick, listenStepMs(lengths, tempo()));
        };
        tick();
    };

    // Replay a saved take straight from the recorded performance — its own onsets,
    // pitches, held lengths and velocities — so the playback is the run you gave.
    const replay = (take: Take) => {
        const osmd = getOsmd();
        if (!osmd) {
            return;
        }
        if (activeRef.current) {
            stop();
        }
        activeRef.current = true;
        modeRef.current = "replay";
        setActiveReplayId(take.id);
        const cursor: Cursor = osmd.cursor;
        cursor.reset();
        cursor.show();
        setPlaying(true);
        const events = toReplayEvents(take.composition);
        let step = 0;
        const tick = () => {
            if (step >= events.length) {
                stop();
                return;
            }
            restoreNotes(highlightRef.current);
            highlightRef.current = highlightCursorNotes(osmd, WINDOW_COLOR);
            const event = events[step]!;
            for (const note of event.notes) {
                synth.playNote(note.pitch, {
                    velocity: note.velocity,
                    duration: note.durationMs / 1000,
                });
            }
            // Advance the visual cursor alongside the audio; when the score runs out
            // before the take does, the audio simply plays on to the end.
            if (!cursor.iterator.EndReached) {
                cursor.next();
                centerCursor();
            }
            const next = events[step + 1];
            step++;
            const delay = next !== undefined ? Math.max(40, next.atMs - event.atMs) : 500;
            chain.push(tick, delay);
        };
        tick();
    };

    return { playing, activeReplayId, active, start, replay, stop };
}
