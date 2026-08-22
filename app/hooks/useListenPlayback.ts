// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Cursor, OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useRef, useState } from "react";
import { toReplayEvents } from "../../core/composition";
import { type Articulation, performNote } from "../../core/expression";
import { fifthsAt, NO_SCORE_MARKS, type ScoreMarks, tempoAt } from "../../core/musicxmlMarks";
import { type GlissandoSpan, glissandoNotes } from "../../core/glissando";
import { type TremoloSpan, tremoloNotes } from "../../core/tremolo";
import { type Hand2, handOfStaff } from "../../core/matcher";
import { interpretedWeight } from "../../core/interpretation";
import { octaveShiftAt, type OctaveShiftSpan } from "../../core/octaveShift";
import { type OrnamentKind, ornamentNotes } from "../../core/ornament";
import { slurredOnwardAt } from "../../core/slur";
import { volumeAt } from "../../core/dynamics";
import { pedalledAt, ringUntil, SOFT_SCALE, softAt } from "../../core/pedal";
import { FERMATA_STRETCH, NOMINAL_BPM } from "../../core/elapsed";
import { effectiveTempo, listenStepMs } from "../../core/playback";
import { LISTENED_COLOR, WINDOW_COLOR } from "../../core/scoreCanvas";
import type { Take } from "../../core/takes";
import {
    playOrder,
    readArpeggio,
    readOrnament,
    readParts,
    readScoreExpression,
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
    playNote(
        note: number,
        options?: { duration?: number; velocity?: number; pedalled?: boolean },
    ): void;
};

// One striking note at a position, with the marks `performNote` turns into how
// long and how loud it sounds — everything but the tempo and the position's
// dynamic, which are applied at play time.
type ListenNote = {
    pitch: number;
    soundQuarters: number;
    // Whether the score asks for the sustain pedal here. The LENGTH already accounts for it
    // — soundQuarters rings to the end of the pedal span — so this is not about how long the
    // note lasts. It is the other half of what a pedal does: the dampers are off the rest of
    // the strings, and a recorded piano has that resonance to play.
    pedalled: boolean;
    articulation: Articulation;
    accent: boolean;
    marcato: boolean;
    slurred: boolean;
    // Which hand plays it, from the staff the engraving puts it on. The keyboard lights a
    // sounding note in that hand's colour, so a listener can see the two parts move.
    hand: Hand2;
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
    // Whether the soft pedal is down here.
    soft: boolean;
    // Whether sounding this step moves the visual cursor on. False for an ornament,
    // which is printed on the very note it decorates.
    advancesCursor: boolean;
    // What fraction of its written loudness this position is played at, from where it sits
    // in the bar and in its phrase. One where the score gives nothing to read.
    interpretation: number;
};

