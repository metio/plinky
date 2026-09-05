// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { RecordedNote } from "./composition";
import { contourWeights, voicingWeight } from "./contour";
import { type Articulation, performNote } from "./expression";
import { type GlissandoSpan, glissandoNotes } from "./glissando";
import type { Hand2 } from "./matcher";
import { type OrnamentKind, ornamentNotes } from "./ornament";
import { SOFT_SCALE } from "./pedal";
import { effectiveTempo, listenStepMs } from "./playback";
import { fingeringOfHands } from "./scorePerformance";
import { type TremoloSpan, tremoloNotes, tremoloUnitQuarters } from "./tremolo";

// The listening performance: the model Listen sounds a score from, and everything that
// turns it into notes with times and touches on them.
//
// This is the fullest reading of a page the app has — the figures an ornament, a tremolo
// and a glissando stand for are spelled out, a rolled chord is spread, the tune is lifted
// out of the texture and the line's own shape leans on it. The graded run reads the same
// page more literally on purpose (nobody can be graded on a trill note by note), so
// anything that wants the piece to SOUND like the app plays it reads it from here.
//
// Lifting the timeline off an engraving is the transport's job — an OSMD cursor walk is
// not something core can do. What arrives here is that walk's output.

// One striking note at a position, with the marks `performNote` turns into how
// long and how loud it sounds — everything but the tempo and the position's
// dynamic, which are applied at play time.
export type ListenNote = {
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
    // How high this position's top note sits among the notes around it. The four-bar arch
    // knows nothing about the notes, so it repeats identically every four bars; this is the
    // half of the shaping that follows the actual line.
    contour: number;
    // Whether sounding this step moves the visual cursor on. False for an ornament,
    // which is printed on the very note it decorates.
    advancesCursor: boolean;
    // What fraction of its written loudness this position is played at, from where it sits
    // in the bar and in its phrase. One where the score gives nothing to read.
    interpretation: number;
};

