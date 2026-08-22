// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Articulation } from "../../core/expression";
import type { OrnamentKind } from "../../core/ornament";
import { GRAND_STAFF, partsOf, type ScoreParts } from "../../core/parts";

// Reads the expression marks OSMD parsed from the MusicXML — articulations, slurs,
// ties and the dynamic in force — off a note under the cursor, so Listen can play the
// score as written. OSMD exposes these on the public Note/VoiceEntry types, but the
// fields the transport wants sit behind a few shapes; everything here reads by shape
// and swallows a missing field, so a score OSMD parsed oddly falls back to a plain,
// full-length note rather than throwing mid-playback.

// The ArticulationEnum values from opensheetmusicdisplay@2.0.0 (stable in that
// release). Read by number so a runtime enum import isn't required.
const ART = {
    accent: 0,
    strongaccent: 1, // marcato — MusicXML <strong-accent>
    marcatoup: 3,
    marcatodown: 4,
    staccato: 6,
    staccatissimo: 7,
    tenuto: 9,
    fermata: 10,
    detachedlegato: 25,
} as const;

type NoteShape = {
    Length?: { RealValue?: number };
    ParentVoiceEntry?: { Articulations?: { articulationEnum?: number }[] };
    NoteTie?: { StartNote?: unknown; Notes?: unknown[]; Duration?: { RealValue?: number } } | null;
};

// What a note contributes to playback: whether to strike it (a tie's later notes are
// already sounding), its own written length in quarter notes for the cursor's dwell,
// and the marks that shape the strike — the sounding length in quarters (the whole tie
// for a tie start), which length articulation applies, and the accent/slur flags.
export type ScoreExpression = {
    strike: boolean;
    notatedQuarters: number;
    soundQuarters: number;
    articulation: Articulation;
    accent: boolean;
    marcato: boolean;
    // The note is held beyond its written length at the performer's discretion. The
    // score says to wait, not how long, so a fixed stretch stands in for the judgement
    // a performer makes.
    fermata: boolean;
};

function articulationOf(codes: Set<number>): Articulation {
    // Shortest-held wins when several are present, matching how the marks stack.
    if (codes.has(ART.staccatissimo)) {
        return "staccatissimo";
    }
    if (codes.has(ART.staccato)) {
        return "staccato";
    }
    if (codes.has(ART.detachedlegato)) {
        return "detachedLegato";
    }
    if (codes.has(ART.tenuto)) {
        return "tenuto";
    }
    return "none";
}

export function readScoreExpression(note: unknown): ScoreExpression {
    const shape = (note ?? {}) as NoteShape;
    const notatedQuarters = (shape.Length?.RealValue ?? 0) * 4;

    const codes = new Set<number>();
    for (const art of shape.ParentVoiceEntry?.Articulations ?? []) {
        if (typeof art.articulationEnum === "number") {
            codes.add(art.articulationEnum);
        }
    }
    const accent = codes.has(ART.accent);
    const marcato =
        codes.has(ART.strongaccent) || codes.has(ART.marcatoup) || codes.has(ART.marcatodown);

    // A tie's first note sounds the whole tie's combined length; its later notes are
    // held, not re-struck. A note with no tie strikes at its own written length.
    const tie = shape.NoteTie ?? null;
    let strike = true;
    let soundQuarters = notatedQuarters;
    if (tie) {
        const isStart = tie.StartNote === note || tie.Notes?.[0] === note;
        if (isStart) {
            soundQuarters = (tie.Duration?.RealValue ?? shape.Length?.RealValue ?? 0) * 4;
        } else {
            strike = false;
        }
    }

    return {
        strike,
        notatedQuarters,
        soundQuarters,
        articulation: articulationOf(codes),
        accent,
        marcato,
        fermata: codes.has(ART.fermata),
    };
}

type GraceShape = {
    IsGraceNote?: boolean;
    ParentVoiceEntry?: unknown;
};

// Whether a note is an ornament rather than the note it decorates.
export function isGraceNote(note: unknown): boolean {
    return (note as GraceShape | null)?.IsGraceNote === true;
}

