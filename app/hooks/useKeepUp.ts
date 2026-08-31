// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Cursor, OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useRef, useState } from "react";
import { type KeepUpResult, scoreKeepUp } from "../../core/grade";
import {
    type KeepUpState,
    type KeepUpStep,
    closeKeepUpStep,
    keepUpProgress,
    openKeepUpStep,
    startKeepUp,
    strikeKeepUp,
} from "../../core/keepUp";
import { type Hand, isPracticedHand } from "../../core/matcher";
import { FERMATA_STRETCH, NOMINAL_BPM } from "../../core/elapsed";
import {
    playOrder,
    readParts,
    readScoreExpression,
    readStartTempo,
    readTempo,
} from "../lib/scoreExpression";
import { effectiveTempo, listenStepMs } from "../../core/playback";
import { PLAYED_COLOR, SELECT_COLOR, WINDOW_COLOR } from "../../core/scoreCanvas";
import { highlightCursorNotes, litHalo } from "../lib/scoreColor";
import { useTimerChain } from "./useTimerChain";
import { jumpsBack } from "../../core/matcher";

// A note sink for the guide and the player's own strikes — the slice of the
// synth the play-along needs.
type NoteSink = { playNote(note: number, options?: { duration?: number }): void };

// Walk the engraved score once and lift the play-along timeline into the pure
// step model: every cursor position in order, each carrying the practised hand's
// pitches-with-length to catch and every note's length for the beat. Leaves the
// cursor reset. The clock then reads its beats from this array, so the run reads
// no musical data off the live cursor — the cursor only mirrors the position and
// carries the notes the painter recolours.
export function collectKeepUpSteps(osmd: OpenSheetMusicDisplay, hand: Hand): KeepUpStep[] {
    const cursor = osmd.cursor;
    const parts = readParts(osmd);
    cursor.reset();
    const steps: KeepUpStep[] = [];
    while (!cursor.iterator.EndReached) {
        // A fermata holds whatever is sounding, so read it across the position rather
        // than off any one note.
        let fermata = false;
        for (const note of cursor.NotesUnderCursor()) {
            fermata ||= readScoreExpression(note).fermata;
        }
        // An ornament is its own beat, ahead of the note it decorates — the same split
        // the matcher makes, through the same rule.
        const groups = playOrder([...cursor.NotesUnderCursor()], (note) => note);
        for (const [order, group] of groups.entries()) {
            const whole = cursor.iterator.currentTimeStamp?.RealValue ?? 0;
            const play: KeepUpStep["play"] = [];
            const accompany: KeepUpStep["accompany"] = [];
            const lengths: number[] = [];
            for (const note of group) {
                const quarters = note.Length.RealValue * 4;
                lengths.push(quarters);
                if (note.isRest() || note.halfTone <= 0) {
                    continue;
                }
                const entry = { pitch: note.halfTone + 12, quarters };
                // The practised hand's notes are yours to catch; the other hand's are the
                // accompaniment a duet sounds for you. A both-hands run has no other hand.
                // The same split the self-paced matcher uses, so choosing a hand narrows
                // the beats to catch — and the notes the guide sounds — identically in
                // both modes.
                const staffId = note.ParentStaff?.idInMusicSheet;
                if (isPracticedHand(staffId, hand, parts)) {
                    play.push(entry);
                } else {
                    accompany.push(entry);
                }
            }
            steps.push({
                whole,
                play,
                accompany,
                lengths,
                bpm: readTempo(cursor.iterator) ?? NOMINAL_BPM,
                stretch: fermata ? FERMATA_STRETCH : 1,
                advancesCursor: order === groups.length - 1,
            });
        }
        cursor.next();
    }
    cursor.reset();
    return steps;
}