// The contour pass. Done over the finished walk rather than during it, because how high a
// note sits is a question about its neighbours and half of them are still ahead when it is
// collected.
//
// The line is the top sounding pitch of each position — the tune, in nearly all keyboard
// writing — with a rest left as a hole rather than a note at the bottom of the range.
export function shapedByContour(steps: readonly ListenStep[]): ListenStep[] {
    const line = steps.map((step) =>
        step.notes.length === 0 ? null : Math.max(...step.notes.map((note) => note.pitch)),
    );
    const weights = contourWeights(line);
    return steps.map((step, index) => ({ ...step, contour: weights[index] ?? 1 }));
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
export function spellOutOrnament(
    step: ListenStep,
    kind: OrnamentKind,
    fifths: number,
    // The note carrying the sign and its own WRITTEN length — not the sounding one: a pedal
    // may ring the note on past the bar, but the figure has only the note's time to fit
    // into. Defaults to the position's first note, for a position that strikes one.
    carrier: { pitch: number; written: number } = {
        pitch: step.notes[0]?.pitch ?? 0,
        written: step.lengths[0] ?? step.notes[0]?.soundQuarters ?? 0,
    },
): ListenStep[] {
    const note = step.notes.find((one) => one.pitch === carrier.pitch);
    if (!note) {
        return [step];
    }
    const figure = ornamentNotes(note.pitch, carrier.written, kind, fifths);
    if (figure.length < 2) {
        return [step];
    }
    // Whatever else the position strikes — the other hand's note under the trill — is
    // struck with the figure's first note and rings its own length.
    const others = step.notes.filter((one) => one !== note);
    // The figure fills the ornamented note's time; the position's own advance is the
    // shortest length at it, and the last sub-step carries what is left of it.
    const advance = step.lengths.length > 0 ? Math.min(...step.lengths) : carrier.written;
    const figureTime = figure.reduce((sum, one) => sum + one.quarters, 0);
    return figure.map((one, index) => ({
        ...step,
        notes: [
            { ...note, pitch: one.pitch, soundQuarters: one.quarters },
            ...(index === 0 ? others : []),
        ],
        lengths: [
            index === figure.length - 1
                ? Math.max(one.quarters, advance - (figureTime - one.quarters))
                : one.quarters,
        ],
        advancesCursor: index === figure.length - 1 && step.advancesCursor,
    }));
}

// The tremolo sounding at this position, if any: the one it opens, or the one it falls
// inside — the note carrying the mark holds through, so the shake carries on under
// whatever the other hand plays there.
export function tremoloAt(spans: readonly TremoloSpan[], whole: number): TremoloSpan | null {
    return (
        spans.find((span) => near(span.from, whole)) ??
        spans.find((span) => span.from < whole && whole < span.to && !near(span.to, whole)) ??
        null
    );
}

// The glissando this position OPENS, if any. A span is spelled out once, at its first
// note; the notes inside it are swallowed, since the sweep already contains them.

export function openingGlissando(
    spans: readonly GlissandoSpan[],
    whole: number,
): GlissandoSpan | null {
    return spans.find((span) => near(span.from, whole)) ?? null;
}

const NEAR = 1 / 1024;
const near = (one: number, other: number) => Math.abs(one - other) < NEAR;

// A tremolo, spelled out as the notes it shakes, over one position of the walk.
//
// The figure rocks the chord that carries the mark, and fits the position's advance — the
// shortest length at it, whichever staff that is on. Where the tremolo is the only thing
// moving, that is its own written length and the figure fills the span; where the other
// hand moves inside the span, each of its positions gets its own stretch of the rock
// (tremoloAt names them), so the accompaniment keeps its place in the bar and the shake
// carries on under it. Whatever else is struck at the position sounds once, with the first
// note of the figure, for its own written length.
//
// `carrier` is the note carrying the mark, which the figure's notes are modelled on — the
// hand, the articulation. It is at the opening position and not at the later ones inside
// the span, so a collector hands over the one it found at the opening.
export function spellOutTremolo(
    step: ListenStep,
    span: TremoloSpan,
    carrier: ListenNote | null = tremoloCarrier(step, span),
): ListenStep[] {
    const model = carrier ?? step.notes[0];
    if (!model) {
        return [step];
    }
    const own = new Set(
        span.pitches.length > 0 ? span.pitches : step.notes.map((note) => note.pitch),
    );
    const others = step.notes.filter((note) => !own.has(note.pitch));
    const quarters =
        step.lengths.length > 0 ? Math.min(...step.lengths) : (span.to - span.from) * 4;
    // The pair's own pitches, already MIDI numbers read off the file. Both written notes
    // spell the same alternation in the same order, so the two halves run together into
    // one unbroken rock — and a stretch resumed inside a span picks up the chord it had
    // reached.
    const chords = span.pair?.map((chord) => chord.pitches);
    const first = chords?.[0] ?? [...own];
    const phase = Math.round(((step.whole - span.from) * 4) / tremoloUnitQuarters(span.beams));
    const figure = tremoloNotes(first, chords?.[1] ?? null, quarters, span.beams, phase);
    if (figure.length < 2) {
        return [step];
    }
    return figure.map((one, index) => ({
        ...step,
        notes: [
            ...one.pitches.map((pitch) => ({ ...model, pitch, soundQuarters: one.quarters })),
            ...(index === 0 ? others : []),
        ],
        lengths: [one.quarters],
        advancesCursor: index === figure.length - 1 && step.advancesCursor,
    }));
}

// The note at a position that carries the tremolo mark, or the first note there when the
// span names none of them.
export function tremoloCarrier(step: ListenStep, span: TremoloSpan): ListenNote | null {
    return step.notes.find((note) => span.pitches.includes(note.pitch)) ?? step.notes[0] ?? null;
}

// A glissando, spelled out as the keys the hand travels over.
export function spellOutGlissando(
    step: ListenStep,
    span: GlissandoSpan,
    fifths: number,
): ListenStep[] {
    const from =
        (span.pitch === undefined
            ? undefined
            : step.notes.find((one) => one.pitch === span.pitch)) ?? step.notes[0];
    if (!from) {
        return [step];
    }
    // The sweep fills the note it is written FROM. The note it arrives on is a position of
    // its own and sounds by itself afterwards, so the sweep stops short of it — otherwise
    // the arrival is struck twice, once ending the gesture and once on its own.
    // The sweep takes the gliding note's own time, inside the position's advance — the
    // shortest length at it, whichever staff that is on.
    const quarters = Math.min(from.soundQuarters, ...step.lengths);
    // arrivesAt is a MIDI number read off the file, in the same space as the step's pitch.
    const swept = glissandoNotes(from.pitch, span.arrivesAt, quarters, fifths).slice(0, -1);
    if (swept.length < 2) {
        return [step];
    }
    // Stretched back over the whole time, since dropping the arrival left a gap at the end.
    const each = quarters / swept.length;
    const figure = swept.map((one) => ({ ...one, quarters: each }));
    // Whatever else the position strikes — the other hand's chord under the sweep — is
    // struck with the sweep's first note and rings on; the sweep alone is what moves.
    const others = step.notes.filter((one) => one !== from);
    return figure.map((one, index) => ({
        ...step,
        notes: [
            ...(index === 0 ? others : []),
            { ...from, pitch: one.pitch, soundQuarters: one.quarters },
        ],
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
export function rollChord(step: ListenStep): ListenStep[] {
    if (step.notes.length < 2) {
        return [step];
    }
    // The position's own advance is the shortest length at it — every note's length is
    // listed, the other staff's included, and the clock moves on when the shortest ends.
    // Spreading the roll over the first note's length instead held a rolled minim over a
    // quaver in the other hand for the whole minim, and every note after it came late.
    const total = step.lengths.length > 0 ? Math.min(...step.lengths) : 0;
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

// How one note of one position sounds, at the tempo the position is counted at.
//
// Two loudnesses come back because the two consumers want different ones. `velocity` is
// what the page asks of the note — the standing dynamic with its accent and the phrase's
// weight on it — and is what an instrument echoing the playback is lit at. `voiced` is
// that, less everything about where the note sits: under the tune, low in its line, or
// under the soft pedal. All three reduce and none of them lift, so the page keeps the
// ceiling and the synth is handed `voiced`.
export function performListenNote(
    step: ListenStep,
    note: ListenNote,
    tempo: number,
): { durationSeconds: number; velocity: number; voiced: number } {
    const { durationSeconds, velocity } = performNote(
        {
            // Held as long as the position is: under a fermata the note rings through the
            // pause rather than ending at its written length with silence after.
            quarters: note.soundQuarters * step.stretch,
            articulation: note.articulation,
            accent: note.accent,
            marcato: note.marcato,
            slurred: note.slurred,
            dynamicVolume: step.dynamicVolume,
        },
        tempo,
        // The bar's own weighting and the shape of the phrase. Most of the catalogue marks
        // no dynamics at all, and played flat a study is a metronome with pitches.
        step.interpretation,
    );
    const voiced =
        velocity *
        voicingWeight(
            // Every pitch sounding here, so each note knows whether it is the tune or under it.
            step.notes.map((one) => one.pitch),
            note.pitch,
        ) *
        step.contour *
        (step.soft ? SOFT_SCALE : 1);
    return { durationSeconds, velocity, voiced: Math.max(1, Math.round(voiced)) };
}

export type ListenPerformanceOptions = {
    // The tempo the piece opens at, in crotchets per minute. Every position is counted in
    // the same proportion to it that the score's mark there stands in — so a piece that
    // doubles its speed halfway still does.
    startBpm: number;
    // Play the whole piece faster or slower than written; 1 is as written.
    speed?: number;
    // Keep only what sounds within this many milliseconds of the start — for a clip of a
    // piece rather than the whole of it. The cut lands on a position boundary, so the
    // performance never ends halfway into a chord.
    withinMs?: number;
};

// A listening timeline as a performance: every note with when it is struck, how long it
// rings and how hard it is played, on one clock.
//
// This is the same walk the transport schedules, run against a clock that is added up
// rather than waited out — so a rendered video and a listened-to piece are one performance
// rather than two.
export function listenPerformanceOf(
    steps: readonly ListenStep[],
    { startBpm, speed = 1, withinMs }: ListenPerformanceOptions,
): RecordedNote[] {
    // Faster or slower is the dial, not a second clock over the top of one: the notes
    // shorten with the beat exactly as they do when a player moves the tempo.
    const dial = Math.max(1, startBpm * Math.max(0.01, speed));
    const fingering = fingeringOfHands(
        steps.map((step) => ({
            pitches: step.notes.map((note) => note.pitch),
            hands: step.notes.map((note) => note.hand),
        })),
    );
    const notes: RecordedNote[] = [];
    let elapsedMs = 0;
    // Where the first note falls on the step clock. The clip window counts from the first
    // NOTE, as the returned onsets do, not from the first step: a piece that opens with a
    // rest would otherwise lose that rest's length off the end of the clip.
    let firstNoteMs: number | null = null;
    for (const [index, step] of steps.entries()) {
        if (withinMs !== undefined && firstNoteMs !== null && elapsedMs - firstNoteMs >= withinMs) {
            break;
        }
        const tempo = effectiveTempo(dial, step.bpm, startBpm);
        // A chord's members take their fingers in the order the hand's position lists them.
        const taken: Record<Hand2, number> = { left: 0, right: 0 };
        for (const note of step.notes) {
            const { durationSeconds, voiced } = performListenNote(step, note, tempo);
            const finger = fingering.get(note.hand)?.[index]?.[taken[note.hand]];
            taken[note.hand] += 1;
            firstNoteMs ??= elapsedMs;
            notes.push({
                pitch: note.pitch,
                startMs: elapsedMs,
                durationMs: Math.max(1, durationSeconds * 1000),
                velocity: voiced,
                hand: note.hand,
                // Carried, not derived: under the pedal the rest of the instrument answers
                // the note and no damper lands when it ends. A renderer that loses this
                // plays a key-off knock on every note, including the ones a real piano
                // could not knock on at all.
                pedalled: note.pedalled,
                ...(finger === undefined ? {} : { finger }),
            });
        }
        elapsedMs += listenStepMs(step.lengths, tempo, step.stretch);
    }
    // The first note anchors the clock: a piece that opens with a rest should not begin
    // with silence in a video that is only seconds long.
    const first = notes[0]?.startMs ?? 0;
    return notes.map((note) => ({ ...note, startMs: note.startMs - first }));
}

// How much of a position's time its grace notes may take. A grace note is written with a
// length it does not have — it borrows from the note it decorates — so a walk that dwelt
// each grace for its written length and then the beat for its own put every beat after
// an ornament late, and Listen drifted from the onsets the graded run measures against.
const GRACE_MAX_SHARE = 0.5;

// The time each grace group takes and what the beat keeps, all within the position's own
// advance: the graces lean on the beat they decorate, squeezed when there are more of
// them than half the beat can carry.
export function fitGraces(
    graceQuarters: readonly number[],
    advanceQuarters: number,
): { graces: number[]; beat: number } {
    const wanted = graceQuarters.reduce((sum, one) => sum + Math.max(0, one), 0);
    const room = Math.max(0, advanceQuarters) * GRACE_MAX_SHARE;
    const scale = wanted > room && wanted > 0 ? room / wanted : 1;
    const graces = graceQuarters.map((one) => Math.max(0, one) * scale);
    const taken = graces.reduce((sum, one) => sum + one, 0);
    return { graces, beat: Math.max(0, advanceQuarters - taken) };
}