// Walk the engraved score once and lift the listening timeline into the pure step
// model: every cursor position with its striking notes, the dynamic in force, and
// the lengths for the beat. Leaves the cursor reset. The clock then reads its
// notes from this array, so playback reads no musical data off the live cursor —
// the cursor only mirrors the position and carries the notes the trail colours.
export function collectListenSteps(
    osmd: OpenSheetMusicDisplay,
    // Read from the file rather than off the engraver — see core/musicxmlMarks.
    marks: ScoreMarks = NO_SCORE_MARKS,
): ListenStep[] {
    const cursor = osmd.cursor;
    // Every dynamic the score writes, read once for the walk: a mark stands until the
    // next one, so it belongs to the position's place in the piece, not to the position.
    const dynamics = marks.dynamics;
    // Where the score asks for the sustain pedal: under it the harmony pools, and a note
    // keeps sounding past its written length until the pedal comes up.
    const pedals = marks.pedals;
    const slurs = marks.slurs;
    // Which notes an ornament reaches for depends on the key it is written in — the key at
    // that point, not the one the piece opened in. A trill after a change of key spelled
    // from the opening signature sounds a note the score does not contain.
    const keys = marks.keys;
    // Which staves belong to the practised instrument — on an art song the piano is staves
    // 1 and 2 and the singer is staff 0, so a hand cannot be read off the raw staff index.
    const parts = readParts(osmd);
    // Where the score prints 8va, the drawn pitch is deliberately not the played one.
    const shifts = marks.octaveShifts;
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
                        pitch: note.halfTone + 12 + octaveShiftAt(shifts, whole),
                        // Under the pedal the damper holds the note, so it rings on
                        // whether or not the written value is up.
                        soundQuarters: ringUntil(pedals, whole, expression.soundQuarters / 4) * 4,
                        pedalled: pedalledAt(pedals, whole),
                        articulation: expression.articulation,
                        accent: expression.accent,
                        marcato: expression.marcato,
                        // From the span, not the note: the engraving hangs a slur on its
                        // two end notes only, so a note in the middle of an arch reports
                        // none of its own and would play detached.
                        slurred: slurredOnwardAt(slurs, whole),
                        hand: handOfStaff(note.ParentStaff?.idInMusicSheet, parts),
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
                // From the file, so a tempo written mid-bar takes effect where it is
                // written rather than at the barline before it.
                bpm: tempoAt(marks.tempi, whole) ?? readTempo(cursor.iterator) ?? NOMINAL_BPM,
                stretch: fermata ? FERMATA_STRETCH : 1,
                advancesCursor: order === groups.length - 1,
                interpretation: interpretedWeight(marks.bars, slurs, whole),
                // Under the soft pedal the hammers strike fewer strings. Kept separate from
                // the interpretation weight, which is about where a note sits in its bar and
                // its phrase — this is a thing the player's foot is doing, and it applies on
                // top of whatever the music was already asking for.
                soft: softAt(marks.softs, whole),
            };
            // A trill, mordent or turn is not a decoration on the note — it is an
            // instruction to play a short figure in its place. Printed but not played, the
            // page and the sound disagree about what the bar contains, and a reader
            // learning to recognise the sign hears nothing happen where it is written.
            const ornament = group.length === 1 ? readOrnament(group[0]) : null;
            // A tremolo and a glissando are the same kind of instruction as an ornament —
            // shorthand for a figure — so they are spelled out the same way, and the graded
            // run still asks for the written notes. Taken in this order because a note can
            // carry only one of them, and the tremolo's span is what decides whether this
            // position opens one.
            const tremolo = openingTremolo(marks.tremolos, whole);
            const gliss = openingGlissando(marks.glissandos, whole);
            if (tremolo) {
                steps.push(...spellOutTremolo(step, tremolo, shifts));
            } else if (gliss) {
                steps.push(...spellOutGlissando(step, gliss, fifthsAt(keys, whole)));
            } else if (ornament) {
                steps.push(...spellOutOrnament(step, ornament, fifthsAt(keys, whole)));
            } else if (group.some((note) => readArpeggio(note))) {
                steps.push(...rollChord(step));
            } else {
                steps.push(step);
            }
        }
        cursor.next();
    }
    cursor.reset();
    return steps;
}

// One position carrying an ornament, spelled out as the notes it actually sounds.
//
// Listen and the graded run part company here, on purpose. Everywhere else the two read
// one performance off the page — a tie held, a grace note ahead of its beat — because
// asking the player for something different from what they just heard is the one thing
// that reliably confuses. An ornament is the exception: nobody can be graded on a trill
// note by note, and demanding one would fail every player who plays the passage
// beautifully. So the run asks for the written note and Listen plays the figure.
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

// The tremolo or glissando this position OPENS, if any. A span is spelled out once, at its
// first note; the notes inside it are swallowed, since the figure already contains them.
function openingTremolo(spans: readonly TremoloSpan[], whole: number): TremoloSpan | null {
    return spans.find((span) => near(span.from, whole)) ?? null;
}

function openingGlissando(spans: readonly GlissandoSpan[], whole: number): GlissandoSpan | null {
    return spans.find((span) => near(span.from, whole)) ?? null;
}

const NEAR = 1 / 1024;
const near = (one: number, other: number) => Math.abs(one - other) < NEAR;

// A tremolo, spelled out as the notes it shakes. The figure fills the whole span — for an
// alternating one that is both written notes' time, because the pair is one gesture.
function spellOutTremolo(
    step: ListenStep,
    span: TremoloSpan,
    shifts: readonly OctaveShiftSpan[],
): ListenStep[] {
    const model = step.notes[0];
    if (!model) {
        return [step];
    }
    const quarters = (span.to - span.from) * 4;
    // The pair's own written pitches, each moved by whatever octave line is in force where
    // IT sits. Both written notes spell the same alternation in the same order, so the two
    // halves run together into one unbroken rock.
    const chords = span.pair?.map((chord) =>
        chord.pitches.map((pitch) => pitch + 12 + octaveShiftAt(shifts, chord.at)),
    );
    const first = chords?.[0] ?? step.notes.map((note) => note.pitch);
    const figure = tremoloNotes(first, chords?.[1] ?? null, quarters, span.beams);
    if (figure.length < 2) {
        return [step];
    }
    return figure.map((one, index) => ({
        ...step,
        notes: one.pitches.map((pitch) => ({ ...model, pitch, soundQuarters: one.quarters })),
        lengths: [one.quarters],
        advancesCursor: index === figure.length - 1 && step.advancesCursor,
    }));
}

