// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Cursor, OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useCallback, useMemo, useRef, useState } from "react";
import { type KeepUpResult, scoreKeepUp } from "../../core/grade";
import {
    KEEP_UP_LATE_MS,
    type KeepUpState,
    type KeepUpStep,
    closeKeepUpStep,
    keepUpProgress,
    openKeepUpStep,
    settleKeepUp,
    startKeepUp,
    strikeKeepUp,
} from "../../core/keepUp";
import { useScheduler } from "../contexts/services";
import type { Hand } from "../../core/matcher";
import { NOMINAL_BPM, positionAdvances } from "../../core/elapsed";
import { readParts, readStartTempo } from "../lib/scoreExpression";
import { effectiveTempo, subStepAdvanceMs } from "../../core/playback";
import { fitGraces } from "../../core/listenPerformance";
import { PLAYED_COLOR, SELECT_COLOR, WINDOW_COLOR } from "../../core/scoreCanvas";
import { highlightCursorNotes, litHalos } from "../lib/scoreColor";
import { useLatest } from "./useLatest";
import { useTimerChain } from "./useTimerChain";
import { shortestAt } from "../lib/listenSteps";
import { readPosition, type ScorePosition } from "../lib/scorePosition";
import { NO_SCORE_MARKS } from "../../core/musicxmlMarks";
import { jumpsBack } from "../../core/matcher";

// A note sink for the guide and the player's own strikes — the slice of the
// synth the play-along needs.
type NoteSink = {
    playNote(note: number, options?: { duration?: number; device?: string }): void;
};

// Walk the engraved score once and lift the play-along timeline into the pure
// step model: every cursor position in order, each carrying the practised hand's
// pitches-with-length to catch and every note's length for the beat. Leaves the
// cursor reset. The clock then reads its beats from this array, so the run reads
// no musical data off the live cursor — the cursor only mirrors the position and
// carries the notes the painter recolours.
// The lengths at a position, with the other voice's next onset among them when it
// arrives before the shortest note here ends — so the beat dwells to the next onset.
function withAdvance(lengths: number[], advance: number): number[] {
    const shortest = lengths.length > 0 ? Math.min(...lengths) : 0;
    return advance < shortest ? [...lengths, advance] : lengths;
}

