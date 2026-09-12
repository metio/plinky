// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLatest } from "./useLatest";
import type { Cursor, OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useCallback, useMemo, useRef, useState } from "react";
import { toReplayEvents } from "../../core/composition";
import { NO_SCORE_MARKS, type ScoreMarks, tempoAt } from "../../core/musicxmlMarks";
import { type ListenStep, performListenStep } from "../../core/listenPerformance";
import { type Hand2, jumpsBack } from "../../core/matcher";
import { NOMINAL_BPM } from "../../core/elapsed";
import { effectiveTempo } from "../../core/playback";
import { LISTENED_COLOR, WINDOW_COLOR } from "../../core/scoreCanvas";
import type { Take } from "../../core/takes";
import { collectListenSteps } from "../lib/listenSteps";
import { readStartTempo } from "../lib/scoreExpression";
import {
    highlightCursorNotes,
    type PaintedNote,
    type NoteRemap,
    restoreNotes,
    retargetPainted,
    trailNotes,
} from "../lib/scoreColor";
import { seekToBar, seekToOrdinal, seekToWhole } from "../lib/scoreCursor";
import type { StrikeOwner } from "../ports/audioEngine";
import { useTimerChain } from "./useTimerChain";

// The synth slice playback needs: Listen scales sustain by tempo, a replay
// replays the recorded velocity and hold, and a stop takes back what was struck.
type NoteSink = {
    playNote(
        note: number,
        options?: {
            duration?: number;
            velocity?: number;
            pedalled?: boolean;
            delay?: number;
            owner?: StrikeOwner;
        },
    ): void;
    silenceStrikes(owner: StrikeOwner): void;
};