// A glissando, spelled out as the keys the hand travels over.
function spellOutGlissando(step: ListenStep, span: GlissandoSpan, fifths: number): ListenStep[] {
    const from = step.notes[0];
    if (!from) {
        return [step];
    }
    // The sweep fills the note it is written FROM. The note it arrives on is a position of
    // its own and sounds by itself afterwards, so the sweep stops short of it — otherwise
    // the arrival is struck twice, once ending the gesture and once on its own.
    const quarters = (step.lengths[0] ?? from.soundQuarters) as number;
    const swept = glissandoNotes(from.pitch, span.arrivesAt + 12, quarters, fifths).slice(0, -1);
    if (swept.length < 2) {
        return [step];
    }
    // Stretched back over the whole time, since dropping the arrival left a gap at the end.
    const each = quarters / swept.length;
    const figure = swept.map((one) => ({ ...one, quarters: each }));
    return figure.map((one, index) => ({
        ...step,
        notes: [{ ...from, pitch: one.pitch, soundQuarters: one.quarters }],
        lengths: [one.quarters],
        advancesCursor: index === figure.length - 1 && step.advancesCursor,
    }));
}

// A note of a rolled chord starts this long after the one below it, in quarter notes. A
// roll is a gesture of the hand rather than a rhythm — the notes are spread by about as
// much whatever the tempo — so this is small and fixed rather than a share of the chord.
const ROLL_QUARTERS = 0.06;

// The wavy line down the left of a chord: its notes are struck one after another, from the
// bottom up, and every one of them keeps ringing. That last part is what makes it a chord
// and not a run, so each note keeps its own sounding length while only the starts are
// staggered.
//
// Direction is not modelled: MusicXML can write a downward roll and this plays it upward.
// An upward roll is what a bare `<arpeggiate/>` means and what nearly every one in the
// catalogue is, and rolling the notes in some order beats striking them together.
function rollChord(step: ListenStep): ListenStep[] {
    if (step.notes.length < 2) {
        return [step];
    }
    const total = step.lengths[0] ?? 0;
    const ordered = [...step.notes].sort((one, other) => one.pitch - other.pitch);
    // Never let the spread swallow the position: a rolled chord on a semiquaver stays a
    // chord, just a tighter one.
    const roll = Math.min(ROLL_QUARTERS, total / ordered.length);
    return ordered.map((note, index) => ({
        ...step,
        notes: [note],
        lengths: [index === ordered.length - 1 ? total - roll * (ordered.length - 1) : roll],
        advancesCursor: index === ordered.length - 1 && step.advancesCursor,
    }));
}

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
}) {
    const chain = useTimerChain();
    // Through a ref: the walk is set up inside a callback that must not be rebuilt every
    // time a new marks object arrives, and what it needs is whatever is current when a
    // playback actually starts.
    const marksRef = useRef(marks);
    marksRef.current = marks;
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
        setSounding(NOTHING_SOUNDING);
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
            setSounding(
                current.notes.length === 0
                    ? NOTHING_SOUNDING
                    : new Map(current.notes.map((note) => [note.pitch, note.hand])),
            );
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
                    // The bar's own weighting and the shape of the phrase. Most of the
                    // catalogue marks no dynamics at all, and played flat a study is a
                    // metronome with pitches.
                    current.interpretation,
                );
                synth.playNote(note.pitch, {
                    duration: durationSeconds,
                    // Gentled where the score asks for the soft pedal, on top of everything
                    // the music already asked for.
                    velocity: current.soft
                        ? Math.max(1, Math.round(velocity * SOFT_SCALE))
                        : velocity,
                    pedalled: note.pedalled,
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

    return { playing, activeReplayId, active, start, replay, stop, sounding };
}