export function collectKeepUpSteps(osmd: OpenSheetMusicDisplay, hand: Hand): KeepUpStep[] {
    const cursor = osmd.cursor;
    const parts = readParts(osmd);
    cursor.reset();
    const steps: KeepUpStep[] = [];
    // The ornament split, the tie, which hand a note is — the same reading the matcher
    // and Listen make, through the same reader. No marks: keep-up keeps the engraver's
    // tempo. Walked first, then read: how long a beat lasts is the distance to the next.
    const positions: ScorePosition[] = [];
    while (!cursor.iterator.EndReached) {
        positions.push(readPosition(osmd, parts, NO_SCORE_MARKS, hand));
        cursor.next();
    }
    const advances = positionAdvances(positions.map(shortestAt));
    for (const [at, position] of positions.entries()) {
        const { whole } = position;
        const advance = advances[at] ?? 0;
        // A grace is written with a length it does not have: it borrows from the beat it
        // decorates. Its time comes out of that beat, fitted the way Listen fits it, so a
        // decorated position lasts what it is written to rather than grace and beat both.
        const fitted = fitGraces(
            position.groups
                .slice(0, -1)
                .map((group) =>
                    Math.max(0, ...group.map((entry) => entry.expression.notatedQuarters)),
                ),
            advance,
        );
        const graceTaken = fitted.graces.reduce((sum, one) => sum + one, 0);
        for (const [order, group] of position.groups.entries()) {
            const isBeat = order === position.groups.length - 1;
            const play: KeepUpStep["play"] = [];
            const accompany: KeepUpStep["accompany"] = [];
            const lengths: number[] = [];
            for (const entry of group) {
                const quarters = entry.expression.notatedQuarters;
                lengths.push(quarters);
                // A tie's later notes are the same sound continuing: the key is already
                // down and the score asks for it to stay down. The beat still dwells its
                // written length (the length is kept above), but there is nothing to
                // catch there and nothing for the guide to strike again.
                if (!entry.sounds || !entry.expression.strike) {
                    continue;
                }
                const note = { pitch: entry.pitch, quarters };
                // The practised hand's notes are yours to catch; the other hand's are the
                // accompaniment a duet sounds for you. A both-hands run has no other hand.
                if (entry.practised) {
                    play.push(note);
                } else {
                    accompany.push(note);
                }
            }
            const beatLengths = withAdvance(lengths, advance);
            steps.push({
                whole,
                play,
                accompany,
                lengths: !isBeat
                    ? [fitted.graces[order] ?? 0]
                    : graceTaken > 0
                      ? beatLengths.map((length) => Math.max(0, length - graceTaken))
                      : beatLengths,
                bpm: position.bpm,
                stretch: position.stretch,
                position: at,
                advancesCursor: isBeat,
            });
        }
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
    onRewind?: (span: { from: number; to: number }) => void;
    // A run paints the score — the "play now" window, then a green/red hit/miss
    // trail it leaves in place. The surface tracks that something is painted so the
    // next run re-renders to wipe it; without this signal last run's marks persist.
    markPainted: () => void;
    // The run reached the end (not stopped early) — the surface leaves full
    // screen here so the result comes into view.
    onFinish: () => void;
}) {
    const chain = useTimerChain();
    const scheduler = useScheduler();
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
    // The noteheads of the beat that has closed but is still open to a late strike, so
    // its verdict can colour them once the window has passed.
    const closingNotesRef = useRef<SVGElement[]>([]);

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

        // A closed beat's verdict is final: the notes paint green or red to trail the
        // run. Reached either when its late window passes or, on a beat shorter than the
        // window, when the beat after it closes.
        const paintVerdict = (hit: boolean | null, state: KeepUpState) => {
            if (hit === null) {
                return;
            }
            const color = hit ? PLAYED_COLOR : SELECT_COLOR;
            litHalos(closingNotesRef.current.map((element) => ({ element, color })));
            setProgress(keepUpProgress(state));
        };
        const settle = () => {
            if (!activeRef.current) {
                return;
            }
            const { state, hit } = settleKeepUp(stateRef.current);
            stateRef.current = state;
            paintVerdict(hit, state);
        };

        // Close the open beat. It stays open to a late strike for a moment, so its
        // verdict comes with the settle scheduled here; a beat still waiting for that
        // moment when the next one closes is settled first, so verdicts stay in order.
        const closeStep = () => {
            const { state, settled } = closeKeepUpStep(stateRef.current, scheduler.now());
            stateRef.current = state;
            paintVerdict(settled, state);
            closingNotesRef.current = notesRef.current;
            notesRef.current = [];
            if (state.closing !== null) {
                chain.push(settle, KEEP_UP_LATE_MS);
            }
        };

        // Open a collected step: feed its expected pitches to the reducer — only
        // the practised hand's, exactly as self-paced practice does, or a
        // hands-separate run would demand the other hand's notes too and every step
        // would score a miss — highlight them as "play now", and sound them if the
        // guide is on.
        const openStep = (current: KeepUpStep, dwellMs: number, next: KeepUpStep | undefined) => {
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
            stateRef.current = openKeepUpStep(stateRef.current, pitches, {
                at: scheduler.now(),
                dwellMs,
                next: next?.play.map((entry) => entry.pitch) ?? [],
            });
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
                    // The beat just closed is the section's last, and its verdict would
                    // otherwise land after the uncolouring, on its late-strike timer, and
                    // leave that one note coloured every pass. Its verdict is settled from
                    // what has arrived, so the rewind clears a finished trail.
                    settle();
                    onRewind?.({ from: current.whole, to: previous.whole });
                }
                onPosition?.(current.whole);
            }
            if (!current) {
                // The last beat is still open to a late strike; its verdict, and the
                // result built from every verdict, wait for that moment to pass.
                chain.push(() => {
                    settle();
                    finish();
                }, KEEP_UP_LATE_MS);
                return;
            }
            // The same sub-step rule Listen keeps time by: the graces ahead of a beat and
            // the beat itself last, together, what the position is written to last.
            const dwell = subStepAdvanceMs(
                steps,
                step,
                localTempo(current),
                (at) => steps[at]?.stretch ?? 1,
            );
            openStep(current, dwell, steps[step + 1]);
            // Mirror the reducer's position onto the visual cursor, in lock-step
            // with the collected steps, so the painter recolours the right notes — an
            // ornament leaves it where it is, being printed on the note it decorates.
            if (current.advancesCursor) {
                cursor.next();
            }
            step += 1;
            centerCursor();
            setStepMs(dwell);
            chain.push(tick, dwell);
        };

        // A one-bar count-in on the metronome (already ticking) before the first note.
        const beatMs = 60000 / tempo();
        chain.push(tick, beatMs * beatsPerBar);
    };

    // A struck pitch that the open step expects counts toward catching it; once all
    // are in, the step goes green early. The note sounds so a player hears their own
    // playing over the guide — unless the instrument they struck it on already makes
    // its own sound, which the synth knows by the device.
    const registerNote = (note: number, at: number, device?: string) => {
        if (!activeRef.current) {
            return;
        }
        synth.playNote(note, { device });
        const { state, caught } = strikeKeepUp(stateRef.current, note, at);
        stateRef.current = state;
        if (caught) {
            litHalos(notesRef.current.map((element) => ({ element, color: PLAYED_COLOR })));
        }
    };

    // Stable entry points over the closures above, which read the live props: a consumer
    // memoised on this hook's result must be able to hold.
    const api = useLatest({ active, start, stop, clearResult, registerNote });
    const activeNow = useCallback(() => api.current.active(), []);
    const startRun = useCallback(
        (options: Parameters<typeof start>[0]) => api.current.start(options),
        [],
    );
    const stopNow = useCallback(() => api.current.stop(), []);
    const clearResultNow = useCallback(() => api.current.clearResult(), []);
    const registerNoteNow = useCallback(
        (note: number, at: number, device?: string) => api.current.registerNote(note, at, device),
        [],
    );
    return useMemo(
        () => ({
            running,
            progress,
            result,
            expected,
            active: activeNow,
            start: startRun,
            stop: stopNow,
            clearResult: clearResultNow,
            registerNote: registerNoteNow,
            stepMs,
        }),
        [
            running,
            progress,
            result,
            expected,
            activeNow,
            startRun,
            stopNow,
            clearResultNow,
            registerNoteNow,
            stepMs,
        ],
    );
}