// Tempo-enforced play-along ("keep up"): the cursor advances on the clock at a
// fixed tempo, not when you play. Each step is a beat to catch — clear its notes
// before the cursor moves on (a hit, painted green) or it passes as a miss
// (painted red); the notes sound as a guide when the toggle is on. A one-bar
// metronome count-in leads it in; it runs to the end and grades how many beats
// you kept up with. The pure scorer is core/keepUp; this hook owns the clock,
// the cursor walk and the painting.
export function useKeepUp({
    getOsmd,
    synth,
    tempo,
    beatsPerBar,
    centerCursor,
    // Where the music has reached, before the position sounds. The notes highway reads it
    // to draw what is coming — without it the highway has nothing to advance and simply
    // does not appear, which is what a tempo-locked run looked like until now.
    onPosition,
    onRewind,
    markPainted,
    onFinish,
}: {
    getOsmd: () => OpenSheetMusicDisplay | null;
    synth: NoteSink;
    // The live practice tempo, read at each tick so the run follows the dial.
    tempo: () => number;
    beatsPerBar: number;
    // Re-centre the treadmill after each cursor step; a no-op elsewhere.
    centerCursor: () => void;
    // Where the music has reached, before the position sounds. The notes highway reads it
    // to draw what is coming — without it there is nothing to advance and the highway does
    // not appear at all, which is what a tempo-locked run looked like until now.
    onPosition?: (whole: number) => void;
    // A written repeat has sent the run back over bars it has already painted. Announced
    // rather than acted on here: the trail belongs to the surface, the same way Listen's
    // does. Separate from finishing, which a repeat is not.
    onRewind?: () => void;
    // A run paints the score — the "play now" window, then a green/red hit/miss
    // trail it leaves in place. The surface tracks that something is painted so the
    // next run re-renders to wipe it; without this signal last run's marks persist.
    markPainted: () => void;
    // The run reached the end (not stopped early) — the surface leaves full
    // screen here so the result comes into view.
    onFinish: () => void;
}) {
    const chain = useTimerChain();
    // Live during a play-along run, then the result once it finishes.
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState({ inTime: 0, done: 0 });
    // How long the position now open lasts, in real milliseconds at the tempo being played.
    // The notes highway reads it to descend at exactly the music's pace: told how long the
    // step takes, the blocks glide over precisely that time instead of settling after it.
    const [stepMs, setStepMs] = useState<number | null>(null);
    const [result, setResult] = useState<KeepUpResult | null>(null);
    // The pitches of the beat currently open, for the on-screen keyboard to light —
    // cleared when no run owns the input so stale keys never linger lit.
    const [expected, setExpected] = useState<number[]>([]);
    // Synchronous "a run owns the input" flag, read by the MIDI routing before
    // the `running` state has re-rendered.
    const activeRef = useRef(false);
    // The pure play-along scorer (core/keepUp), advanced by the timer loop and
    // the MIDI handler between renders.
    const stateRef = useRef<KeepUpState>(startKeepUp());
    // The open step's rendered note groups, to paint green on a hit, red on a miss.
    const notesRef = useRef<SVGElement[]>([]);

    // Whether a run currently owns the note input — synchronous, for the router.
    const active = () => activeRef.current;

    // Stop a run early — the timers and the cursor wind down; no result is scored.
    const stop = () => {
        chain.clear();
        activeRef.current = false;
        stateRef.current = startKeepUp();
        setRunning(false);
        setExpected([]);
        setStepMs(null);
        getOsmd()?.cursor?.hide();
    };

    // The finished run's result is shown until the next run clears it.
    const clearResult = () => setResult(null);

    const start = ({
        hand,
        guideNotes,
        accompany,
    }: {
        hand: Hand;
        guideNotes: boolean;
        // Sound the other hand as you play yours — a duet. Only meaningful hands-separate.
        accompany: boolean;
    }) => {
        const osmd = getOsmd();
        if (!osmd || activeRef.current) {
            return;
        }
        const cursor: Cursor = osmd.cursor;
        // Lift the whole play-along timeline up front; the clock reads its beats
        // from this and the cursor is only walked to mirror the position and hold
        // the notes the painter recolours. `step` tracks the position being opened.
        const steps = collectKeepUpSteps(osmd, hand);
        // Every step carries the score's own tempo; the dial is read against the opening
        // one, so the written shape survives at whatever speed is being practised.
        const startBpm = readStartTempo(osmd) ?? NOMINAL_BPM;
        const localTempo = (at: KeepUpStep) => effectiveTempo(tempo(), at.bpm, startBpm);
        let step = 0;
        cursor.reset();
        cursor.show();
        activeRef.current = true;
        stateRef.current = startKeepUp();
        notesRef.current = [];
        setResult(null);
        setProgress({ inTime: 0, done: 0 });
        setRunning(true);

        // Resolve the step that just closed — the reducer scores it (or skips an
        // unscored position); the notes paint green or red to trail your run.
        const closeStep = () => {
            const { state, hit } = closeKeepUpStep(stateRef.current);
            stateRef.current = state;
            if (hit === null) {
                return;
            }
            for (const element of notesRef.current) {
                litHalo(element, hit ? PLAYED_COLOR : SELECT_COLOR);
            }
            setProgress(keepUpProgress(state));
        };

        // Open a collected step: feed its expected pitches to the reducer — only
        // the practised hand's, exactly as self-paced practice does, or a
        // hands-separate run would demand the other hand's notes too and every step
        // would score a miss — highlight them as "play now", and sound them if the
        // guide is on.
        const openStep = (current: KeepUpStep) => {
            const pitches = current.play.map((entry) => entry.pitch);
            // Light the on-screen keys for this beat too, so the keyboard follows the
            // clock the way the score does — the run drives the input, not the matcher,
            // which is stopped, so its `expected` would otherwise freeze the keys.
            setExpected(pitches);
            // The synth duration is in seconds — 60/BPM per quarter note.
            const seconds = (quarters: number) =>
                quarters * (60 / localTempo(current)) * current.stretch;
            if (guideNotes) {
                for (const entry of current.play) {
                    synth.playNote(entry.pitch, { duration: seconds(entry.quarters) });
                }
            }
            // The duet: sound the other hand at each beat, so the app plays alongside you.
            if (accompany) {
                for (const entry of current.accompany) {
                    synth.playNote(entry.pitch, { duration: seconds(entry.quarters) });
                }
            }
            stateRef.current = openKeepUpStep(stateRef.current, pitches);
            // Light "play now" only when this step has notes for the practised hand. A
            // hands-separate run leaves the other hand's positions unscored (closeStep
            // skips an empty step), so highlighting them would strand a mark the trail
            // never lifts. Keep the noteheads so closeStep can recolour their halos hit/miss.
            notesRef.current =
                pitches.length === 0
                    ? []
                    : highlightCursorNotes(osmd, WINDOW_COLOR).map((painted) => painted.element);
            // The highlight — and the hit/miss colour closeStep/registerNote later
            // paint over the same elements — dirties the score. Flag it so the next
            // run wipes the trail; this hook never restores it itself.
            if (notesRef.current.length > 0) {
                markPainted();
            }
        };

        const finish = () => {
            activeRef.current = false;
            setRunning(false);
            setStepMs(null);
            setExpected([]);
            cursor.hide();
            setResult(scoreKeepUp(stateRef.current.hits));
            stateRef.current = startKeepUp();
            onFinish();
        };

        const tick = () => {
            closeStep();
            const current = steps[step];
            if (current) {
                // Printed EARLIER than the position before it means the barline has sent
                // the run back over bars it has already coloured green and red, so the
                // trail stops saying how far this pass has got.
                const previous = steps[step - 1];
                if (previous !== undefined && jumpsBack(previous, current)) {
                    onRewind?.();
                }
                onPosition?.(current.whole);
            }
            if (!current) {
                finish();
                return;
            }
            openStep(current);
            // Mirror the reducer's position onto the visual cursor, in lock-step
            // with the collected steps, so the painter recolours the right notes — an
            // ornament leaves it where it is, being printed on the note it decorates.
            if (current.advancesCursor) {
                cursor.next();
            }
            step += 1;
            centerCursor();
            const dwell = listenStepMs(current.lengths, localTempo(current), current.stretch);
            setStepMs(dwell);
            chain.push(tick, dwell);
        };

        // A one-bar count-in on the metronome (already ticking) before the first note.
        const beatMs = 60000 / tempo();
        chain.push(tick, beatMs * beatsPerBar);
    };

    // A struck pitch that the open step expects counts toward catching it; once all
    // are in, the step goes green early. The note sounds so a MIDI player hears
    // their own playing over the guide.
    const registerNote = (note: number) => {
        if (!activeRef.current) {
            return;
        }
        synth.playNote(note);
        const { state, caught } = strikeKeepUp(stateRef.current, note);
        stateRef.current = state;
        if (caught) {
            for (const element of notesRef.current) {
                litHalo(element, PLAYED_COLOR);
            }
        }
    };

    return {
        running,
        progress,
        result,
        expected,
        active,
        start,
        stop,
        clearResult,
        registerNote,
        stepMs,
    };
}