// One shared empty map rather than a fresh one per silent position: the keyboard re-renders
// on identity, and a new empty map every beat would repaint it for nothing.
const NOTHING_SOUNDING: ReadonlyMap<number, Hand2> = new Map();

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
    onRewind,
    centerCursor,
    onPosition,
    marks = NO_SCORE_MARKS,
    markPainted,
    isPracticing,
    // Light each played note on a connected instrument. Passed in rather than taken
    // from the MIDI context: playback is about sound and cursor, and a hook that
    // reached for a provider could not be used — or tested — outside one.
    echoNote = () => {},
    silenceEcho = () => {},
    shaped = () => true,
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
    // A written repeat has sent playback back over bars it has already coloured. Separate
    // from onLap because a lap is the player drilling a range and a repeat is the page
    // telling the reader to go round — and the lap also ramps the tempo, which a repeat
    // must not. Announced rather than acted on here: the trail belongs to the surface.
    onRewind?: (span: { from: number; to: number }) => void;
    // Re-centre the treadmill after each cursor step; a no-op elsewhere.
    centerCursor: () => void;
    // Where the music has reached, as a notated onset in whole notes, before the position
    // sounds. The notes highway reads this to draw what is coming: it shows the same
    // lookahead whether a run or Listen is walking the music, so choosing that reading
    // mode does not mean losing it the moment the computer plays.
    onPosition?: (whole: number) => void;
    // The score's markings, read from the file — the dynamics, the arches, the pedal, the
    // octave lines and the key an ornament reaches into.
    marks?: ScoreMarks;
    // The trail colours the score; the surface tracks that something is painted.
    markPainted: () => void;
    // Whether a self-paced run owns the cursor — stopping playback then leaves
    // the cursor shown where the matcher is using it.
    isPracticing: () => boolean;
    echoNote?: (note: number, velocity: number, durationMs: number) => void;
    // Release everything the echo is still holding — playback stopping is a request
    // for silence on the instrument too, not only in the browser.
    silenceEcho?: () => void;
    // Whether to play with the human touch. Read on every position, since it is a
    // preference the player can flip while the piece plays.
    shaped?: () => boolean;
}) {
    const chain = useTimerChain();
    // Every note this transport strikes goes out under this, so a stop can silence exactly
    // what playback started and nothing the player is sounding themselves.
    const [owner] = useState<StrikeOwner>(() => Symbol("listen"));
    // Through a ref: the walk is set up inside a callback that must not be rebuilt every
    // time a new marks object arrives, and what it needs is whatever is current when a
    // playback actually starts.
    const marksRef = useLatest(marks);
    const [playing, setPlaying] = useState(false);
    // Which notes are sounding at this moment, and in which hand — the on-screen keyboard
    // lights them. Not derived from the step model by the surface, because "now" is a fact
    // only this clock knows: the position being sounded, not the one the cursor is drawn on
    // (an ornament leaves the cursor where it is) and not the one the matcher last saw.
    const [sounding, setSounding] = useState<ReadonlyMap<number, Hand2>>(NOTHING_SOUNDING);
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

    // Everything a stop does except cut the sound. A pass that plays to its end calls this
    // alone, so its last notes ring out for the length the score gives them.
    const finish = () => {
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
        setSounding(NOTHING_SOUNDING);
        highlightRef.current = [];
        if (!isPracticing()) {
            getOsmd()?.cursor?.hide();
        }
        activeRef.current = false;
        setPlaying(false);
        setActiveReplayId(null);
    };

    // A stop the player asked for, or another transport taking over. A strike is scheduled
    // whole on the audio clock, so the notes already struck — a pedalled bass stretched to
    // the pedal lift, a rolled chord's later notes still waiting on their delay — would
    // otherwise sound on after the cursor stopped, and under the next pass.
    const stop = () => {
        synth.silenceStrikes(owner);
        finish();
    };

    // Listen from a notated onset in whole notes (0 = the top; an active loop's
    // start bar wins): walk the cursor one voice-entry at a time, sounding the
    // notes under it and waiting their notated duration at the chosen tempo.
    // `at` is the cursor position to resume on, where the caller knows it: an onset
    // names two places on a repeated piece, and a stop on the second pass must not
    // start the first again.
    const start = (from: number, at = -1) => {
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
        const steps = collectListenSteps(osmd, marksRef.current);
        // Every baked tempo is the score's own; the dial is read against the opening one.
        const startBpm = tempoAt(marksRef.current.tempi, 0) ?? readStartTempo(osmd) ?? NOMINAL_BPM;
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
        const anchored = at >= 0 ? steps.findIndex((position) => position.position === at) : -1;
        if (loop().on) {
            seekToBar(cursor, loop().from);
            step = barStart(loop().from);
        } else if (anchored >= 0) {
            seekToOrdinal(cursor, at);
            step = anchored;
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
                    finish();
                    onLap();
                    return;
                }
                onLap();
                seekToBar(cursor, range.from);
                step = lapStart;
            } else if (step >= steps.length) {
                finish();
                onLap();
                return;
            }
            const current = steps[step]!;
            // The note just heard joins the blue trail — the cursor box alone is easy to
            // lose, and the trail records which stretches the computer played once it
            // moves on. Laid BEFORE the rewind below looks at the trail: on the tick that
            // sends playback back, the note being left is the repeated section's last, and
            // a trail laid after the uncolouring would leave that one note blue every pass.
            trailNotes(highlightRef.current, LISTENED_COLOR);
            markPainted();
            // A step printed EARLIER than the one before it means the repeat barline has
            // sent playback back. The bars ahead are still blue from the first pass, so the
            // trail stops saying where the music has reached at the exact moment the score
            // asks for the same bars again.
            const previous = steps[step - 1];
            if (previous !== undefined && jumpsBack(previous, current)) {
                onRewind?.({ from: current.whole, to: previous.whole });
            }
            onPosition?.(current.whole);
            setSounding(
                current.notes.length === 0
                    ? NOTHING_SOUNDING
                    : new Map(current.notes.map((note) => [note.pitch, note.hand])),
            );
            // Light the notes now sounding so the eye can follow the music. The cursor is
            // walked in step with the clock, but anything that walks the score between
            // ticks leaves it at the top; a cursor found somewhere other than this step's
            // own position is put there first, so the highlight and the trail stay on the
            // notes that are sounding.
            if (
                cursor.iterator.EndReached ||
                cursor.iterator.CurrentMeasureIndex !== current.measureIndex ||
                Math.abs((cursor.iterator.currentTimeStamp?.RealValue ?? 0) - current.whole) > 1e-6
            ) {
                seekToOrdinal(cursor, current.position);
            }
            highlightRef.current = highlightCursorNotes(osmd, WINDOW_COLOR);
            // How each note sounds: its written length and touch at this position's tempo,
            // less what the texture, the line and the soft pedal take off it, and — with
            // the touch on — when it lands relative to the others struck with it.
            const { played, advanceMs } = performListenStep(
                steps,
                step,
                localTempo(current),
                shaped(),
            );
            for (const { note, delayMs, durationSeconds, velocity, voiced } of played) {
                synth.playNote(note.pitch, {
                    duration: durationSeconds,
                    velocity: voiced,
                    pedalled: note.pedalled,
                    delay: delayMs / 1000,
                    owner,
                });
                // …and light the same note on a connected instrument, so the piece
                // can be watched as well as heard. Inert unless asked for.
                echoNote(note.pitch, velocity, durationSeconds * 1000);
            }
            if (current.advancesCursor) {
                cursor.next();
            }
            step += 1;
            centerCursor();
            chain.push(tick, advanceMs);
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
                finish();
                return;
            }
            restoreNotes(highlightRef.current);
            highlightRef.current = highlightCursorNotes(osmd, WINDOW_COLOR);
            const event = events[step]!;
            for (const note of event.notes) {
                synth.playNote(note.pitch, {
                    velocity: note.velocity,
                    duration: note.durationMs / 1000,
                    owner,
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

    // Stable entry points over the closures above, which are rebuilt every render so they
    // read the live props: a consumer memoised on this hook's result must be able to hold,
    // or the play session's contexts change value on every note.
    const api = useLatest({ active, start, replay, stop });
    const activeNow = useCallback(() => api.current.active(), []);
    const startAt = useCallback((from: number, at?: number) => api.current.start(from, at), []);
    const replayTake = useCallback((take: Take) => api.current.replay(take), []);
    const stopNow = useCallback(() => api.current.stop(), []);
    // The score was redrawn in place under a playback: follow the lit notes to the fresh
    // noteheads, which the redraw restored still lit. Holding the discarded ones would lift
    // and trail nothing visible and leave a fresh note lit "now sounding" for good.
    const retarget = useCallback((remap: NoteRemap) => {
        highlightRef.current = retargetPainted(highlightRef.current, remap);
    }, []);
    return useMemo(
        () => ({
            playing,
            activeReplayId,
            sounding,
            active: activeNow,
            start: startAt,
            replay: replayTake,
            stop: stopNow,
            retarget,
        }),
        [playing, activeReplayId, sounding, activeNow, startAt, replayTake, stopNow, retarget],
    );
}
