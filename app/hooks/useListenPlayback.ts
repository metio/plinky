// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Cursor, OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useRef, useState } from "react";
import { toReplayEvents } from "../../core/composition";
import { type Articulation, performNote } from "../../core/expression";
import { type OrnamentKind, ornamentNotes } from "../../core/ornament";
import { slurredOnwardAt } from "../../core/slur";
import { volumeAt } from "../../core/dynamics";
import { ringUntil } from "../../core/pedal";
import { FERMATA_STRETCH, NOMINAL_BPM } from "../../core/elapsed";
import { effectiveTempo, listenStepMs } from "../../core/playback";
import { LISTENED_COLOR, WINDOW_COLOR } from "../../core/scoreCanvas";
import type { Take } from "../../core/takes";
import {
    playOrder,
    readDynamics,
    readPedalSpans,
    readKeyFifths,
    readOrnament,
    readScoreExpression,
    readSlurSpans,
    readStartTempo,
    readTempo,
} from "../lib/scoreExpression";
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

// One striking note at a position, with the marks `performNote` turns into how
// long and how loud it sounds — everything but the tempo and the position's
// dynamic, which are applied at play time.
type ListenNote = {
    pitch: number;
    soundQuarters: number;
    articulation: Articulation;
    accent: boolean;
    marcato: boolean;
    slurred: boolean;
};

// One position on the listening timeline, in cursor order — collected once when
// Listen starts so the clock reads its notes off this model, not the live cursor.
// Every position appears (rests included) so an index stays lock-step with the
// visual cursor the surface still advances and seeks.
export type ListenStep = {
    // The notes to strike here — a tie's held continuations and rests are already
    // dropped, so this is exactly what sounds.
    notes: ListenNote[];
    // The dynamic in force here (0..127), or null when the score marks none — the
    // same for every note at the position, so it is read once.
    dynamicVolume: number | null;
    // Every note's notated length in quarter notes (rests included): the beat's
    // duration comes from the shortest, so the clock advances with the notation.
    lengths: number[];
    // The notated onset in whole notes, to resume from a `from` point, and the
    // 0-based bar, to lap a section loop — the position logic reads these instead
    // of the live cursor's iterator.
    whole: number;
    measureIndex: number;
    // The tempo in force here and how much longer than written the position is held, so
    // playback follows a tempo change and waits at a fermata — the same reading the
    // graded run measures against, or the two would ask for different performances.
    bpm: number;
    stretch: number;
    // Whether sounding this step moves the visual cursor on. False for an ornament,
    // which is printed on the very note it decorates.
    advancesCursor: boolean;
};