// The notes at one cursor position, split into the order they are actually played: each
// ornament on its own, in written order, then everything that falls on the beat.
//
// The engraver gives a grace note and its principal one position, so a walk that takes a
// position as a chord asks for both keys at once — which is precisely what the score
// says not to do. Grouping by voice entry keeps a grace CHORD together (its notes are
// struck as one) while separating one ornament from the next.
//
// Shared by every walker over the score — the matcher, the note colouring, Listen and the
// play-along — because they index into each other's results. Two walkers splitting a
// position differently would slide every later ghost marker, trail note and highway
// block onto the wrong note.
export function playOrder<T>(items: readonly T[], noteOf: (item: T) => unknown): T[][] {
    const groups: T[][] = [];
    const onBeat: T[] = [];
    let graceEntry: unknown;
    for (const item of items) {
        const note = noteOf(item);
        if (!isGraceNote(note)) {
            onBeat.push(item);
            continue;
        }
        const entry = (note as GraceShape).ParentVoiceEntry;
        if (groups.length === 0 || entry !== graceEntry) {
            groups.push([]);
            graceEntry = entry;
        }
        (groups[groups.length - 1] as T[]).push(item);
    }
    // The on-beat notes are a group even when there are none: a position of nothing but
    // ornaments still ends at the beat, and an empty tail keeps every walker agreeing on
    // how many steps a position is worth.
    groups.push(onBeat);
    return groups;
}

// Where the score asks for the sustain pedal, as whole-note spans. A pedal the engraving
// never lifts runs to the end of the piece, which is what a reader would do with it.
// OSMD's ornament enum, as numbers because the bundle is minified and the enum object it
// came from is not exported in a form worth importing. Confirmed against a live engraving
// by the browser test beside this file — the values are the whole contract.
const ORNAMENT: Record<number, OrnamentKind> = {
    0: "trill",
    1: "turn",
    2: "inverted-turn",
    // A delayed turn is a turn that waits; the wait is a nuance this does not model, and
    // playing it as a turn is much closer than not playing it at all.
    3: "turn",
    4: "inverted-turn",
    5: "mordent",
    6: "inverted-mordent",
};

// Which little sign, if any, is written over a note.
export function readOrnament(note: unknown): OrnamentKind | null {
    const container = (note as OrnamentNoteShape | null)?.ParentVoiceEntry?.OrnamentContainer;
    const code = container?.ornament;
    return typeof code === "number" ? (ORNAMENT[code] ?? null) : null;
}

type OrnamentNoteShape = {
    ParentVoiceEntry?: { OrnamentContainer?: { ornament?: unknown } | null };
};

// Whether the chord this note belongs to is rolled — the wavy line down the left of a
// chord, which asks for its notes one after another rather than together.
export function readArpeggio(note: unknown): boolean {
    return (note as ArpeggioNoteShape | null)?.ParentVoiceEntry?.Arpeggio != null;
}

type ArpeggioNoteShape = { ParentVoiceEntry?: { Arpeggio?: unknown } };

// The two markings the engraving reports the same way — the sustain pedal and the octave
// line — as spans, from a single walk of the measures' expressions.
//
// Both are printed as a start and an end hung on a measure rather than on a note, so what
// differs between them is only which property opens a span and which closes it, and what
// the span carries. Everything else — where a measure begins, how far the music runs, what
// to do with a marking the engraving opens and never closes — is the same problem twice.
//
// A marking left open runs to the end of the music. Dropping it would silently un-pedal (or
// un-shift) the rest of the piece, which is the failure mode nobody notices.
function _readSpans<T>(
    osmd: unknown,
    opens: (entry: ExpressionEntryShape) => T | null,
    closes: (entry: ExpressionEntryShape) => boolean,
): { from: number; to: number; value: T }[] {
    const spans: { from: number; to: number; value: T }[] = [];
    try {
        const measures =
            (osmd as { sheet?: { SourceMeasures?: SourceMeasureShape[] } } | null)?.sheet
                ?.SourceMeasures ?? [];
        let end = 0;
        let open: { at: number; value: T } | null = null;
        for (const measure of measures) {
            const measureStart = measure?.AbsoluteTimestamp?.RealValue ?? 0;
            end = Math.max(end, measureStart + (measure?.Duration?.RealValue ?? 0));
            for (const staff of measure?.staffLinkedExpressions ?? []) {
                for (const entry of staff ?? []) {
                    const at = measureStart + (entry?.timestamp?.RealValue ?? 0);
                    end = Math.max(end, at);
                    const value = entry ? opens(entry) : null;
                    // A second start with no end between them carries on the span already
                    // open: a re-pedal on the spot sounds the same either way, and two
                    // octave lines cannot both apply.
                    if (value !== null && open === null) {
                        open = { at, value };
                    } else if (entry && closes(entry) && open !== null) {
                        spans.push({ from: open.at, to: at, value: open.value });
                        open = null;
                    }
                }
            }
        }
        if (open !== null) {
            spans.push({ from: open.at, to: Math.max(open.at, end), value: open.value });
        }
    } catch {
        // A shape OSMD changed falls back to a score without the marking rather than
        // breaking playback — which is what every score that never writes one reports.
        return [];
    }
    return spans;
}

type ExpressionEntryShape = {
    timestamp?: { RealValue?: number };
    PedalStart?: unknown;
    PedalEnd?: unknown;
    octaveShiftStart?: { octaveValue?: unknown } | null;
    octaveShiftEnd?: unknown;
};

type MeasureShape = { CurrentMeasure?: { TempoInBPM?: number } };

// The tempo in force at the cursor, in beats per minute, or null where the score marks
// none. OSMD resolves it per measure and carries the last mark forward, so a piece that
// changes tempo reports the new one from the measure the mark sits in. Sub-measure
// resolution is not available: a mark placed mid-bar takes effect at the barline.
export function readTempo(iterator: unknown): number | null {
    const bpm = (iterator as MeasureShape | null)?.CurrentMeasure?.TempoInBPM;
    return typeof bpm === "number" && bpm > 0 ? bpm : null;
}

// The tempo the score opens at, which the practice dial is read against: setting the
// dial to 80 asks for the opening at 80, and every later mark keeps its ratio to it.
export function readStartTempo(osmd: unknown): number | null {
    const sheet = (osmd as { sheet?: { DefaultStartTempoInBpm?: number } } | null)?.sheet;
    const bpm = sheet?.DefaultStartTempoInBpm;
    return typeof bpm === "number" && bpm > 0 ? bpm : null;
}

// Where OSMD keeps the dynamics it parsed: on the measure, not on the cursor.
//
// The iterator advertises an ActiveDynamicExpressions array, one slot per staff, and it
// is the obvious place to look — but through the cursor it is never filled. Reading the
// loudness there returns null on every position of every score, which is silent: the
// expressive reading has nothing to measure and says so, and playback sounds every note
// at one volume. So the marks are gathered off the source measures instead, where they
// certainly are, and turned into a timeline the printed position is looked up in.
type DynamicShape = { MidiVolume?: number };
// A continuous dynamic starting here — a hairpin, or a written "cresc." — which is what
// makes the mark a ramp toward the next one. Its presence is the whole signal; the
// object's own start and end volumes are not read, because the marks either side of it
// are what the score actually asks for.
type ContinuousShape = object;
type MultiExpressionShape = {
    timestamp?: { RealValue?: number };
    instantaneousDynamic?: DynamicShape | null;
    startingContinuousDynamic?: ContinuousShape | null;
    // The sustain pedal going down and coming up, which OSMD hangs on the same measure
    // expressions as the dynamics.
    PedalStart?: unknown;
    PedalEnd?: unknown;
};
type SourceMeasureShape = {
    AbsoluteTimestamp?: { RealValue?: number };
    Duration?: { RealValue?: number };
    staffLinkedExpressions?: (MultiExpressionShape[] | undefined)[];
};

// How the engraved sheet lays its instruments out, as staff counts in score order —
// what partsOf needs to work out which staves are the piano.
//
// Read defensively like everything else here: this is OSMD's internal model, and a
// score it could not resolve gives a plain grand staff, which is what every
// single-instrument piece is anyway.
type SheetShape = { Instruments?: { Staves?: unknown[] }[] };

export function readParts(osmd: unknown): ScoreParts {
    try {
        const sheet = (osmd as { sheet?: SheetShape } | null)?.sheet;
        const counts = (sheet?.Instruments ?? []).map(
            (instrument) => instrument?.Staves?.length ?? 0,
        );
        return counts.length > 0 ? partsOf(counts) : GRAND_STAFF;
    } catch {
        return GRAND_STAFF;
    }
}