// Walk the engraved score once and lift the listening timeline into the pure step
// model: every cursor position with its striking notes, the dynamic in force, and
// the lengths for the beat. Leaves the cursor reset. The clock then reads its
// notes from this array, so playback reads no musical data off the live cursor —
// the cursor only mirrors the position and carries the notes the trail colours.
export function collectListenSteps(osmd: OpenSheetMusicDisplay): ListenStep[] {
    const cursor = osmd.cursor;
    // Every dynamic the score writes, read once for the walk: a mark stands until the
    // next one, so it belongs to the position's place in the piece, not to the position.
    const dynamics = readDynamics(osmd);
    // Where the score asks for the sustain pedal: under it the harmony pools, and a note
    // keeps sounding past its written length until the pedal comes up.
    const pedals = readPedalSpans(osmd);
    // The arches, as spans. Read before the walk below, because reading them is itself a
    // walk and it leaves the cursor reset.
    const slurs = readSlurSpans(osmd);
    // Which notes an ornament reaches for depends on the key it is written in.
    const fifths = readKeyFifths(osmd);
    cursor.reset();
    const steps: ListenStep[] = [];
    while (!cursor.iterator.EndReached) {
        // The dynamic in force is the same for every note under the cursor, so read
        // it once per position.
        const dynamicVolume = volumeAt(dynamics, cursor.iterator.currentTimeStamp?.RealValue ?? 0);
        // A fermata holds whatever is sounding, so it is a property of the position —
        // read across every note under the cursor, rests included.
        let fermata = false;
        for (const note of cursor.NotesUnderCursor()) {
            fermata ||= readScoreExpression(note).fermata;
        }
        // An ornament sounds before the note it decorates, not with it — the same split
        // the matcher makes, through the same rule, so Listen and the graded run ask for
        // one performance rather than two.
        const groups = playOrder([...cursor.NotesUnderCursor()], (note) => note);
        for (const [order, group] of groups.entries()) {
            const notes: ListenNote[] = [];
            const lengths: number[] = [];
            const whole = cursor.iterator.currentTimeStamp?.RealValue ?? 0;
            for (const note of group) {
                const expression = readScoreExpression(note);
                // A tie's later notes are already sounding from the tie start, so skip
                // the re-strike; rests never sound.
                if (!note.isRest() && note.halfTone > 0 && expression.strike) {
                    notes.push({
                        pitch: note.halfTone + 12,
                        // Under the pedal the damper holds the note, so it rings on
                        // whether or not the written value is up.
                        soundQuarters: ringUntil(pedals, whole, expression.soundQuarters / 4) * 4,
                        articulation: expression.articulation,
                        accent: expression.accent,
                        marcato: expression.marcato,
                        // From the span, not the note: the engraving hangs a slur on its
                        // two end notes only, so a note in the middle of an arch reports
                        // none of its own and would play detached.
                        slurred: slurredOnwardAt(slurs, whole),
                    });
                }
                // Rests count too, so a written gap dwells its own length — the cursor
                // advances by the notated rhythm regardless of what sounds.
                lengths.push(expression.notatedQuarters);
            }
            const step: ListenStep = {
                notes,
                dynamicVolume,
                lengths,
                whole,
                measureIndex: cursor.iterator.CurrentMeasureIndex,
                bpm: readTempo(cursor.iterator) ?? NOMINAL_BPM,
                stretch: fermata ? FERMATA_STRETCH : 1,
                advancesCursor: order === groups.length - 1,
            };
            // A trill, mordent or turn is not a decoration on the note — it is an
            // instruction to play a short figure in its place. Printed but not played, the
            // page and the sound disagree about what the bar contains, and a reader
            // learning to recognise the sign hears nothing happen where it is written.
            const ornament = group.length === 1 ? readOrnament(group[0]) : null;
            steps.push(...(ornament ? spellOutOrnament(step, ornament, fifths) : [step]));
        }
        cursor.next();
    }
    cursor.reset();
    return steps;
}

// One position carrying an ornament, spelled out as the notes it actually sounds.
//
// The figure replaces the note, so it is emitted as a run of positions sharing the written
// length between them — and only the last one moves the cursor, exactly as a grace note's
// does. The cursor stays on the note the sign is printed over for the whole figure, which
// is where a reader's eye is.
//
// Only a lone note is spelled out. An ornament over one note of a chord is a real piece of
// notation, but the figure would have to be woven against the notes held under it, and a
// chord played as a run of single notes would be a worse lie than a chord played plainly.
function spellOutOrnament(step: ListenStep, kind: OrnamentKind, fifths: number): ListenStep[] {
    const note = step.notes[0];
    if (!note) {
        return [step];
    }
    // The written length, not the sounding one: a pedal may ring the note on past the bar,
    // but the figure has only the note's own time to fit into.
    const written = step.lengths[0] ?? note.soundQuarters;
    const figure = ornamentNotes(note.pitch, written, kind, fifths);
    if (figure.length < 2) {
        return [step];
    }
    return figure.map((one, index) => ({
        ...step,
        notes: [{ ...note, pitch: one.pitch, soundQuarters: one.quarters }],
        lengths: [one.quarters],
        advancesCursor: index === figure.length - 1 && step.advancesCursor,
    }));
}

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
    onPosition,
    markPainted,
    isPracticing,
    // Light each played note on a connected instrument. Passed in rather than taken
    // from the MIDI context: playback is about sound and cursor, and a hook that
    // reached for a provider could not be used — or tested — outside one.
    echoNote = () => {},
    silenceEcho = () => {},
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
    // Where the music has reached, as a notated onset in whole notes, before the position
    // sounds. The notes highway reads this to draw what is coming: it shows the same
    // lookahead whether a run or Listen is walking the music, so choosing that reading
    // mode does not mean losing it the moment the computer plays.
    onPosition?: (whole: number) => void;
    // The trail colours the score; the surface tracks that something is painted.
    markPainted: () => void;
    // Whether a self-paced run owns the cursor — stopping playback then leaves
    // the cursor shown where the matcher is using it.
    isPracticing: () => boolean;
    echoNote?: (note: number, velocity: number, durationMs: number) => void;
    // Release everything the echo is still holding — playback stopping is a request
    // for silence on the instrument too, not only in the browser.
    silenceEcho?: () => void;
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
        // Playback holds its echoed notes open on a timer, not on the audio engine,
        // so clearing the chain alone would leave the instrument lit for up to a
        // note's length after the player asked for silence.
        silenceEcho();
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
        // Lift the whole listening timeline up front; the clock reads its notes from
        // this and the cursor is only walked to mirror the position and hold the
        // notes the trail colours. `step` tracks the position being sounded.
        const steps = collectListenSteps(osmd);
        // Every baked tempo is the score's own; the dial is read against the opening one.
        const startBpm = readStartTempo(osmd) ?? NOMINAL_BPM;
        // The tempo to sound the position under the cursor at.
        const localTempo = (at: ListenStep) => effectiveTempo(tempo(), at.bpm, startBpm);
        // The first playable index at the loop's start bar, or the resume onset, or
        // the top — and seek the visual cursor to match.
        const barStart = (bar: number) =>
            Math.max(
                0,
                steps.findIndex((position) => position.measureIndex >= bar - 1),
            );
        let step: number;
        if (loop().on) {
            seekToBar(cursor, loop().from);
            step = barStart(loop().from);
        } else if (from > 0) {
            seekToWhole(cursor, from);
            step = Math.max(
                0,
                steps.findIndex((position) => position.whole >= from - 1e-6),
            );
        } else {
            cursor.reset();
            step = 0;
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
                (step >= steps.length || (steps[step]?.measureIndex ?? 0) > range.to - 1)
            ) {
                const lapStart = barStart(range.from);
                // An inverted or out-of-piece range (to < from, or a start past the last
                // bar) resolves its lap start outside [from, to]; laping there would spin on
                // step 0 every tick, re-firing onLap and re-sounding note 0. Stop instead.
                if ((steps[lapStart]?.measureIndex ?? 0) > range.to - 1) {
                    stop();
                    onLap();
                    return;
                }
                onLap();
                seekToBar(cursor, range.from);
                step = lapStart;
            } else if (step >= steps.length) {
                stop();
                onLap();
                return;
            }
            const current = steps[step]!;
            onPosition?.(current.whole);
            // Light the notes now sounding so the eye can follow the music, leaving a
            // blue trail on the ones just heard — the cursor box alone is easy to lose,
            // and the trail records which stretches the computer played once it moves on.
            trailNotes(highlightRef.current, LISTENED_COLOR);
            markPainted();
            highlightRef.current = highlightCursorNotes(osmd, WINDOW_COLOR);
            for (const note of current.notes) {
                // performNote turns the note's marks into how long and how loud it
                // sounds — staccato clips it, an accent strikes it harder, the marked
                // dynamic sets its loudness — scaled to seconds at the current tempo.
                const { durationSeconds, velocity } = performNote(
                    {
                        quarters: note.soundQuarters,
                        articulation: note.articulation,
                        accent: note.accent,
                        marcato: note.marcato,
                        slurred: note.slurred,
                        dynamicVolume: current.dynamicVolume,
                    },
                    localTempo(current),
                );
                synth.playNote(note.pitch, { duration: durationSeconds, velocity });
                // …and light the same note on a connected instrument, so the piece
                // can be watched as well as heard. Inert unless asked for.
                echoNote(note.pitch, velocity, durationSeconds * 1000);
            }
            if (current.advancesCursor) {
                cursor.next();
            }
            step += 1;
            centerCursor();
            chain.push(tick, listenStepMs(current.lengths, localTempo(current), current.stretch));
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
                echoNote(note.pitch, note.velocity, note.durationMs);
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
